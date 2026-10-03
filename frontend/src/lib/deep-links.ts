/**
 * Universal Links / App Links (W6-09) : conversion d'une URL du site web en route de l'app.
 *
 * Le site publie ses pages en `localePrefix: 'as-needed'` (`/mes-animaux/<id>`, `/en/species/<id>`) ;
 * l'app exporte des routes à query sous `/<locale>/…/` (`/fr/mes-animaux/detail/?id=<id>`, voir
 * `src/lib/platform.ts` et `docs/MOBILE.md` § 3). Fonctions pures, sans dépendance au navigateur.
 */
import { routing } from '../../i18n/routing';
import { DEFAULT_SITE_URL, getSiteUrl } from './site-url';

const LOCALES: readonly string[] = routing.locales;
const DEFAULT_LOCALE: string = routing.defaultLocale;

/** Accueil de l'app (tableau de bord « Aujourd'hui »), cible des chemins inconnus. */
export const APP_HOME_PATH = '/mes-animaux';

/** Pages statiques de l'app ouvertes telles quelles (chemin sans locale). */
const STATIC_ROUTES = new Set([
  '/mes-animaux',
  '/mes-animaux/liste',
  '/agenda',
  '/especes',
  '/magasin',
  '/parametres',
  '/parametres/compte',
  '/parametres/notifications',
  '/parametres/abonnement',
  '/parametres/grade',
  '/login',
  '/register',
  '/forgot-password',
  '/sauvegarder',
]);

/** Paramètres de query conservés, par page (les autres sont ignorés). */
const KEPT_QUERY: Record<string, readonly string[]> = {
  '/especes': ['q', 'groupe'],
  '/reset-password': ['token'],
  '/verifier-email': ['token'],
};

/** Identifiant d'animal, d'espèce ou slug public : caractères d'URL sûrs uniquement. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
/** Jeton de réinitialisation / vérification. */
const SAFE_TOKEN = /^[A-Za-z0-9._~-]{1,512}$/;
/** Ancre de section (`#sante`). */
const SAFE_HASH = /^#[A-Za-z0-9_-]{1,64}$/;

const enc = encodeURIComponent;

export interface DeepLinkOptions {
  /** Locale courante de l'app : utilisée quand l'URL n'en porte pas (site : français sans préfixe). */
  locale?: string;
  /** Hôtes acceptés (défaut : hôte de `NEXT_PUBLIC_SITE_URL`, hôte par défaut, et leurs variantes `www.`). */
  allowedHosts?: readonly string[];
}

/** Hôtes associés à l'app : site public (`NEXT_PUBLIC_SITE_URL`) et domaine par défaut, avec ou sans `www.`. */
export function defaultAllowedHosts(): string[] {
  const hosts = new Set<string>();
  for (const origin of [getSiteUrl(), DEFAULT_SITE_URL]) {
    try {
      const host = new URL(origin).hostname.toLowerCase();
      hosts.add(host);
      hosts.add(host.startsWith('www.') ? host.slice(4) : `www.${host}`);
    } catch {
      // origine invalide : ignorée
    }
  }
  return [...hosts];
}

/**
 * Route de l'app pour un chemin sans locale (`/mes-animaux/detail?id=1`) : préfixe de locale et
 * barre finale, comme les fichiers de l'export statique (`/fr/mes-animaux/detail/?id=1`).
 */
export function appRoute(locale: string, path: string): string {
  const loc = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const queryAt = path.indexOf('?');
  const rawPath = queryAt >= 0 ? path.slice(0, queryAt) : path;
  const query = queryAt >= 0 ? path.slice(queryAt) : '';
  const clean = `/${rawPath.split('/').filter(Boolean).join('/')}`;
  const withSlash = clean === '/' ? '/' : `${clean}/`;
  return `/${loc}${withSlash}${query.length > 1 ? query : ''}`;
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function keptQuery(page: string, params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const name of KEPT_QUERY[page] ?? []) {
    const value = params.get(name);
    if (value === null || value === '') continue;
    if (name === 'token' && !SAFE_TOKEN.test(value)) continue;
    kept.set(name, value.slice(0, 200));
  }
  const qs = kept.toString();
  return qs ? `?${qs}` : '';
}

/** Chemin de l'app (sans locale) pour les segments d'une URL du site, ou null si inconnu. */
function routeForSegments(segments: string[], params: URLSearchParams): string | null {
  const page = `/${segments.join('/')}`;
  const [first, second, third] = segments;

  if (first === 'mes-animaux' && segments.length >= 2 && second !== 'liste') {
    // Formes de l'app déjà converties : /mes-animaux/detail?id= et /mes-animaux/carnet?id=
    if ((second === 'detail' || second === 'carnet') && segments.length === 2) {
      const id = params.get('id');
      if (!id || !SAFE_SEGMENT.test(id)) return null;
      return `/mes-animaux/${second}?id=${enc(id)}`;
    }
    if (!SAFE_SEGMENT.test(second)) return null;
    if (segments.length === 2) return `/mes-animaux/detail?id=${enc(second)}`;
    if (segments.length === 3 && third === 'carnet') return `/mes-animaux/carnet?id=${enc(second)}`;
    return null;
  }

  if (first === 'species' || first === 'animal-public') {
    const name = first === 'species' ? 'id' : 'slug';
    const value = segments.length === 2 ? second : segments.length === 1 ? params.get(name) : null;
    if (!value || !SAFE_SEGMENT.test(value)) return null;
    return `/${first}?${name}=${enc(value)}`;
  }

  if (page === '/reset-password' || page === '/verifier-email') return `${page}${keptQuery(page, params)}`;
  if (STATIC_ROUTES.has(page)) return `${page}${keptQuery(page, params)}`;
  return null;
}

/**
 * Convertit une URL du site (Universal Link iOS / App Link Android) en route de l'app.
 *
 * - `https://<site>/mes-animaux/<id>` → `/fr/mes-animaux/detail/?id=<id>` (locale de l'URL, sinon
 *   `options.locale`, sinon `fr`) ; idem `/species/<id>`, `/animal-public/<slug>`, `/…/carnet`,
 *   `/reset-password?token=`, `/verifier-email?token=`, `/especes` et les pages de l'app ;
 * - chemin inconnu ou paramètre invalide → accueil de l'app (`/<locale>/mes-animaux/`) ;
 * - domaine étranger, schéma non http(s), identifiants dans l'URL ou URL invalide → `null`
 *   (le lien est ignoré).
 */
export function mapWebUrlToAppRoute(url: string, options: DeepLinkOptions = {}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password) return null;
  const allowed = (options.allowedHosts ?? defaultAllowedHosts()).map((h) => h.toLowerCase());
  if (!allowed.includes(parsed.hostname.toLowerCase())) return null;

  const raw = parsed.pathname.split('/').filter(Boolean);
  if (raw[raw.length - 1] === 'index.html') raw.pop();
  const segments: string[] = [];
  for (const segment of raw) {
    const decoded = decodeSegment(segment);
    if (decoded === null) return appRoute(options.locale ?? DEFAULT_LOCALE, APP_HOME_PATH);
    segments.push(decoded);
  }

  const fallbackLocale = options.locale && LOCALES.includes(options.locale) ? options.locale : DEFAULT_LOCALE;
  const locale = segments.length && LOCALES.includes(segments[0]) ? (segments.shift() as string) : fallbackLocale;

  const route = routeForSegments(segments, parsed.searchParams);
  if (!route) return appRoute(locale, APP_HOME_PATH);
  const hash = SAFE_HASH.test(parsed.hash) ? parsed.hash : '';
  return `${appRoute(locale, route)}${hash}`;
}
