/**
 * Push natif dans l'app (W6-07) : Firebase Cloud Messaging sur Android, APNs relayé par FCM sur iOS.
 *
 * - Le jeton FCM de l'installation est envoyé à l'API (`POST /users/me/device-tokens`) avec la
 *   plateforme, la langue et la fin de la couverture des rappels locaux (W6-06) : le serveur ne
 *   renvoie pas en push un soin déjà programmé sur le téléphone.
 * - Jamais de demande de permission ici : l'autorisation est celle des notifications locales
 *   (une seule autorisation système), demandée après une explication (`NotificationPrimer`) ou
 *   depuis les paramètres. Sans autorisation, rien n'est enregistré.
 * - Rafraîchissement : FCM peut changer le jeton (événement `registration` spontané) ; le nouveau
 *   est renvoyé avec `previousToken`. L'app réenregistre aussi le jeton à chaque synchronisation
 *   (lancement, retour au premier plan), ce qui tient `lastSeenAt` à jour côté serveur.
 * - Déconnexion, rappels coupés sur l'appareil : le jeton est retiré du compte.
 * - Notification touchée : `pushNotificationRoute` donne la page à ouvrir (fiche de l'animal).
 *
 * Plugin importé à la demande : rien dans le bundle web, aucun effet hors de l'app native.
 */
import { authFetch } from './api';
import { API_URL } from './config';
import type { SyncResult } from './local-reminders';
import { animalDetailPath, getPlatform, isNative, tokenStorage } from './platform';

/** Marque des notifications distantes Captivia (`data.kind`, posée par l'API). */
export const NATIVE_PUSH_KIND = 'captivia-push';
/** Jeton FCM enregistré pour cette installation (Preferences + miroir localStorage). */
export const PUSH_TOKEN_KEY = 'captivia.push.token';
/** Délai maximal d'obtention du jeton auprès de FCM / APNs. */
export const REGISTRATION_TIMEOUT_MS = 15_000;

const DEVICE_TOKENS_URL = () => `${API_URL}/users/me/device-tokens`;

type PushApi = typeof import('@capacitor/push-notifications').PushNotifications;
const loadPush = (): Promise<PushApi> => import('@capacitor/push-notifications').then((m) => m.PushNotifications);

export interface PushSession {
  /** Jeton d'accès de l'API. */
  authToken: string;
  /** Langue de l'app (notifications rédigées dans cette langue côté serveur). */
  locale: string;
  /** Fin de la couverture locale ; null : aucune ; absent : inchangée côté serveur. */
  coveredUntil?: Date | null;
}

export type PushRegisterOutcome = 'registered' | 'unsupported' | 'no-permission' | 'error';

/** Session courante : le rafraîchissement spontané du jeton l'utilise pour le renvoyer. */
let session: PushSession | null = null;
let listeners: Promise<void> | null = null;
let waiter: { resolve: (token: string) => void; reject: (error: unknown) => void } | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** Jeton FCM enregistré sur cette installation (lecture synchrone : corps de `/auth/logout`). */
export function currentNativePushToken(): string | null {
  try {
    return tokenStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function rememberToken(token: string | null): void {
  try {
    if (token) tokenStorage.setItem(PUSH_TOKEN_KEY, token);
    else tokenStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // stockage indisponible : le serveur purgera l'ancien jeton (UNREGISTERED) le moment venu
  }
}

async function postToken(token: string, current: PushSession): Promise<boolean> {
  const platform = getPlatform();
  if (platform === 'web') return false;
  const previous = currentNativePushToken();
  const body: Record<string, unknown> = { token, platform, locale: current.locale };
  if (current.coveredUntil !== undefined) {
    body.localRemindersUntil = current.coveredUntil ? current.coveredUntil.toISOString() : null;
  }
  if (previous && previous !== token) body.previousToken = previous;
  try {
    const res = await authFetch(DEVICE_TOKENS_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.authToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    rememberToken(token);
    return true;
  } catch {
    return false;
  }
}

function ensureListeners(push: PushApi): Promise<void> {
  listeners ??= (async () => {
    await push.addListener('registration', ({ value }) => {
      if (waiter) {
        waiter.resolve(value);
        waiter = null;
      } else if (session && value) {
        // Jeton renouvelé par FCM en cours de route : on le transmet aussitôt.
        void postToken(value, session);
      }
    });
    await push.addListener('registrationError', ({ error }) => {
      waiter?.reject(new Error(error));
      waiter = null;
    });
  })().catch((error: unknown) => {
    listeners = null;
    throw error;
  });
  return listeners;
}

function obtainToken(push: PushApi): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiter = null;
      reject(new Error('push registration timeout'));
    }, REGISTRATION_TIMEOUT_MS);
    waiter = {
      resolve: (token) => {
        clearTimeout(timer);
        resolve(token);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    };
    push.register().catch((error: unknown) => waiter?.reject(error));
  });
}

async function doRegister(next: PushSession): Promise<PushRegisterOutcome> {
  if (!isNative() || getPlatform() === 'web') return 'unsupported';
  let push: PushApi;
  try {
    push = await loadPush();
  } catch {
    return 'unsupported';
  }
  try {
    const { receive } = await push.checkPermissions();
    if (receive !== 'granted') return 'no-permission';
    session = next;
    await ensureListeners(push);
    const token = await obtainToken(push);
    return (await postToken(token, next)) ? 'registered' : 'error';
  } catch {
    // Plugin non synchronisé, Firebase absent (google-services.json / GoogleService-Info.plist),
    // réseau : les rappels locaux continuent de fonctionner.
    return 'error';
  }
}

/**
 * Enregistre cette installation pour le push du compte connecté (sans jamais demander la
 * permission). Appels sérialisés (lancement, premier plan et paramètres peuvent se chevaucher).
 */
export function registerNativePush(next: PushSession): Promise<PushRegisterOutcome> {
  const run = chain.then(
    () => doRegister(next),
    () => doRegister(next),
  );
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Retire le jeton de cette installation du compte (rappels coupés, déconnexion) et l'oublie.
 * `authToken` null : oubli local seulement (session déjà perdue). N'échoue jamais.
 */
export async function unregisterNativePush(authToken: string | null): Promise<void> {
  session = null;
  const token = currentNativePushToken();
  if (!token) return;
  rememberToken(null);
  if (!isNative() || !authToken) return;
  try {
    await authFetch(
      DEVICE_TOKENS_URL(),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token }),
      },
      // Pendant une déconnexion : ni rafraîchissement ni événement de déconnexion en cascade.
      { logoutOn401: false },
    );
  } catch {
    // best effort : FCM finira par signaler le jeton périmé, ou le prochain compte le reprendra
  }
}

/** Session terminée sans appel serveur possible : plus de renvoi spontané du jeton. */
export function forgetNativePushSession(): void {
  session = null;
}

/**
 * Suite d'une synchronisation des rappels locaux : enregistre le push quand les rappels sont
 * actifs et autorisés, le retire s'ils sont coupés ou si la permission a été retirée.
 */
export async function syncNativePush(result: SyncResult, current: Omit<PushSession, 'coveredUntil'>): Promise<void> {
  if (!isNative()) return;
  if (result.outcome === 'scheduled') {
    await registerNativePush({
      ...current,
      ...(result.coveredUntil ? { coveredUntil: result.coveredUntil } : {}),
    });
  } else if (result.outcome === 'disabled' || result.outcome === 'no-permission') {
    await unregisterNativePush(current.authToken);
  }
}

/**
 * Page à ouvrir quand une notification distante Captivia est touchée (chemin sans locale) :
 * fiche de l'animal concerné, sinon l'agenda. null pour une notification étrangère.
 */
export function pushNotificationRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const { kind, animalId } = data as { kind?: unknown; animalId?: unknown };
  if (kind !== NATIVE_PUSH_KIND) return null;
  return typeof animalId === 'string' && animalId ? animalDetailPath(animalId) : '/agenda';
}

/** Tests uniquement : remet l'état du module à zéro. */
export function __resetNativePushForTests(): void {
  session = null;
  listeners = null;
  waiter = null;
  chain = Promise.resolve();
}
