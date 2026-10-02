/**
 * Configuration runtime partagée côté navigateur.
 *
 * URL de l'API backend :
 *  1. `NEXT_PUBLIC_API_URL` (injectée au build) — seule source en production ;
 *  2. en développement uniquement, et si la variable est absente : même hôte que
 *     la page, port 3001 (test depuis un téléphone sur le même Wi‑Fi) ;
 *  3. sinon `http://localhost:3001`.
 *
 * Ne jamais déduire l'URL de l'API du `window.location` en production : cela
 * produirait `http://<host>:3001` (mixed content + bloqué par la CSP).
 */

export const DEFAULT_API_URL = 'http://localhost:3001';
const DEV_BACKEND_PORT = '3001';

export interface ApiUrlInputs {
  /** Valeur brute de NEXT_PUBLIC_API_URL. */
  envUrl?: string | null;
  /** Valeur de process.env.NODE_ENV. */
  nodeEnv?: string | null;
  /** window.location.hostname (undefined côté serveur). */
  hostname?: string | null;
}

function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const value = (typeof raw === 'string' ? raw : '').trim();
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    new URL(value);
  } catch {
    return null;
  }
  return value.replace(/\/+$/, '');
}

/** Fonction pure (testable) : calcule l'URL de l'API à partir de l'environnement. */
export function resolveApiUrl({ envUrl, nodeEnv, hostname }: ApiUrlInputs): string {
  const fromEnv = normalizeHttpUrl(envUrl);
  if (fromEnv) return fromEnv;

  if (nodeEnv === 'development' && hostname) {
    const isLoopback =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    if (!isLoopback) {
      // Hôte LAN (IPv4 / nom de machine) : on ne l'utilise que s'il forme une URL valide.
      const candidate = normalizeHttpUrl(`http://${hostname}:${DEV_BACKEND_PORT}`);
      if (candidate) return candidate;
    }
  }

  return DEFAULT_API_URL;
}

export const API_URL: string = resolveApiUrl({
  // Accès statique requis pour que Next.js inline la variable dans le bundle client.
  envUrl: process.env.NEXT_PUBLIC_API_URL,
  nodeEnv: process.env.NODE_ENV,
  hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
});
