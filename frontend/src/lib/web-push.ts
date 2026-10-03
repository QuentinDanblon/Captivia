/**
 * Web Push côté navigateur (W3-03) : enregistrement du service worker, abonnement
 * (`pushManager.subscribe` avec la clé VAPID du backend) et désinscription.
 *
 * Web uniquement : sur l'app native (Capacitor), le push passe par les services natifs
 * (W6) et aucun service worker n'est enregistré. Rien ici ne s'exécute au chargement :
 * le service worker n'est enregistré qu'à la première activation par l'utilisateur
 * (la permission est demandée sur un clic, jamais automatiquement).
 */
import { authFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';

export const SERVICE_WORKER_URL = '/sw.js';

/** Avec ou sans abonnement actif dans CE navigateur, et pourquoi pas le cas échéant. */
export type PushStatus =
  | 'unsupported' // navigateur sans Service Worker / Push / Notification, ou app native
  | 'unavailable' // backend sans clés VAPID (clé publique absente)
  | 'denied' // permission refusée dans le navigateur
  | 'subscribed'
  | 'unsubscribed';

export type SubscribeResult =
  | { status: 'subscribed' }
  | { status: 'denied' | 'dismissed' | 'unavailable' | 'unsupported' | 'error' };

/** true si l'environnement est l'app native Capacitor (pas de Web Push). */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isNativeApp()) return false;
  return (
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  );
}

/** Clé VAPID (base64url) → Uint8Array attendue par `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Clé publique VAPID du backend, ou null si le push n'y est pas configuré (ou injoignable). */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/notifications/vapid-public-key`);
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: unknown };
    return typeof data.publicKey === 'string' && data.publicKey.length > 0
      ? data.publicKey
      : null;
  } catch {
    return null;
  }
}

/** Abonnement push actif de ce navigateur (sans enregistrer de service worker). */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Compare la clé du navigateur à la clé VAPID attendue (changement de paire côté serveur). */
function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true; // non exposé par le navigateur : on ne peut pas comparer
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function sendToBackend(
  token: string,
  method: 'POST' | 'DELETE',
  body: unknown,
): Promise<boolean> {
  try {
    // authFetch : jeton expiré → refresh puis rejeu (W1-01).
    const res = await authFetch(`${API_URL}/users/me/push-subscriptions`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * true si l'endpoint figure parmi les abonnements du compte connecté, false s'il n'y figure pas
 * (abonnement laissé par un autre compte sur ce navigateur), null si la liste est indisponible.
 */
async function isEndpointOwned(token: string, endpoint: string): Promise<boolean | null> {
  try {
    const res = await authFetch(`${API_URL}/users/me/push-subscriptions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const list = (await res.json()) as unknown;
    if (!Array.isArray(list)) return null;
    return list.some((s) => (s as { endpoint?: unknown } | null)?.endpoint === endpoint);
  } catch {
    return null;
  }
}

/**
 * Détermine l'état initial affiché sur la page : support, clé serveur, permission, abonnement.
 * `publicKey` est celle déjà récupérée par l'appelant (null = push non configuré côté serveur).
 * Avec `token`, l'abonnement du navigateur n'est « subscribed » que s'il appartient au compte
 * connecté (sinon il peut s'agir de celui d'un autre compte utilisé sur ce navigateur).
 */
export async function resolvePushStatus(
  publicKey: string | null,
  token?: string | null,
): Promise<PushStatus> {
  if (!isWebPushSupported()) return 'unsupported';
  if (!publicKey) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    const sub = await getCurrentSubscription();
    if (sub && sameKey(sub, publicKey)) {
      if (token && (await isEndpointOwned(token, sub.endpoint)) === false) return 'unsubscribed';
      return 'subscribed';
    }
  }
  return 'unsubscribed';
}

/**
 * Active les notifications. À appeler DIRECTEMENT depuis un gestionnaire de clic :
 * `Notification.requestPermission()` est le premier appel asynchrone (Safari exige le geste).
 * `publicKey` doit avoir été récupérée à l'avance (`fetchVapidPublicKey`).
 */
export async function subscribeToPush(
  token: string,
  publicKey: string | null,
): Promise<SubscribeResult> {
  if (!isWebPushSupported()) return { status: 'unsupported' };
  if (!publicKey) return { status: 'unavailable' };

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { status: 'denied' };
    if (permission !== 'granted') return { status: 'dismissed' };

    await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameKey(subscription, publicKey)) {
      // Paire VAPID changée côté serveur : l'ancien abonnement ne fonctionnera plus.
      await sendToBackend(token, 'DELETE', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      subscription = null;
    }
    const created = subscription === null;
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    const ok = await sendToBackend(token, 'POST', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
    if (!ok) {
      // Le serveur ne connaît pas cet abonnement : on ne garde pas un abonnement orphelin.
      if (created) await subscription.unsubscribe().catch(() => false);
      return { status: 'error' };
    }
    return { status: 'subscribed' };
  } catch {
    return { status: 'error' };
  }
}

/** Désactive les notifications de ce navigateur (serveur puis navigateur). */
export async function unsubscribeFromPush(token: string): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) return true;
    // Un échec serveur n'empêche pas la désinscription locale : l'abonnement orphelin est
    // purgé par le backend à la première réponse 404/410.
    await sendToBackend(token, 'DELETE', { endpoint: subscription.endpoint });
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
}
