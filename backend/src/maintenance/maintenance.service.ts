import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityMediaService } from '../community/media/community-media.service';
import {
  CommunityModerationService,
  NotificationRetryCounts,
} from '../community/community-moderation.service';
import {
  MAINTENANCE_BATCH_SIZE,
  MAINTENANCE_LOCK_KEY,
  MAINTENANCE_MAX_PER_TABLE,
  maintenanceCutoffs,
} from './maintenance.constants';

/** Nombre de lignes supprimées par catégorie lors d'une exécution. */
export interface MaintenanceCounts {
  passwordResetTokens: number;
  emailVerificationTokens: number;
  refreshTokens: number;
  notificationEvents: number;
  /** Jetons de push natif non réenregistrés depuis 270 jours (W6-07). */
  deviceTokens: number;
  /** Communauté : décisions de modération de plus de 365 jours. */
  communityModerationActions: number;
  /** Communauté : signalements traités de plus de 365 jours. */
  communityReports: number;
  /** Communauté : images orphelines (fichier + ligne). */
  communityMedia: number;
  /** Communauté : réservations de pseudos libérés arrivées à expiration (60 jours). */
  communityHandleHolds: number;
  /** Communauté : tentatives de téléversement de plus de 24 h (limite horaire). */
  communityUploadAttempts: number;
}

export interface MaintenanceResult {
  /** false : une autre instance détient le verrou, rien n'a été fait. */
  locked: boolean;
  deleted: MaintenanceCounts;
  /** Notifications de modération relancées (DSA art. 16(5) et 17), après la purge. */
  retried: NotificationRetryCounts;
  durationMs: number;
}

type Tx = Prisma.TransactionClient;

const EMPTY_COUNTS: MaintenanceCounts = {
  passwordResetTokens: 0,
  emailVerificationTokens: 0,
  refreshTokens: 0,
  notificationEvents: 0,
  deviceTokens: 0,
  communityModerationActions: 0,
  communityReports: 0,
  communityMedia: 0,
  communityHandleHolds: 0,
  communityUploadAttempts: 0,
};

const NO_RETRY: NotificationRetryCounts = { decisions: 0, reports: 0 };

/**
 * Job de maintenance quotidien (W2-08, RGPD : limitation de la conservation).
 *
 * Supprime, par lots de {@link MAINTENANCE_BATCH_SIZE} lignes :
 * - les jetons de réinitialisation de mot de passe expirés (durée de vie 1 h) ;
 * - les jetons de vérification d'e-mail expirés ou invalidés (durée de vie 24 h) ;
 * - les refresh tokens expirés ou révoqués depuis plus de 30 jours (tous les comptes) ;
 * - les `NotificationEvent` dont la date prévue remonte à plus de 90 jours ;
 * - les jetons de push natif (`DeviceToken`) que l'app n'a pas réenregistrés depuis 270 jours ;
 * - communauté : décisions de modération (sauf recours en attente) et signalements traités de plus
 *   de 365 jours, images orphelines (ni publication ni avatar ; propriétaire supprimé ou
 *   téléversées depuis plus de 24 h), fichier compris (1 000 au plus par exécution), réservations
 *   de pseudos expirées, tentatives de téléversement de plus de 24 h.
 *
 * Puis, hors transaction, relance les notifications de modération en échec de moins de 7 jours
 * (auteurs des contenus : `notificationPending` ; auteurs des signalements : `notifiedAt` NULL).
 *
 * Ne touche JAMAIS à `PaymentEvent` : journal des notifications de paiement des stores, conservé
 * au titre des obligations comptables et de la preuve des transactions (cf. registre).
 * Ne supprime aucun compte : les invités relèvent de `GuestPurgeService`, les comptes inactifs
 * depuis 36 mois d'une procédure manuelle avec préavis (docs/RUNBOOK.md).
 *
 * Tous les jours à 03:41 UTC, sous verrou consultatif de transaction (même mécanique que le
 * scheduler de rappels et la purge des invités : compatible PgBouncer en mode transaction, une
 * seule instance travaille). `MAINTENANCE_ENABLED=false` suspend le job.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly communityMedia?: CommunityMediaService,
    @Optional()
    private readonly communityModeration?: CommunityModerationService,
  ) {}

  get enabled(): boolean {
    return (
      process.env.NODE_ENV !== 'test' &&
      process.env.MAINTENANCE_ENABLED !== 'false'
    );
  }

  @Cron('41 3 * * *', { name: 'maintenance', timeZone: 'UTC' })
  async handleCron(): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await this.runOnce();
      if (!res.locked) {
        this.logger.log(
          'Maintenance : verrou détenu par une autre instance, exécution ignorée.',
        );
        return;
      }
      const d = res.deleted;
      this.logger.log(
        `Maintenance : ${d.passwordResetTokens} jeton(s) de réinitialisation, ` +
          `${d.emailVerificationTokens} jeton(s) de vérification d'e-mail, ` +
          `${d.refreshTokens} refresh token(s), ${d.notificationEvents} événement(s) de rappel, ` +
          `${d.deviceTokens} jeton(s) de push natif inactif(s), ` +
          `${d.communityModerationActions} décision(s) de modération, ${d.communityReports} signalement(s) ` +
          `traité(s), ${d.communityMedia} image(s) orpheline(s), ${d.communityHandleHolds} réservation(s) de pseudo, ` +
          `${d.communityUploadAttempts} tentative(s) de téléversement supprimé(s) ; ` +
          `${res.retried.decisions + res.retried.reports} notification(s) de modération relancée(s) en ${res.durationMs} ms.`,
      );
    } catch (error) {
      this.logger.error(
        `Maintenance en échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  }

  /** Une exécution complète (toutes les purges) à l'instant `now`. */
  async runOnce(now: Date = new Date()): Promise<MaintenanceResult> {
    const started = Date.now();
    const cutoffs = maintenanceCutoffs(now);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${MAINTENANCE_LOCK_KEY}::bigint) AS locked`,
        );
        if (!rows[0]?.locked) {
          return { locked: false, deleted: { ...EMPTY_COUNTS } };
        }
        const deleted: MaintenanceCounts = {
          passwordResetTokens: await this.deleteInBatches(
            tx,
            Prisma.sql`"PasswordResetToken"`,
            Prisma.sql`"expiresAt" < ${cutoffs.oneTimeTokensExpiredBefore}`,
          ),
          emailVerificationTokens: await this.deleteInBatches(
            tx,
            Prisma.sql`"EmailVerificationToken"`,
            Prisma.sql`"expiresAt" < ${cutoffs.oneTimeTokensExpiredBefore}`,
          ),
          refreshTokens: await this.deleteInBatches(
            tx,
            Prisma.sql`"RefreshToken"`,
            Prisma.sql`("expiresAt" < ${cutoffs.refreshTokensBefore} OR "revokedAt" < ${cutoffs.refreshTokensBefore})`,
          ),
          notificationEvents: await this.deleteInBatches(
            tx,
            Prisma.sql`"NotificationEvent"`,
            Prisma.sql`"scheduledAt" < ${cutoffs.notificationEventsBefore}`,
          ),
          deviceTokens: await this.deleteInBatches(
            tx,
            Prisma.sql`"DeviceToken"`,
            Prisma.sql`"lastSeenAt" < ${cutoffs.deviceTokensBefore}`,
          ),
          // Une décision dont le recours est en attente n'est jamais purgée (DSA art. 20).
          communityModerationActions: await this.deleteInBatches(
            tx,
            Prisma.sql`"CommunityModerationAction"`,
            Prisma.sql`"createdAt" < ${cutoffs.moderationBefore} AND "appealStatus" <> 'PENDING'`,
          ),
          communityReports: await this.deleteInBatches(
            tx,
            Prisma.sql`"CommunityReport"`,
            Prisma.sql`"status" <> 'OPEN' AND "createdAt" < ${cutoffs.moderationBefore}`,
          ),
          communityMedia: this.communityMedia
            ? await this.communityMedia.purgeOrphans(now, tx)
            : 0,
          communityHandleHolds: await this.deleteInBatches(
            tx,
            Prisma.sql`"CommunityHandleHold"`,
            Prisma.sql`"expiresAt" < ${now}`,
          ),
          communityUploadAttempts: await this.deleteInBatches(
            tx,
            Prisma.sql`"CommunityUploadAttempt"`,
            Prisma.sql`"createdAt" < ${cutoffs.uploadAttemptsBefore}`,
          ),
        };
        return { locked: true, deleted };
      },
      { maxWait: 10_000, timeout: 5 * 60 * 1000 },
    );
    // Envois d'e-mails hors transaction (pas de verrou tenu pendant les appels SMTP), seulement
    // par l'instance qui a obtenu le verrou.
    const retried =
      result.locked && this.communityModeration
        ? await this.communityModeration.retryNotifications(now)
        : { ...NO_RETRY };
    return { ...result, retried, durationMs: Date.now() - started };
  }

  /**
   * `DELETE … WHERE id IN (SELECT id … LIMIT n)` répété jusqu'à épuisement ou jusqu'à la borne
   * par exécution. `table` et `where` sont des fragments construits dans ce fichier uniquement
   * (aucune entrée utilisateur) ; les dates sont passées en paramètres liés.
   */
  private async deleteInBatches(
    tx: Tx,
    table: Prisma.Sql,
    where: Prisma.Sql,
  ): Promise<number> {
    let total = 0;
    while (total < MAINTENANCE_MAX_PER_TABLE) {
      const limit = Math.min(
        MAINTENANCE_BATCH_SIZE,
        MAINTENANCE_MAX_PER_TABLE - total,
      );
      const count = await tx.$executeRaw(
        Prisma.sql`DELETE FROM ${table} WHERE "id" IN (SELECT "id" FROM ${table} WHERE ${where} LIMIT ${limit})`,
      );
      total += count;
      if (count < limit) break;
    }
    return total;
  }
}
