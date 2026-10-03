import type { MetadataRoute } from 'next';
import { routing } from '../../i18n/routing';
import { getSiteUrl, languageAlternates, localizedPath } from '@/lib/seo';

/**
 * Pages publiques indexables ('' = accueil). Les pages privées (connexion, inscription,
 * mes-animaux, paramètres, animal-public) sont volontairement absentes : elles sont `noindex`.
 */
const PUBLIC_PATHS = [
  '',
  '/magasin',
  '/transparency',
  '/cgu',
  '/confidentialite',
  '/mentions-legales',
  '/sources-et-licences',
  '/suppression-compte',
];

const absolute = (site: string, relative: string) => `${site}${relative === '/' ? '' : relative}`;

function entriesFor(path: string): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const languages = Object.fromEntries(
    Object.entries(languageAlternates(path)).map(([lang, rel]) => [lang, absolute(site, rel)]),
  );
  return routing.locales.map((locale) => ({
    url: absolute(site, localizedPath(locale, path)),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap(entriesFor);
}

/*
 * TODO (plus tard) : lister les 1 500+ fiches espèces. À activer quand l'API exposera un endpoint
 * léger d'identifiants (ex. GET /species/ids) ; passer alors à `export default async function`
 * et, au-delà de 50 000 URL (6 locales × fiches), découper avec `generateSitemaps()`.
 *
 * async function speciesEntries(): Promise<MetadataRoute.Sitemap> {
 *   const res = await fetch(`${API_URL}/species/ids`, { next: { revalidate: 86400 } });
 *   if (!res.ok) return [];
 *   const ids: Array<number | string> = await res.json();
 *   return ids.flatMap((id) => entriesFor(`/species/${id}`));
 * }
 */
