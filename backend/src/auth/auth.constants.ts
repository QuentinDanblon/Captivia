/** Version courante des CGU / politique de confidentialité acceptée à l'inscription (W2-03). */
export const CURRENT_TERMS_VERSION = '2026-10';

/** Bornes de longueur du mot de passe (register / reset / change). */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Longueur maximale d'une adresse email (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

/** Coût bcrypt utilisé pour les nouveaux hash. */
export const BCRYPT_ROUNDS = 10;

/** Durée de validité d'un lien de réinitialisation (1 h). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Algorithme JWT unique accepté (signature ET vérification). */
export const JWT_ALGORITHM = 'HS256' as const;

/**
 * Normalisation canonique d'une adresse email : trim + minuscules.
 * Toute lecture / écriture de `User.email` DOIT passer par cette fonction
 * (la base l'impose aussi via la contrainte CHECK "User_email_normalized_check").
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Durée de vie d'un access token JWT (W1-01). */
export const ACCESS_TOKEN_TTL = '30m';

/** Durée de validité d'un refresh token (W1-01) : 30 jours, renouvelée à chaque rotation. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Durée de conservation par défaut d'un compte invité inactif (jours) : cf. GUEST_RETENTION_DAYS. */
export const DEFAULT_GUEST_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Durée (jours) après laquelle un invité sans activité est purgé (GuestPurgeService).
 * Variable GUEST_RETENTION_DAYS (validée par Joi : entier 1-3650), défaut 90.
 */
export function guestRetentionDays(): number {
  const raw = Number.parseInt(process.env.GUEST_RETENTION_DAYS ?? '', 10);
  return Number.isInteger(raw) && raw >= 1 ? raw : DEFAULT_GUEST_RETENTION_DAYS;
}

/**
 * Durée de validité d'un refresh token. Un invité n'a ni e-mail ni mot de passe : s'il perd sa
 * session il perd ses données. Son jeton vit donc au moins jusqu'à la purge (rétention invité),
 * renouvelé à chaque rotation comme pour les comptes.
 */
export function refreshTokenTtlMs(isGuest: boolean): number {
  return isGuest
    ? Math.max(REFRESH_TOKEN_TTL_MS, guestRetentionDays() * DAY_MS)
    : REFRESH_TOKEN_TTL_MS;
}

/** Intervalle minimal entre deux écritures de `User.lastActiveAt` pour un même compte. */
export const LAST_ACTIVE_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/** Durée de validité d'un lien de vérification d'e-mail (W2-04) : 24 h. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Délai minimal entre deux envois d'e-mail de vérification pour un même compte (W2-04). */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

/** Plafond d'envois d'e-mails de vérification par compte sur une fenêtre glissante (revue de sécurité). */
export const EMAIL_VERIFICATION_MAX_SENDS = 5;
export const EMAIL_VERIFICATION_SEND_WINDOW_MS = 24 * 60 * 60 * 1000;
