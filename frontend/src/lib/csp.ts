/**
 * Content-Security-Policy et en-têtes de sécurité (W4-08), construits par un module PUR :
 * aucune dépendance (ni Next, ni Node), pour être importé à la fois par next.config.ts (en-têtes
 * HTTP du site), par scripts/build-mobile.mjs (CSP en <meta> de l'app Capacitor) et par les tests.
 *
 * Scripts : le site garde ses pages statiques (SSG / CDN). Next 16 y injecte des scripts inline
 * propres à chaque page (`self.__next_f.push(…)`, charge RSC) : un nonce imposerait le rendu
 * dynamique de toutes les pages, et des hachages ne peuvent pas figurer dans un en-tête fixé
 * avant le build. Le web conserve donc `'unsafe-inline'` pour script-src, sans `'unsafe-eval'` en
 * production. L'app mobile, dont chaque page HTML est connue après l'export, reçoit au contraire
 * les hachages exacts de ses scripts inline (`scriptHashes`) et se passe de `'unsafe-inline'`.
 * Voir docs/DEPLOY.md § Sécurité.
 */

export type CspTarget = 'web' | 'mobile';

export interface CspOptions {
  /** `web` : en-tête HTTP (next.config.ts) ; `mobile` : <meta> de l'export Capacitor. */
  target?: CspTarget;
  /** Développement (`next dev`) : `'unsafe-eval'` (React) et backend local en connect-src. */
  dev?: boolean;
  /** NEXT_PUBLIC_API_URL (seule son origine est retenue). */
  apiUrl?: string | null;
  /** NEXT_PUBLIC_SENTRY_DSN (origine d'ingestion, https uniquement). */
  sentryDsn?: string | null;
  /**
   * NEXT_PUBLIC_MEDIA_BASE_URL : domaine public des images de la communauté (bucket R2,
   * `https://media.<domaine>`), ajouté à img-src. Absent : les images sont servies par l'API
   * (pilote local, `GET /community/media/:key`) et c'est l'origine de l'API qui est autorisée.
   */
  mediaBaseUrl?: string | null;
  /**
   * Hachages des scripts inline de la page (`sha256-…`, sans guillemets). S'ils sont fournis,
   * ils remplacent `'unsafe-inline'` dans script-src (cible mobile).
   */
  scriptHashes?: readonly string[];
}

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Hôtes des photos d'espèces (GET /species/:id/media, médias GBIF / Wikimedia) autorisés en
 * img-src. `pickSpeciesPhoto` (src/lib/species.ts) écarte les photos servies ailleurs, pour ne
 * jamais tenter un chargement que la CSP bloquerait.
 */
export const SPECIES_IMAGE_HOSTS: readonly string[] = [
  'upload.wikimedia.org',
  'inaturalist-open-data.s3.amazonaws.com',
  'static.inaturalist.org',
  'api.gbif.org',
];

/** Origines de la WebView Capacitor (iOS `capacitor://localhost`, Android `https://localhost`). */
export const CAPACITOR_ORIGINS: readonly string[] = ['capacitor://localhost', 'https://localhost'];

/** Backend local / LAN, autorisé en connect-src en développement uniquement. */
const DEV_API_ORIGINS = ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://*:3001'];

function originOf(raw: string | null | undefined, protocols: readonly string[]): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

/** Origine http(s) de l'API, ou `null` si l'URL est absente ou invalide. */
export function apiOrigin(apiUrl: string | null | undefined): string | null {
  return originOf(apiUrl, ['http:', 'https:']);
}

/** Origine d'ingestion Sentry (le DSN contient la clé publique en userinfo, ignorée ici). */
export function sentryOrigin(dsn: string | null | undefined): string | null {
  return originOf(dsn, ['https:']);
}

/**
 * Origine des images de la communauté autorisée en img-src : celle de `mediaBaseUrl` (https, ou
 * http seulement en local), sinon celle de l'API (pilote local du backend). `null` si aucune n'est
 * valide. Partagée par la CSP et par l'affichage (`isAllowedMediaUrl`, src/lib/community.ts).
 */
export function mediaOriginFor(options: { mediaBaseUrl?: string | null; apiUrl?: string | null }): string | null {
  return originOf(options.mediaBaseUrl, ['http:', 'https:']) ?? apiOrigin(options.apiUrl);
}

/** Vrai si l'URL (https) d'une photo distante est servie par un hôte autorisé en img-src. */
export function isAllowedRemoteImage(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && SPECIES_IMAGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/** Directives dans l'ordre d'émission ; une liste vide produit une directive sans valeur. */
export function cspDirectives(options: CspOptions = {}): Array<[string, string[]]> {
  const target = options.target ?? 'web';
  const mobile = target === 'mobile';
  const dev = Boolean(options.dev);
  const api = apiOrigin(options.apiUrl);
  const sentry = sentryOrigin(options.sentryDsn);
  // WebKit ne fait pas toujours correspondre 'self' à un schéma personnalisé : on l'explicite.
  const self = mobile ? ["'self'", ...CAPACITOR_ORIGINS] : ["'self'"];
  const hashes = (options.scriptHashes ?? []).map((hash) => `'${hash}'`);

  const scriptSrc = [...self, ...(hashes.length > 0 ? hashes : ["'unsafe-inline'"]), ...(dev ? ["'unsafe-eval'"] : [])];
  const connectSrc = [...self, ...(api ? [api] : []), ...(sentry ? [sentry] : []), ...(dev ? DEV_API_ORIGINS : [])];
  const media = mediaOriginFor({ mediaBaseUrl: options.mediaBaseUrl, apiUrl: options.apiUrl });
  const imgSrc = [
    ...self,
    'data:',
    'blob:',
    ...SPECIES_IMAGE_HOSTS.map((host) => `https://${host}`),
    ...(media && !SPECIES_IMAGE_HOSTS.some((host) => media === `https://${host}`) ? [media] : []),
  ];

  const directives: Array<[string, string[]]> = [
    ['default-src', self],
    ['script-src', scriptSrc],
    // Attributs `style` émis par React : pas de hachage possible, 'unsafe-inline' reste requis.
    ['style-src', [...self, "'unsafe-inline'"]],
    ['img-src', imgSrc],
    ['font-src', self],
    ['connect-src', connectSrc],
    ['worker-src', self],
    ['manifest-src', self],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  // Ignorée (avec un avertissement en console) lorsqu'elle est livrée par <meta>.
  if (!mobile) directives.push(['frame-ancestors', ["'none'"]]);
  // Pas en développement (http://localhost) ni face à une API en http (elle serait réécrite en https).
  if (!dev && (!api || api.startsWith('https:'))) directives.push(['upgrade-insecure-requests', []]);
  return directives;
}

/** Valeur de l'en-tête (ou de la balise <meta>) Content-Security-Policy. */
export function buildCsp(options: CspOptions = {}): string {
  return cspDirectives(options)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/** Fonctions sensibles refusées au site (la caméra de l'app native passe par Capacitor). */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()';

/** HSTS : deux ans, sous-domaines inclus, sans `preload` (inscription irréversible à décider à part). */
export const HSTS = 'max-age=63072000; includeSubDomains';

/** En-têtes de sécurité du site (toutes les routes), dont la CSP. HSTS en production uniquement. */
export function securityHeaders(options: Omit<CspOptions, 'target' | 'scriptHashes'> = {}): SecurityHeader[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp({ ...options, target: 'web' }) },
    ...(options.dev ? [] : [{ key: 'Strict-Transport-Security', value: HSTS }]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Doublon de frame-ancestors 'none' pour les navigateurs qui ignorent la CSP.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  ];
}
