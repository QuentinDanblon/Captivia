/**
 * Stockage de la session et rafraîchissement de l'access token (W1-01).
 *
 * - access token JWT (30 min) : `localStorage.token` ;
 * - refresh token opaque (30 j, rotatif) : `localStorage.refreshToken` ;
 * - un seul appel à `/auth/refresh` à la fois (verrou en mémoire + Web Locks entre onglets) :
 *   présenter deux fois le même refresh token ferait révoquer toute la session par le backend.
 */
import { API_URL } from './config';
import { tokenStorage } from './platform';

export const TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_KEY = 'user';

/** Émis après un rafraîchissement réussi : `detail = { accessToken }`. */
export const TOKEN_REFRESHED_EVENT = 'auth:token-refreshed';

const REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_LOCK_NAME = 'captivia-auth-refresh';

/**
 * Accès tolérant (mode privé, stockage bloqué) au stockage de session : localStorage sur le web,
 * Preferences + miroir localStorage sur natif (src/lib/platform.ts, W6-03).
 */
export function readStorage(key: string): string | null {
  try {
    return tokenStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    tokenStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la session reste valable en mémoire pour l'onglet courant.
  }
}

export function removeStorage(key: string) {
  try {
    tokenStorage.removeItem(key);
  } catch {
    // ignoré
  }
}

export type RefreshResult =
  /**
   * `reused` : jeton déjà renouvelé par un autre onglet / une autre requête, renvoyé sans appeler
   * le backend. S'il est refusé à son tour, l'appelant force un vrai refresh (`force`).
   */
  | { ok: true; accessToken: string; reused?: boolean }
  /** `revoked` : la session est définitivement perdue (pas de refresh token, 400/401). */
  | { ok: false; revoked: boolean };

/**
 * Lit la claim `exp` (secondes) d'un JWT sans vérifier la signature (le backend reste l'autorité).
 * Un jeton illisible ou sans `exp` n'est PAS considéré comme expiré.
 */
export function isJwtExpired(token: string, now: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === 'number' && claims.exp * 1000 <= now;
  } catch {
    return false;
  }
}

function emitRefreshed(accessToken: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { accessToken } }));
  }
}

let inFlight: Promise<RefreshResult> | null = null;

async function doRefresh(failedAccessToken?: string, force = false): Promise<RefreshResult> {
  // Un autre onglet (ou une requête plus rapide) a déjà renouvelé la session : on la réutilise,
  // sauf si ce jeton est lui-même expiré (sinon le rejeu échouerait et déconnecterait à tort).
  const current = readStorage(TOKEN_KEY);
  if (
    !force &&
    failedAccessToken &&
    current &&
    current !== failedAccessToken &&
    !isJwtExpired(current)
  ) {
    emitRefreshed(current);
    return { ok: true, accessToken: current, reused: true };
  }
  const refreshToken = readStorage(REFRESH_TOKEN_KEY);
  if (!refreshToken) return { ok: false, revoked: true };

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal:
        typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REFRESH_TIMEOUT_MS) : undefined,
    });
  } catch {
    return { ok: false, revoked: false };
  }
  if (!response.ok) {
    const revoked = response.status === 400 || response.status === 401;
    if (revoked && readStorage(REFRESH_TOKEN_KEY) === refreshToken) {
      removeStorage(REFRESH_TOKEN_KEY);
    }
    return { ok: false, revoked };
  }
  let data: { accessToken?: unknown; refreshToken?: unknown };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return { ok: false, revoked: false };
  }
  if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
    return { ok: false, revoked: false };
  }
  // Déconnexion (ou autre compte) pendant la requête : la session effacée ne doit pas renaître.
  if (readStorage(REFRESH_TOKEN_KEY) !== refreshToken) {
    return { ok: false, revoked: false };
  }
  writeStorage(TOKEN_KEY, data.accessToken);
  writeStorage(REFRESH_TOKEN_KEY, data.refreshToken);
  emitRefreshed(data.accessToken);
  return { ok: true, accessToken: data.accessToken };
}

/**
 * Renouvelle l'access token avec le refresh token stocké (rotation). Les appels concurrents
 * partagent la même requête. `failedAccessToken` : jeton refusé par l'API (s'il a déjà été
 * remplacé entre-temps par un jeton non expiré, celui-ci est renvoyé sans appeler le backend).
 * `force` : ignore ce raccourci (le jeton réutilisé vient d'être refusé à son tour).
 */
export function refreshAccessToken(
  failedAccessToken?: string,
  options: { force?: boolean } = {},
): Promise<RefreshResult> {
  if (inFlight) return inFlight;
  const run = () => doRefresh(failedAccessToken, options.force === true);
  const locks =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: LockManager }).locks
      : undefined;
  const pending: Promise<RefreshResult> =
    locks && typeof locks.request === 'function'
      ? // Une promesse ne s'imbrique jamais à l'exécution : le typage DOM est ici trop large.
        (locks.request(REFRESH_LOCK_NAME, run) as unknown as Promise<RefreshResult>)
      : run();
  inFlight = pending.finally(() => {
    inFlight = null;
  });
  return inFlight;
}
