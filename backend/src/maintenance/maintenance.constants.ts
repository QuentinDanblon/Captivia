/**
 * Durées de conservation appliquées par le job de maintenance (W2-08, LEG-09).
 * Toute modification doit être reportée dans `docs/legal/registre-traitements.md`,
 * `docs/RUNBOOK.md` (§ « Purge et rétention ») et la politique de confidentialité.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

/**
 * Communauté : journal des décisions de modération et signalements traités (ACTIONED / DISMISSED),
 * conservés 365 jours (motivation des décisions, recours ouvert 6 mois — DSA art. 17 et 20), puis
 * supprimés. Les signalements encore ouverts ne sont jamais purgés.
 */
export const COMMUNITY_MODERATION_RETENTION_DAYS = 365;

/** Communauté : tentatives de téléversement conservées 24 h (limite horaire par compte). */
export const UPLOAD_ATTEMPT_RETENTION_HOURS = 24;

/** Seuil d'inactivité au-delà duquel un COMPTE est signalé (aucune suppression automatique). */
export const INACTIVE_ACCOUNT_MONTHS = 36;

export interface MaintenanceCutoffs {
  /** Jetons de réinitialisation de mot de passe et de vérification d'e-mail : expirés (< now). */
  oneTimeTokensExpiredBefore: Date;
  /** Refresh tokens expirés ou révoqués avant cette date. */
  refreshTokensBefore: Date;
  /** `NotificationEvent.scheduledAt` antérieur à cette date. */
  notificationEventsBefore: Date;
  /** Journal de modération et signalements traités antérieurs à cette date. */
  moderationBefore: Date;
  /** Tentatives de téléversement communautaires antérieures à cette date (24 h). */
  uploadAttemptsBefore: Date;
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
    moderationBefore: new Date(
      t - COMMUNITY_MODERATION_RETENTION_DAYS * DAY_MS,
    ),
    uploadAttemptsBefore: new Date(
      t - UPLOAD_ATTEMPT_RETENTION_HOURS * HOUR_MS,
    ),
  };
}
