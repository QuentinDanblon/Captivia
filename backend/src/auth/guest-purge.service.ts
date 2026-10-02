import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { guestRetentionDays } from './auth.constants';

/** Clé du verrou consultatif Postgres de la purge des invités (constante propre au job). */
export const GUEST_PURGE_LOCK_KEY = 4_731_202_611;
/** Comptes supprimés par lot (une transaction par lot). */
export const GUEST_PURGE_BATCH_SIZE = 200;
/** Borne par exécution (anti-emballement) : le reste part à l'exécution suivante. */
export const GUEST_PURGE_MAX_PER_RUN = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GuestPurgeResult {
  locked: boolean;
  deleted: number;
  cutoff: Date;
}

/**
 * Purge des comptes invités inactifs (RGPD : minimisation / limitation de la conservation).
 *
 * Un invité (`User.isGuest`) jamais converti en compte et sans activité (`lastActiveAt`) depuis
 * `GUEST_RETENTION_DAYS` jours (défaut 90) est supprimé avec toutes ses données (cascade SQL :
 * animaux, carnet, rappels, sessions, abonnements push). Un invité titulaire d'un abonnement store
 * (cas anormal : l'achat exige un compte) n'est jamais purgé automatiquement.
 *
 * Tous les jours à 03:17 UTC, sous verrou consultatif de transaction (même mécanique que le
 * scheduler de rappels : compatible PgBouncer en mode transaction, une seule instance travaille).
 */
@Injectable()
export class GuestPurgeService {
  private readonly logger = new Logger(GuestPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  get enabled(): boolean {
    return (
      process.env.NODE_ENV !== 'test' &&
      process.env.GUEST_PURGE_ENABLED !== 'false'
    );
  }

  @Cron('17 3 * * *', { name: 'guest-purge', timeZone: 'UTC' })
  async handleCron(): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await this.runOnce();
      if (res.locked && res.deleted > 0) {
        this.logger.log(
          `Purge des invités : ${res.deleted} compte(s) inactif(s) depuis le ${res.cutoff.toISOString()} supprimé(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Purge des invités en échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  }

  /** Une exécution : supprime par lots les invités inactifs avant `now − rétention`. */
  async runOnce(
    now: Date = new Date(),
    retentionDays: number = guestRetentionDays(),
  ): Promise<GuestPurgeResult> {
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${GUEST_PURGE_LOCK_KEY}::bigint) AS locked`,
        );
        if (!rows[0]?.locked) return { locked: false, deleted: 0 };

        let deleted = 0;
        while (deleted < GUEST_PURGE_MAX_PER_RUN) {
          const batch = await tx.user.findMany({
            where: {
              isGuest: true,
              lastActiveAt: { lt: cutoff },
              subscriptions: { none: {} },
            },
            select: { id: true },
            orderBy: { lastActiveAt: 'asc' },
            take: GUEST_PURGE_BATCH_SIZE,
          });
          if (batch.length === 0) break;
          // Conditions répétées : un invité converti ou actif entre-temps n'est jamais supprimé.
          const res = await tx.user.deleteMany({
            where: {
              id: { in: batch.map((u) => u.id) },
              isGuest: true,
              lastActiveAt: { lt: cutoff },
            },
          });
          deleted += res.count;
          if (res.count === 0 || batch.length < GUEST_PURGE_BATCH_SIZE) break;
        }
        return { locked: true, deleted };
      },
      { maxWait: 10_000, timeout: 5 * 60 * 1000 },
    );
    return { ...result, cutoff };
  }
}
