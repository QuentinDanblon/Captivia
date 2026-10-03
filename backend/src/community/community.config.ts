/**
 * Réglages de la communauté lus à chaque appel dans l'environnement (validés au démarrage par
 * Joi, `src/config/env.validation.ts`) : un test peut les modifier sans recréer l'application.
 */

function intEnv(name: string, fallback: number, min: number): number {
  const raw = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(raw) && raw >= min ? raw : fallback;
}

/** Volet communauté actif (`COMMUNITY_ENABLED=true`). Désactivé : toutes les routes → 404. */
export function communityEnabled(): boolean {
  return process.env.COMMUNITY_ENABLED === 'true';
}

/** Signalements distincts à partir desquels un contenu est masqué automatiquement (défaut 3). */
export function hideThreshold(): number {
  return intEnv('COMMUNITY_HIDE_THRESHOLD', 3, 1);
}

/**
 * Ancienneté minimale du compte (jours) pour qu'un signalement compte dans le seuil de masquage
 * automatique (défaut 7). Seuls comptent les signalements de membres (compte non invité, e-mail
 * vérifié, profil communautaire actif) assez anciens : les autres vont en file opérateur, sans
 * masquage. Empêche quelques comptes jetables (invités) de masquer n'importe quel contenu.
 */
export function reportMinAccountAgeDays(): number {
  return intEnv('COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS', 7, 0);
}

/** Publications par compte et par heure (défaut 5). */
export function postsPerHour(): number {
  return intEnv('COMMUNITY_POSTS_PER_HOUR', 5, 1);
}

/** Commentaires par compte et par minute (défaut 5). */
export function commentsPerMinute(): number {
  return intEnv('COMMUNITY_COMMENTS_PER_MINUTE', 5, 1);
}

/** Images téléversées par compte et par heure (défaut 30). */
export function uploadsPerHour(): number {
  return intEnv('COMMUNITY_UPLOADS_PER_HOUR', 30, 1);
}

/** Taille maximale d'une image téléversée, en octets (défaut 8 Mo). */
export function mediaMaxBytes(): number {
  return intEnv('MEDIA_MAX_BYTES', 8 * 1024 * 1024, 1024);
}

/**
 * Point de contact unique (DSA art. 11 et 12) cité dans les notifications de modération.
 * Absent : les notifications renvoient vers le recours dans l'application uniquement.
 */
export function communityContactEmail(): string | null {
  const value = process.env.COMMUNITY_CONTACT_EMAIL?.trim();
  return value ? value : null;
}

/** URL du frontend (liens des notifications), sans barre finale. */
export function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}
