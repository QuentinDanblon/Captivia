/**
 * Origine publique du site web, utilisable côté client comme côté serveur (aucune dépendance
 * serveur). `NEXT_PUBLIC_SITE_URL` (inlinée au build) ou valeur par défaut.
 */
export const DEFAULT_SITE_URL = 'https://captivia-app.netlify.app';

/** Origine (sans slash final) : `NEXT_PUBLIC_SITE_URL` si c'est une URL http(s) valide, sinon le défaut. */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch {
      // valeur invalide : repli sur la valeur par défaut
    }
  }
  return DEFAULT_SITE_URL;
}

/**
 * URL absolue d'une page du site web, au format des URL publiques (`localePrefix: 'as-needed'` :
 * pas de préfixe pour la locale par défaut). `path` commence par « / » (ex. `/cgu`).
 */
export function webPageUrl(locale: string, path: string, defaultLocale = 'fr'): string {
  const clean = path === '/' ? '' : path;
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${getSiteUrl()}${prefix}${clean || (prefix ? '' : '/')}`;
}
