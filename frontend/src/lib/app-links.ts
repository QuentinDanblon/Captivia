/**
 * Fichiers d'association Universal Links (iOS) / App Links (Android) — W6-09.
 *
 * Servis par le site web sous `/.well-known/` et générés au build à partir des variables
 * d'environnement (voir `docs/MOBILE.md` § 8 et `docs/DEPLOY.md`) :
 *
 * | Variable                           | Défaut         | Fichier                           |
 * | ---------------------------------- | -------------- | --------------------------------- |
 * | `APPLE_TEAM_ID`                    | —              | `apple-app-site-association`      |
 * | `IOS_BUNDLE_ID`                    | `app.captivia` | `apple-app-site-association`      |
 * | `ANDROID_PACKAGE_NAME`             | `app.captivia` | `assetlinks.json`                 |
 * | `ANDROID_SHA256_CERT_FINGERPRINTS` | —              | `assetlinks.json` (liste, virgules) |
 *
 * Valeur manquante ou invalide → `null` (la route répond 404) : jamais de fichier invalide, qu'Apple
 * ou Google mettraient en cache et qui casserait la vérification.
 */

export const DEFAULT_IOS_BUNDLE_ID = 'app.captivia';
export const DEFAULT_ANDROID_PACKAGE_NAME = 'app.captivia';

export interface AppLinksEnv {
  APPLE_TEAM_ID?: string;
  IOS_BUNDLE_ID?: string;
  ANDROID_PACKAGE_NAME?: string;
  ANDROID_SHA256_CERT_FINGERPRINTS?: string;
}

/**
 * Chemins du site ouverts dans l'app (sans locale ; chaque chemin est aussi déclaré sous
 * `/<locale>/`). Les autres pages (landing, pages légales…) restent dans le navigateur.
 */
export const APP_LINK_PATHS = [
  '/mes-animaux',
  '/mes-animaux/*',
  '/animal-public/*',
  '/species/*',
  '/especes',
  '/reset-password',
  '/verifier-email',
] as const;

const TEAM_ID = /^[A-Z0-9]{10}$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const ANDROID_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const LOCALE = /^[a-z]{2}(-[A-Za-z]{2})?$/;

const clean = (value: string | undefined): string => (value ?? '').trim();

/** Empreinte SHA-256 au format attendu (`AA:BB:…`, 32 octets, majuscules), ou null. */
export function normalizeFingerprint(raw: string): string | null {
  const hex = raw.trim().replace(/:/g, '').toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  // Séparateurs incohérents (« AA:BBCC… ») refusés : soit 32 octets séparés, soit 64 caractères.
  if (raw.includes(':') && !/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(raw.trim())) return null;
  return hex.match(/.{2}/g)!.join(':');
}

/**
 * Liste d'empreintes (virgules, points-virgules, espaces ou retours à la ligne). Null si vide ou si
 * une seule est invalide. Doublons retirés.
 */
export function parseFingerprints(raw: string | undefined): string[] | null {
  const parts = clean(raw)
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  const out: string[] = [];
  for (const part of parts) {
    const fp = normalizeFingerprint(part);
    if (!fp) return null;
    if (!out.includes(fp)) out.push(fp);
  }
  return out;
}

/** `apple-app-site-association` (format `applinks.details[].components`, iOS 13+), ou null. */
export function buildAppleAppSiteAssociation(env: AppLinksEnv, locales: readonly string[]) {
  const teamId = clean(env.APPLE_TEAM_ID);
  const bundleId = clean(env.IOS_BUNDLE_ID) || DEFAULT_IOS_BUNDLE_ID;
  if (!TEAM_ID.test(teamId) || !BUNDLE_ID.test(bundleId)) return null;
  const prefixes = ['', ...locales.filter((l) => LOCALE.test(l)).map((l) => `/${l}`)];
  const components = prefixes.flatMap((prefix) => APP_LINK_PATHS.map((path) => ({ '/': `${prefix}${path}` })));
  return {
    applinks: {
      details: [{ appIDs: [`${teamId}.${bundleId}`], components }],
    },
  };
}

/** `assetlinks.json` (Digital Asset Links), ou null. */
export function buildAssetLinks(env: AppLinksEnv) {
  const packageName = clean(env.ANDROID_PACKAGE_NAME) || DEFAULT_ANDROID_PACKAGE_NAME;
  const fingerprints = parseFingerprints(env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (!ANDROID_PACKAGE.test(packageName) || !fingerprints) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

export interface WellKnownPayload {
  status: 200 | 404;
  headers: Record<string, string>;
  body: string;
}

/** Contenu d'une route `/.well-known/…` : JSON valide, ou 404 sans contenu exploitable. */
export function wellKnownPayload(body: unknown): WellKnownPayload {
  if (body === null || body === undefined) {
    return {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'Not Found',
    };
  }
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    body: JSON.stringify(body),
  };
}

export function wellKnownResponse(body: unknown): Response {
  const { status, headers, body: text } = wellKnownPayload(body);
  return new Response(text, { status, headers });
}

/** Variables lues au build (accès littéraux : rien n'est exposé au navigateur). */
export function readAppLinksEnv(): AppLinksEnv {
  return {
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    IOS_BUNDLE_ID: process.env.IOS_BUNDLE_ID,
    ANDROID_PACKAGE_NAME: process.env.ANDROID_PACKAGE_NAME,
    ANDROID_SHA256_CERT_FINGERPRINTS: process.env.ANDROID_SHA256_CERT_FINGERPRINTS,
  };
}
