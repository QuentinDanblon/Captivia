import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GradeService } from '../grade/grade.service';
import { MailService } from '../mail/mail.service';
import { PUSH_SENDER, PushSender } from './push-sender';

/** Clé du verrou consultatif Postgres du job de rappels (constante arbitraire, propre au job). */
export const REMINDERS_LOCK_KEY = 4_731_202_610;
/** Un rappel est envoyé s'il est dû depuis moins de 10 min (rattrapage d'un tick manqué). */
export const REMINDER_WINDOW_MS = 10 * 60 * 1000;
/** Bornes par exécution (anti-emballement). */
export const MAX_DISPATCH_PER_RUN = 1000;
export const MAX_GENERATIONS_PER_RUN = 300;
const USER_PAGE_SIZE = 500;
const DEFAULT_TIMEZONE = 'Europe/Paris';

export type DeliveryChannel = 'email' | 'push' | 'both';

export interface ReminderRunResult {
  locked: boolean;
  generated: number;
  due: number;
  emailed: number;
  pushed: number;
  failed: number;
}

/** `YYYY-MM-DD` de `now` dans le fuseau IANA donné (repli Europe/Paris si invalide). */
export function localDay(
  now: Date,
  timezone: string | null | undefined,
): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  try {
    return fmt(timezone || DEFAULT_TIMEZONE);
  } catch {
    return fmt(DEFAULT_TIMEZONE);
  }
}

export function normalizeChannel(value: unknown): DeliveryChannel {
  return value === 'email' || value === 'both' ? value : 'push';
}

/**
 * Scheduler unifié des rappels (W3-02) : routines, médicaments, vaccins, RDV vétérinaires.
 *
 * Toutes les 5 minutes :
 *  1. verrou consultatif Postgres (une seule instance travaille) ;
 *  2. génère les NotificationEvent de « la journée en cours » (fuseau `User.timezone`) via
 *     `GradeService.getOrCreateTodayEvents` (idempotent : index unique userId+sourceKey+scheduledAt) ;
 *  3. envoie les événements `pending` dus dans (now − 10 min ; now] et pas encore notifiés,
 *     selon `deliveryChannel` (email / push / both), après avoir posé `notifiedAt` de façon
 *     atomique (`updateMany … where notifiedAt IS NULL`) : jamais de doublon.
 */
@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);
  /** userId → jour local déjà généré par cette instance (évite de régénérer à chaque tick). */
  private readonly generatedDay = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeService: GradeService,
    private readonly mailService: MailService,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
  ) {}

  get enabled(): boolean {
    return (
      process.env.NODE_ENV !== 'test' &&
      process.env.REMINDERS_ENABLED !== 'false'
    );
  }

  @Cron('*/5 * * * *', { name: 'reminders' })
  async handleCron(): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await this.runOnce();
      if (res.locked && res.due > 0) {
        this.logger.log(
          `Rappels : ${res.due} dus, ${res.emailed} e-mails, ${res.pushed} push, ${res.failed} échecs.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Job de rappels en échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  }

  /**
   * Une exécution du job. Le verrou est `pg_try_advisory_xact_lock` pris dans une transaction
   * interactive : avec PgBouncer en mode transaction (Neon pooled), un verrou de SESSION
   * (`pg_try_advisory_lock`) pourrait être pris et relâché sur des connexions serveur
   * différentes. Le verrou de transaction est libéré automatiquement en fin de transaction,
   * y compris en cas de crash.
   */
  async runOnce(now: Date = new Date()): Promise<ReminderRunResult> {
    const empty: ReminderRunResult = {
      locked: false,
      generated: 0,
      due: 0,
      emailed: 0,
      pushed: 0,
      failed: 0,
    };
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${REMINDERS_LOCK_KEY}::bigint) AS locked`,
        );
        if (!rows[0]?.locked) {
          this.logger.debug('Verrou de rappels détenu par une autre instance.');
          return empty;
        }
        const generated = await this.generateTodayEvents(now);
        const dispatched = await this.dispatchDue(now);
        return { ...dispatched, locked: true, generated };
      },
      { maxWait: 10_000, timeout: 4 * 60 * 1000 },
    );
  }

  /** Génère (au plus une fois par jour local et par instance) les événements des utilisateurs actifs. */
  private async generateTodayEvents(now: Date): Promise<number> {
    let generated = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { notificationPreferences: { some: {} } },
            {
              animals: {
                some: {
                  OR: [
                    { routines: { some: { active: true } } },
                    { medications: { some: { active: true } } },
                    { vetAppointments: { some: { status: 'scheduled' } } },
                    { vaccinations: { some: { nextDueDate: { not: null } } } },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true, timezone: true },
        orderBy: { id: 'asc' },
        take: USER_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const user of users) {
        if (generated >= MAX_GENERATIONS_PER_RUN) return generated;
        const day = localDay(now, user.timezone);
        if (this.generatedDay.get(user.id) === day) continue;
        try {
          await this.gradeService.getOrCreateTodayEvents(user.id, day);
          this.generatedDay.set(user.id, day);
          generated++;
        } catch (error) {
          this.logger.warn(
            `Génération des rappels impossible pour ${user.id} : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
          );
        }
      }
      if (users.length < USER_PAGE_SIZE) return generated;
      cursor = users[users.length - 1].id;
    }
  }

  private async dispatchDue(
    now: Date,
  ): Promise<Omit<ReminderRunResult, 'locked' | 'generated'>> {
    const due = await this.prisma.notificationEvent.findMany({
      where: {
        status: 'pending',
        notifiedAt: null,
        scheduledAt: {
          gt: new Date(now.getTime() - REMINDER_WINDOW_MS),
          lte: now,
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: MAX_DISPATCH_PER_RUN,
      select: {
        id: true,
        type: true,
        label: true,
        scheduledAt: true,
        userId: true,
        animalId: true,
        animal: { select: { name: true } },
        user: {
          select: {
            email: true,
            locale: true,
            timezone: true,
            notificationPreferences: {
              select: { deliveryChannel: true },
              take: 1,
            },
          },
        },
      },
    });

    const result = { due: due.length, emailed: 0, pushed: 0, failed: 0 };
    const appUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '') || null;

    for (const ev of due) {
      // Réservation atomique : seule l'exécution qui fait passer notifiedAt de NULL à `now`
      // envoie le rappel (pas de doublon, même si deux exécutions se chevauchaient).
      const claimed = await this.prisma.notificationEvent.updateMany({
        where: { id: ev.id, notifiedAt: null, status: 'pending' },
        data: { notifiedAt: now },
      });
      if (claimed.count !== 1) continue;

      const channel = normalizeChannel(
        ev.user.notificationPreferences[0]?.deliveryChannel,
      );
      const label = ev.label || ev.type;
      let delivered = false;

      if (channel === 'email' || channel === 'both') {
        const res = await this.mailService.sendCareReminder(
          ev.user.email,
          ev.user.locale,
          {
            label,
            animalName: ev.animal?.name,
            scheduledAt: ev.scheduledAt,
            timezone: ev.user.timezone,
            appUrl,
          },
        );
        if (res.sent) {
          delivered = true;
          result.emailed++;
        }
      }

      if (channel === 'push' || channel === 'both') {
        const ok = await this.pushSender
          .sendToUser(ev.userId, {
            title: label,
            body: ev.animal?.name ?? label,
            data: { eventId: ev.id, type: ev.type, animalId: ev.animalId },
          })
          .catch(() => false);
        if (ok) {
          delivered = true;
          result.pushed++;
        }
      }

      if (!delivered) {
        // Aucun canal n'a abouti : on libère la réservation pour retenter au prochain tick
        // (tant que l'événement reste dans la fenêtre de 10 min).
        result.failed++;
        await this.prisma.notificationEvent.updateMany({
          where: { id: ev.id, notifiedAt: now },
          data: { notifiedAt: null },
        });
      }
    }
    return result;
  }
}
