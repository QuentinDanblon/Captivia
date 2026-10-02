/**
 * Stockage de la session et rafraîchissement de l'access token (W1-01).
 *
 * - access token JWT (30 min) : `localStorage.token` ;
 * - refresh token opaque (30 j, rotatif) : `localStorage.refreshToken` ;
 * - un seul appel à `/auth/refresh` à la fois (verrou en mémoire + Web Locks entre onglets) :
 *   présenter deux fois le même refresh token ferait révoquer toute la session par le backend.
 */
import { API_URL } from './config';

export const TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_KEY = 'user';

/** Émis après un rafraîchissement réussi : `detail = { accessToken }`. */
export const TOKEN_REFRESHED_EVENT = 'auth:token-refreshed';

const REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_LOCK_NAME = 'captivia-auth-refresh';

/** Accès localStorage tolérant (mode privé, stockage bloqué). */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la session reste valable en mémoire pour l'onglet courant.
  }
}

export function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignoré
  }
}

export type RefreshResult =
  | { ok: true; accessToken: string }
  /** `revoked` : la session est définitivement perdue (pas de refresh token, 400/401). */
  | { ok: false; revoked: boolean };

let inFlight: Promise<RefreshResult> | null = null;

async function doRefresh(failedAccessToken?: string): Promise<RefreshResult> {
  // Un autre onglet (ou une requête plus rapide) a déjà renouvelé la session : on la réutilise.
  const current = readStorage(TOKEN_KEY);
  if (failedAccessToken && current && current !== failedAccessToken) {
    return { ok: true, accessToken: current };
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
  writeStorage(TOKEN_KEY, data.accessToken);
  writeStorage(REFRESH_TOKEN_KEY, data.refreshToken);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { accessToken: data.accessToken } }),
    );
  }
  return { ok: true, accessToken: data.accessToken };
}

/**
 * Renouvelle l'access token avec le refresh token stocké (rotation). Les appels concurrents
 * partagent la même requête. `failedAccessToken` : jeton refusé par l'API (s'il a déjà été
 * remplacé entre-temps, le nouveau est renvoyé sans appeler le backend).
 */
export function refreshAccessToken(failedAccessToken?: string): Promise<RefreshResult> {
  if (inFlight) return inFlight;
  const run = () => doRefresh(failedAccessToken);
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
