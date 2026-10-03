import { API_URL } from '../config';
import {
  fetchVapidPublicKey,
  isWebPushSupported,
  resolvePushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  urlBase64ToUint8Array,
} from '../web-push';

// Clé publique VAPID d'exemple (65 octets, base64url).
const PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

type FakeSubscription = {
  endpoint: string;
  options?: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => unknown;
  unsubscribe: jest.Mock;
};

const makeSubscription = (
  endpoint: string,
  key: string | null = PUBLIC_KEY,
): FakeSubscription => ({
  endpoint,
  options: { applicationServerKey: key ? urlBase64ToUint8Array(key).buffer : null },
  toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
  unsubscribe: jest.fn().mockResolvedValue(true),
});

const setup = (permission: NotificationPermission = 'default') => {
  const state: { current: FakeSubscription | null } = { current: null };
  const pushManager = {
    getSubscription: jest.fn(async () => state.current),
    subscribe: jest.fn(async () => {
      state.current = makeSubscription('https://push.example.com/new');
      return state.current;
    }),
  };
  const registration = { pushManager };
  const serviceWorker = {
    register: jest.fn().mockResolvedValue(registration),
    getRegistration: jest.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: serviceWorker,
    configurable: true,
  });
  Object.defineProperty(window, 'PushManager', { value: function () {}, configurable: true });
  const requestPermission = jest.fn(async () => permission);
  Object.defineProperty(window, 'Notification', {
    value: { permission, requestPermission },
    configurable: true,
    writable: true,
  });
  return { state, pushManager, serviceWorker, requestPermission };
};

const teardown = () => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(window, 'PushManager');
  Reflect.deleteProperty(window, 'Notification');
  Reflect.deleteProperty(window, 'Capacitor');
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});
afterEach(teardown);

describe('urlBase64ToUint8Array', () => {
  it('décode le base64url (alphabet - _ et padding manquant)', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(urlBase64ToUint8Array(PUBLIC_KEY)).toHaveLength(65);
  });
});

describe('isWebPushSupported', () => {
  it('false sans Service Worker / Push / Notification', () => {
    expect(isWebPushSupported()).toBe(false);
  });

  it('true dans un navigateur compatible', () => {
    setup();
    expect(isWebPushSupported()).toBe(true);
  });

  it("false dans l'app native (Capacitor)", () => {
    setup();
    Object.defineProperty(window, 'Capacitor', {
      value: { isNativePlatform: () => true },
      configurable: true,
    });
    expect(isWebPushSupported()).toBe(false);
  });
});

describe('fetchVapidPublicKey', () => {
  it('renvoie la clé du backend', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ publicKey: PUBLIC_KEY }) });
    await expect(fetchVapidPublicKey()).resolves.toBe(PUBLIC_KEY);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/notifications/vapid-public-key`);
  });

  it('renvoie null si le push est désactivé, la réponse invalide ou le réseau en échec', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: null }) });
    await expect(fetchVapidPublicKey()).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(fetchVapidPublicKey()).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchVapidPublicKey()).resolves.toBeNull();
  });
});

describe('resolvePushStatus', () => {
  it('unsupported sans API navigateur', async () => {
    await expect(resolvePushStatus(PUBLIC_KEY)).resolves.toBe('unsupported');
  });

  it('unavailable sans clé serveur', async () => {
    setup();
    await expect(resolvePushStatus(null)).resolves.toBe('unavailable');
  });

  it('denied si la permission est refusée', async () => {
    setup('denied');
    await expect(resolvePushStatus(PUBLIC_KEY)).resolves.toBe('denied');
  });

  it('unsubscribed si la permission est accordée mais sans abonnement', async () => {
    setup('granted');
    await expect(resolvePushStatus(PUBLIC_KEY)).resolves.toBe('unsubscribed');
  });

  it('subscribed si un abonnement existe avec la bonne clé', async () => {
    const env = setup('granted');
    env.state.current = makeSubscription('https://push.example.com/a');
    await expect(resolvePushStatus(PUBLIC_KEY)).resolves.toBe('subscribed');
  });

  it("unsubscribed si l'abonnement existant utilise une autre clé VAPID", async () => {
    const env = setup('granted');
    env.state.current = makeSubscription(
      'https://push.example.com/a',
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    );
    await expect(resolvePushStatus(PUBLIC_KEY)).resolves.toBe('unsubscribed');
  });

  it('avec jeton : subscribed seulement si l’endpoint appartient au compte connecté', async () => {
    const env = setup('granted');
    env.state.current = makeSubscription('https://push.example.com/a');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ endpoint: 'https://push.example.com/a' }],
    });
    await expect(resolvePushStatus(PUBLIC_KEY, 'tok')).resolves.toBe('subscribed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/push-subscriptions`);
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('avec jeton : abonnement d’un autre compte sur ce navigateur → unsubscribed', async () => {
    const env = setup('granted');
    env.state.current = makeSubscription('https://push.example.com/a');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ endpoint: 'https://push.example.com/other' }],
    });
    await expect(resolvePushStatus(PUBLIC_KEY, 'tok')).resolves.toBe('unsubscribed');
  });

  it('avec jeton : liste indisponible → on garde subscribed (état du navigateur)', async () => {
    const env = setup('granted');
    env.state.current = makeSubscription('https://push.example.com/a');
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(resolvePushStatus(PUBLIC_KEY, 'tok')).resolves.toBe('subscribed');
  });
});

describe('subscribeToPush', () => {
  it('permission refusée : ni service worker, ni abonnement, ni appel API', async () => {
    const env = setup('denied');
    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'denied' });
    expect(env.serviceWorker.register).not.toHaveBeenCalled();
    expect(env.pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fenêtre de permission fermée sans choix : dismissed', async () => {
    const env = setup('default');
    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'dismissed' });
    expect(env.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('sans clé serveur : unavailable, la permission n’est pas demandée', async () => {
    const env = setup('granted');
    await expect(subscribeToPush('tok', null)).resolves.toEqual({ status: 'unavailable' });
    expect(env.requestPermission).not.toHaveBeenCalled();
  });

  it('enregistre /sw.js, s’abonne avec la clé VAPID et envoie l’abonnement au backend', async () => {
    const env = setup('granted');

    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'subscribed' });

    expect(env.requestPermission).toHaveBeenCalledTimes(1);
    expect(env.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    const subscribeArgs = (
      env.pushManager.subscribe.mock.calls as unknown as [
        { userVisibleOnly: boolean; applicationServerKey: Uint8Array },
      ][]
    )[0][0];
    expect(subscribeArgs.userVisibleOnly).toBe(true);
    expect(Array.from(subscribeArgs.applicationServerKey)).toEqual(
      Array.from(urlBase64ToUint8Array(PUBLIC_KEY)),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/push-subscriptions`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
  });

  it('réutilise l’abonnement existant (même clé) sans en créer un nouveau', async () => {
    const env = setup('granted');
    env.state.current = makeSubscription('https://push.example.com/existing');

    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'subscribed' });

    expect(env.pushManager.subscribe).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).endpoint).toBe(
      'https://push.example.com/existing',
    );
  });

  it('paire VAPID changée : supprime l’ancien abonnement (serveur + navigateur) puis se réabonne', async () => {
    const env = setup('granted');
    const old = makeSubscription(
      'https://push.example.com/old',
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    );
    env.state.current = old;

    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'subscribed' });

    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      endpoint: 'https://push.example.com/old',
    });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(env.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('échec backend : annule l’abonnement navigateur créé et renvoie error', async () => {
    const env = setup('granted');
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'error' });

    expect(env.state.current?.unsubscribe).toHaveBeenCalled();
  });

  it('échec de pushManager.subscribe : error', async () => {
    const env = setup('granted');
    env.pushManager.subscribe.mockRejectedValue(new Error('AbortError'));
    await expect(subscribeToPush('tok', PUBLIC_KEY)).resolves.toEqual({ status: 'error' });
  });
});

describe('unsubscribeFromPush', () => {
  it('prévient le backend puis désabonne le navigateur', async () => {
    const env = setup('granted');
    const sub = makeSubscription('https://push.example.com/a');
    env.state.current = sub;

    await expect(unsubscribeFromPush('tok')).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/push-subscriptions`);
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ endpoint: 'https://push.example.com/a' });
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('désabonne quand même le navigateur si le backend est injoignable', async () => {
    const env = setup('granted');
    const sub = makeSubscription('https://push.example.com/a');
    env.state.current = sub;
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(unsubscribeFromPush('tok')).resolves.toBe(true);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('rien à faire sans abonnement', async () => {
    setup('granted');
    await expect(unsubscribeFromPush('tok')).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
