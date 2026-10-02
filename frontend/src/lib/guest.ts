/**
 * Mode invité (« Essayer sans compte ») : session sans e-mail ni mot de passe.
 *
 * - `POST /auth/guest` crée un invité et renvoie la même paire de jetons qu'une connexion
 *   (access token + refresh token rotatif) : la session suit ensuite les mécanismes habituels
 *   (`tokenStorage`, rafraîchissement de lib/session.ts).
 * - `POST /auth/upgrade` convertit l'invité en compte (même utilisateur, données conservées) et
 *   renvoie une nouvelle paire de jetons.
 * - Les actions réservées aux comptes répondent 403 `{ code: 'GUEST_ACCOUNT', action }`.
 */
import { ApiError, BACKEND_UNAVAILABLE_MESSAGE } from './api';
import { API_URL } from './config';
import { refreshAccessToken } from './session';

export const GUEST_ACCOUNT_CODE = 'GUEST_ACCOUNT';
export const ANIMAL_LIMIT_CODE = 'ANIMAL_LIMIT';

/** Page de création de compte depuis une session invité (sans perte de données). */
export const GUEST_UPGRADE_PATH = '/sauvegarder';

const REQUEST_TIMEOUT_MS = 15_000;

/** Profil renvoyé par /auth/guest, /auth/upgrade, /auth/login… */
export interface SessionUser {
  id: string;
  email: string | null;
  isGuest?: boolean;
  locale: string;
  isPremium: boolean;
  emailVerified?: boolean;
  role?: string;
  createdAt?: string;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken?: string;
  user: SessionUser;
}

export interface UpgradeGuestInput {
  email: string;
  password: string;
  locale?: string;
  acceptTerms: boolean;
  ageConfirmed: boolean;
}

/** Vrai pour une session invité. */
export function isGuestUser(user: { isGuest?: boolean } | null | undefined): boolean {
  return user?.isGuest === true;
}

/** Vrai si l'erreur est un refus « réservé aux comptes » (403 GUEST_ACCOUNT). */
export function isGuestAccountError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === GUEST_ACCOUNT_CODE;
}

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
    });
  } catch {
    throw new ApiError(0, BACKEND_UNAVAILABLE_MESSAGE);
  }
}

async function parse(response: Response): Promise<AuthPayload> {
  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    // corps vide ou non JSON
  }
  if (!response.ok) {
    const { message, code } = (data ?? {}) as { message?: unknown; code?: unknown };
    throw new ApiError(
      response.status,
      typeof message === 'string' && message ? message : `HTTP ${response.status}`,
      typeof code === 'string' ? code : undefined,
    );
  }
  const payload = data as Partial<AuthPayload>;
  if (typeof payload.accessToken !== 'string' || !payload.user) {
    throw new ApiError(response.status, 'Invalid auth response');
  }
  return payload as AuthPayload;
}

/** Ouvre une session invité. 429 = trop de créations depuis ce réseau. */
export async function startGuestSession(locale?: string): Promise<AuthPayload> {
  return parse(await post('/auth/guest', locale ? { locale } : {}));
}

/**
 * Convertit la session invité en compte. Un access token expiré est renouvelé une fois (refresh
 * token rotatif) avant de rejouer la requête. 409 = adresse déjà utilisée (aucune fusion).
 */
export async function upgradeGuestAccount(token: string, input: UpgradeGuestInput): Promise<AuthPayload> {
  let response = await post('/auth/upgrade', input, token);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken(token);
    if (refreshed.ok) response = await post('/auth/upgrade', input, refreshed.accessToken);
  }
  return parse(response);
}

const BANNER_DISMISSED_KEY = 'captivia.guestBannerDismissedAt';
/** Le bandeau « Sauvegardez vos données » masqué réapparaît après 7 jours. */
const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isGuestBannerSnoozed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(BANNER_DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && now - at < BANNER_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeGuestBanner(now = Date.now()): void {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, String(now));
  } catch {
    // stockage indisponible : le bandeau reviendra au prochain chargement
  }
}

const WELCOME_SEEN_KEY = 'captivia.welcomeSeen';

/** Premier lancement de l'app mobile : l'accueil « Essayer sans compte » a-t-il déjà été proposé ? */
export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // ignoré
  }
}
