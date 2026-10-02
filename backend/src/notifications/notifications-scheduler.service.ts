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
/**
 * Rappels envoyés en parallèle (par lot) : un rappel = un e-mail et/ou les push d'un utilisateur
 * (≤ 10 appareils, 5 s max chacun). Borne la charge réseau et la durée d'un lot.
 */
export const DISPATCH_CONCURRENCY = 10;
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

/** Colonnes d'un rappel dû, lues dans la transaction puis utilisées pour l'envoi (hors transaction). */
const DUE_REMINDER_SELECT = {
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
} satisfies Prisma.NotificationEventSelect;

type DueReminder = Prisma.NotificationEventGetPayload<{
  select: typeof DUE_REMINDER_SELECT;
}>;

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
 *  3. réserve les événements `pending` dus dans (now − 10 min ; now] et pas encore notifiés :
 *     `notifiedAt` passe de NULL à `now` (UPDATE … RETURNING, atomique) — jamais de doublon ;
 *  4. APRÈS la transaction (verrou et connexion libérés), envoie les rappels réservés par lots
 *     de `DISPATCH_CONCURRENCY` (`Promise.allSettled`), selon `deliveryChannel`. Un service push
 *     ou SMTP lent ne bloque plus le verrou ni la transaction (revue de sécurité, constat 2).
 *     Un rappel dont aucun canal n'a abouti est libéré (`notifiedAt` remis à NULL) pour être
 *     retenté au tick suivant.
 */
@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);
  /** userId → jour local déjà généré par cette instance (évite de régénérer à chaque tick). */
  private readonly generatedDay = new Map<string, string>();
  /** Exécution en cours dans CETTE instance (les envois d'un tick peuvent déborder sur le suivant). */
  private running = false;

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
   *
   * La transaction ne contient que du travail en base (génération + réservation) ; les envois
   * (réseau) ont lieu après sa validation.
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
    if (this.running) {
      this.logger.debug('Exécution précédente encore en cours : tick ignoré.');
      return empty;
    }
    this.running = true;
    try {
      const collected = await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ locked: boolean }[]>(
            Prisma.sql`SELECT pg_try_advisory_xact_lock(${REMINDERS_LOCK_KEY}::bigint) AS locked`,
          );
          if (!rows[0]?.locked) {
            this.logger.debug(
              'Verrou de rappels détenu par une autre instance.',
            );
            return null;
          }
          const generated = await this.generateTodayEvents(now);
          const { found, claimed } = await this.claimDue(tx, now);
          return { generated, found, claimed };
        },
        { maxWait: 10_000, timeout: 4 * 60 * 1000 },
      );
      if (!collected) return empty;

      const sent = await this.dispatchClaimed(collected.claimed, now);
      return {
        locked: true,
        generated: collected.generated,
        due: collected.found,
        ...sent,
      };
    } finally {
      this.running = false;
    }
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

  /**
   * Dans la transaction du verrou : lit les rappels dus et les RÉSERVE atomiquement
   * (`notifiedAt` : NULL → `now`, UPDATE … RETURNING). Seuls les rappels effectivement réservés
   * seront envoyés : un rappel passé à « fait » entre-temps, ou réservé par une exécution qui
   * se chevauche, est exclu. Aucun appel réseau ici.
   */
  private async claimDue(
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<{ found: number; claimed: DueReminder[] }> {
    const due = await tx.notificationEvent.findMany({
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
      select: DUE_REMINDER_SELECT,
    });
    if (due.length === 0) return { found: 0, claimed: [] };

    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`UPDATE "NotificationEvent"
                 SET "notifiedAt" = ${now.toISOString()}::timestamptz, "updatedAt" = CURRENT_TIMESTAMP
                 WHERE "id" IN (${Prisma.join(due.map((e) => e.id))})
                   AND "notifiedAt" IS NULL AND "status" = 'pending'
                 RETURNING "id"`,
    );
    const claimedIds = new Set(rows.map((r) => r.id));
    return {
      found: due.length,
      claimed: due.filter((e) => claimedIds.has(e.id)),
    };
  }

  /**
   * Envoie les rappels réservés, HORS transaction, par lots de `DISPATCH_CONCURRENCY` en
   * `Promise.allSettled` : un envoi en échec (ou qui lève) n'interrompt pas les autres.
   */
  private async dispatchClaimed(
    claimed: DueReminder[],
    now: Date,
  ): Promise<Pick<ReminderRunResult, 'emailed' | 'pushed' | 'failed'>> {
    const result = { emailed: 0, pushed: 0, failed: 0 };
    const appUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '') || null;

    for (let i = 0; i < claimed.length; i += DISPATCH_CONCURRENCY) {
      const batch = claimed.slice(i, i + DISPATCH_CONCURRENCY);
      const outcomes = await Promise.allSettled(
        batch.map((ev) => this.deliverOne(ev, appUrl)),
      );
      for (const [k, outcome] of outcomes.entries()) {
        const delivered =
          outcome.status === 'fulfilled'
            ? outcome.value
            : { emailed: false, pushed: false };
        if (delivered.emailed) result.emailed++;
        if (delivered.pushed) result.pushed++;
        if (delivered.emailed || delivered.pushed) continue;

        // Aucun canal n'a abouti : on libère la réservation (si elle est toujours la nôtre)
        // pour retenter au prochain tick, tant que l'événement reste dans la fenêtre de 10 min.
        result.failed++;
        await this.prisma.notificationEvent
          .updateMany({
            where: { id: batch[k].id, notifiedAt: now },
            data: { notifiedAt: null },
          })
          .catch((error: unknown) =>
            this.logger.warn(
              `Libération du rappel ${batch[k].id} impossible : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
            ),
          );
      }
    }
    return result;
  }

  /** Un rappel, selon le canal choisi : e-mail et/ou push. N'échoue jamais (false = non envoyé). */
  private async deliverOne(
    ev: DueReminder,
    appUrl: string | null,
  ): Promise<{ emailed: boolean; pushed: boolean }> {
    const channel = normalizeChannel(
      ev.user.notificationPreferences[0]?.deliveryChannel,
    );
    const label = ev.label || ev.type;
    let emailed = false;
    let pushed = false;

    if (channel === 'email' || channel === 'both') {
      emailed = await this.mailService
        .sendCareReminder(ev.user.email, ev.user.locale, {
          label,
          animalName: ev.animal?.name,
          scheduledAt: ev.scheduledAt,
          timezone: ev.user.timezone,
          appUrl,
        })
        .then((res) => res.sent)
        .catch(() => false);
    }

    if (channel === 'push' || channel === 'both') {
      pushed = await this.pushSender
        .sendToUser(ev.userId, {
          title: label,
          body: ev.animal?.name ?? label,
          data: {
            eventId: ev.id,
            type: ev.type,
            animalId: ev.animalId,
            // Préfixe de locale pour l'URL ouverte au clic (sw.js : notificationclick).
            locale: ev.user.locale,
          },
        })
        .catch(() => false);
    }
    return { emailed, pushed };
  }
}
