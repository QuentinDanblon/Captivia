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
