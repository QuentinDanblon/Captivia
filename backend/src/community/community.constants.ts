import { CommunitySpeciesCategory } from '@prisma/client';

/**
 * Communauté (volet social, phase 1). Constantes partagées par les DTO, les services et les tests.
 * Toute modification d'une borne doit rester alignée sur les CHECK SQL de la migration
 * `20261003050000_community` et sur `docs/legal/registre-traitements.md` (T13).
 */

/**
 * Version des règles de communauté (texte affiché par le frontend). L'incrémenter oblige chaque
 * membre à les accepter de nouveau avant de publier (403 COMMUNITY_RULES_NOT_ACCEPTED).
 */
export const COMMUNITY_RULES_VERSION = '2026-10';

/** Pseudo : 3 à 30 caractères ASCII (lettres, chiffres, « _ », « . »). */
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/** Bornes de longueur (caractères). */
export const POST_BODY_MAX_LENGTH = 2000;
export const COMMENT_BODY_MAX_LENGTH = 1000;
export const REPORT_DETAILS_MAX_LENGTH = 500;
export const MODERATION_STATEMENT_MIN_LENGTH = 10;
export const MODERATION_STATEMENT_MAX_LENGTH = 2000;
export const APPEAL_TEXT_MIN_LENGTH = 10;
export const APPEAL_TEXT_MAX_LENGTH = 2000;

/** Images par publication. */
export const PHOTO_POST_MIN_MEDIA = 1;
export const PHOTO_POST_MAX_MEDIA = 4;
export const QUESTION_POST_MAX_MEDIA = 1;

/** Ancienneté minimale du compte (jours) pour écrire des liens dans un texte. */
export const LINKS_MIN_ACCOUNT_AGE_DAYS = 7;

/** Pagination des fils (curseur). */
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
/** Commentaires racines renvoyés avec le détail d'une publication (la suite par curseur). */
export const COMMENTS_PAGE_SIZE = 50;
/** Réponses renvoyées par commentaire racine (un seul niveau). */
export const REPLIES_PER_COMMENT = 50;

/** Signalements émis par compte et par heure (anti-abus des signalements). */
export const REPORTS_PER_HOUR = 30;

/**
 * Pseudo libéré (changement, départ, suppression du compte) : réservé à son ancien titulaire
 * pendant ce nombre de jours (anti-usurpation).
 */
export const HANDLE_HOLD_DAYS = 60;

/** Notifications de modération en échec : relancées par la maintenance pendant ce délai (jours). */
export const NOTIFICATION_RETRY_DAYS = 7;
/** Notifications relancées au plus par exécution du job de maintenance (par catégorie). */
export const NOTIFICATION_RETRY_MAX_PER_RUN = 200;

/** Délai de recours interne contre une décision (DSA art. 20 : au moins 6 mois). */
export const APPEAL_WINDOW_DAYS = 183;

/** Durée maximale d'une suspension de publication (jours). */
export const SUSPENSION_MAX_DAYS = 365;

/** Médias : largeur maximale après redimensionnement, hauteur maximale (bandes très hautes). */
export const MEDIA_MAX_WIDTH = 1600;
export const MEDIA_MAX_HEIGHT = 4000;
/**
 * Anti « bombe de décompression » : les dimensions sont lues dans l'en-tête (`metadata()`, sans
 * décodage) et refusées au-delà de ces bornes AVANT tout décodage. Un PNG de 10 000 000 × 5 px ne
 * pèse que 146 Ko mais se décode en plusieurs Go.
 */
export const MEDIA_MAX_INPUT_PIXELS = 24_000_000;
/** Largeur ou hauteur source maximale (px). */
export const MEDIA_MAX_INPUT_DIMENSION = 10_000;
/** Rapport maximal entre le grand et le petit côté de l'image source. */
export const MEDIA_MAX_ASPECT_RATIO = 20;
/** Traitements d'image simultanés dans le processus (sémaphore global). */
export const MEDIA_PROCESSING_CONCURRENCY = 2;
/** Téléversements en attente d'un créneau de traitement au plus (au-delà : 503). */
export const MEDIA_PROCESSING_MAX_QUEUE = 16;
/** Durée maximale d'un traitement (s) et de l'attente d'un créneau (ms). */
export const MEDIA_PROCESSING_TIMEOUT_SECONDS = 10;
export const MEDIA_PROCESSING_QUEUE_TIMEOUT_MS = 30_000;
/** Qualité WebP de ré-encodage. */
export const MEDIA_WEBP_QUALITY = 82;
/** Délai de grâce avant qu'une image téléversée et jamais rattachée soit purgée (heures). */
export const ORPHAN_MEDIA_GRACE_HOURS = 24;
/** Images orphelines purgées au plus par exécution du job de maintenance. */
export const ORPHAN_MEDIA_PURGE_MAX_PER_RUN = 1000;

/** Journal de modération et signalements traités : conservation (jours) avant purge. */
export const MODERATION_LOG_RETENTION_DAYS = 365;

/** Catégorie d'espèce (SpeciesProfile.category, en français) → catégorie communautaire. */
export const SPECIES_CATEGORY_MAP: Readonly<
  Record<string, CommunitySpeciesCategory>
> = {
  mammifère: CommunitySpeciesCategory.MAMMAL,
  oiseau: CommunitySpeciesCategory.BIRD,
  reptile: CommunitySpeciesCategory.REPTILE,
  poisson: CommunitySpeciesCategory.FISH,
  amphibien: CommunitySpeciesCategory.AMPHIBIAN,
  arachnide: CommunitySpeciesCategory.ARACHNID,
  insecte: CommunitySpeciesCategory.INSECT,
};

export function toCommunityCategory(
  speciesCategory: string | null | undefined,
): CommunitySpeciesCategory {
  return (
    SPECIES_CATEGORY_MAP[(speciesCategory ?? '').trim().toLowerCase()] ??
    CommunitySpeciesCategory.OTHER
  );
}

/** Codes d'erreur machine (champ `code` des réponses 4xx), stables pour le frontend. */
export const CommunityErrorCode = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  AGE_CONFIRMATION_REQUIRED: 'AGE_CONFIRMATION_REQUIRED',
  PROFILE_REQUIRED: 'COMMUNITY_PROFILE_REQUIRED',
  PROFILE_EXISTS: 'COMMUNITY_PROFILE_EXISTS',
  RULES_NOT_ACCEPTED: 'COMMUNITY_RULES_NOT_ACCEPTED',
  RULES_VERSION_MISMATCH: 'COMMUNITY_RULES_VERSION_MISMATCH',
  SUSPENDED: 'COMMUNITY_SUSPENDED',
  HANDLE_INVALID: 'HANDLE_INVALID',
  HANDLE_RESERVED: 'HANDLE_RESERVED',
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  RATE_LIMITED: 'COMMUNITY_RATE_LIMITED',
  LINKS_NOT_ALLOWED: 'COMMUNITY_LINKS_NOT_ALLOWED',
  INVALID_MEDIA: 'COMMUNITY_INVALID_MEDIA',
  MEDIA_UNSUPPORTED_TYPE: 'MEDIA_UNSUPPORTED_TYPE',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_INVALID_IMAGE: 'MEDIA_INVALID_IMAGE',
  CANNOT_REPORT_OWN: 'COMMUNITY_CANNOT_REPORT_OWN',
  CANNOT_BLOCK_SELF: 'COMMUNITY_CANNOT_BLOCK_SELF',
  BLOCKED: 'COMMUNITY_BLOCKED',
  APPEAL_NOT_ALLOWED: 'COMMUNITY_APPEAL_NOT_ALLOWED',
  MEDIA_BUSY: 'MEDIA_BUSY',
} as const;
