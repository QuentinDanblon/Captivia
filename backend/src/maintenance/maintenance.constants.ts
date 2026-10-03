/**
 * Durées de conservation appliquées par le job de maintenance (W2-08, LEG-09).
 * Toute modification doit être reportée dans `docs/legal/registre-traitements.md`,
 * `docs/RUNBOOK.md` (§ « Purge et rétention ») et la politique de confidentialité.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Clé du verrou consultatif Postgres du job de maintenance (constante propre au job). */
export const MAINTENANCE_LOCK_KEY = 4_731_202_612;

/** Lignes supprimées par requête DELETE (lots courts : verrous brefs, journal WAL lissé). */
export const MAINTENANCE_BATCH_SIZE = 1000;

/** Borne par table et par exécution (anti-emballement) : le reste part le lendemain. */
export const MAINTENANCE_MAX_PER_TABLE = 50_000;

/** Événements de rappel (`NotificationEvent`) : conservés 90 jours après leur date prévue. */
export const NOTIFICATION_EVENT_RETENTION_DAYS = 90;

/**
 * Refresh tokens : conservés 30 jours après leur expiration ou leur révocation (enquête sur une
 * session suspecte, détection de réutilisation d'un jeton roté), puis supprimés.
 */
export const REFRESH_TOKEN_GRACE_DAYS = 30;

/** Seuil d'inactivité au-delà duquel un COMPTE est signalé (aucune suppression automatique). */
export const INACTIVE_ACCOUNT_MONTHS = 36;

export interface MaintenanceCutoffs {
  /** Jetons de réinitialisation de mot de passe et de vérification d'e-mail : expirés (< now). */
  oneTimeTokensExpiredBefore: Date;
  /** Refresh tokens expirés ou révoqués avant cette date. */
  refreshTokensBefore: Date;
  /** `NotificationEvent.scheduledAt` antérieur à cette date. */
  notificationEventsBefore: Date;
}

/** Calcule les dates limites de purge pour un instant donné (fonction pure, testable). */
export function maintenanceCutoffs(now: Date): MaintenanceCutoffs {
  const t = now.getTime();
  return {
    oneTimeTokensExpiredBefore: new Date(t),
    refreshTokensBefore: new Date(t - REFRESH_TOKEN_GRACE_DAYS * DAY_MS),
    notificationEventsBefore: new Date(
      t - NOTIFICATION_EVENT_RETENTION_DAYS * DAY_MS,
    ),
  };
}
