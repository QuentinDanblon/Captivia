// --- Plugin et dépendances mockés -------------------------------------------------
type Handler = (payload: never) => void;
const pushListeners = new Map<string, Handler>();
const plugin = {
  permission: 'granted' as string,
  /** Jetons renvoyés successivement par `register()` (événement `registration`). */
  tokens: [] as string[],
  registrationError: null as string | null,
  checkPermissions: jest.fn(async () => ({ receive: plugin.permission })),
  requestPermissions: jest.fn(async () => ({ receive: plugin.permission })),
  register: jest.fn(async () => {
    setTimeout(() => {
      if (plugin.registrationError) {
        (pushListeners.get('registrationError') as (p: { error: string }) => void)?.({ error: plugin.registrationError });
      } else {
        (pushListeners.get('registration') as (p: { value: string }) => void)?.({ value: plugin.tokens.shift() ?? 'tok' });
      }
    }, 0);
  }),
  addListener: jest.fn(async (name: string, fn: Handler) => {
    pushListeners.set(name, fn);
    return { remove: async () => void pushListeners.delete(name) };
  }),
};
jest.mock('@capacitor/push-notifications', () => ({ PushNotifications: plugin }));

const mockIsNative = jest.fn(() => true);
const mockPlatform = jest.fn(() => 'android');
jest.mock('../platform', () => ({
  isNative: () => mockIsNative(),
  getPlatform: () => mockPlatform(),
  animalDetailPath: (id: string) => `/mes-animaux/detail?id=${encodeURIComponent(id)}`,
  tokenStorage: {
    getItem: (k: string) => localStorage.getItem(k),
    setItem: (k: string, v: string) => localStorage.setItem(k, v),
    removeItem: (k: string) => localStorage.removeItem(k),
  },
}));
jest.mock('../config', () => ({ API_URL: 'https://api.test' }));

const mockAuthFetch = jest.fn(async (..._args: unknown[]) => ({ ok: true, status: 200 }) as Response);
jest.mock('../api', () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));

import {
  NATIVE_PUSH_KIND,
  PUSH_TOKEN_KEY,
  __resetNativePushForTests,
  currentNativePushToken,
  pushNotificationRoute,
  registerNativePush,
  syncNativePush,
  unregisterNativePush,
} from '../native-push';

const session = { authToken: 'jwt', locale: 'fr' };
const calls = (method: string) =>
  mockAuthFetch.mock.calls.filter(([, init]) => (init as RequestInit).method === method);
const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  __resetNativePushForTests();
  pushListeners.clear();
  localStorage.clear();
  jest.clearAllMocks();
  plugin.permission = 'granted';
  plugin.tokens = [];
  plugin.registrationError = null;
  mockIsNative.mockReturnValue(true);
  mockPlatform.mockReturnValue('android');
  mockAuthFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
});

describe('registerNativePush', () => {
  it('web : sans effet, aucun appel au plugin ni à l’API', async () => {
    mockIsNative.mockReturnValue(false);
    expect(await registerNativePush(session)).toBe('unsupported');
    expect(plugin.checkPermissions).not.toHaveBeenCalled();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('sans autorisation : ne demande rien et n’enregistre rien', async () => {
    plugin.permission = 'prompt';
    expect(await registerNativePush(session)).toBe('no-permission');
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    expect(plugin.register).not.toHaveBeenCalled();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('enregistre le jeton FCM auprès de l’API (plateforme, langue, couverture locale)', async () => {
    plugin.tokens = ['fcm-1'];
    const until = new Date('2026-11-02T00:00:00.000Z');
    expect(await registerNativePush({ ...session, coveredUntil: until })).toBe('registered');
    const [post] = calls('POST');
    expect(post[0]).toBe('https://api.test/users/me/device-tokens');
    expect((post[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt' });
    expect(bodyOf(post)).toEqual({
      token: 'fcm-1',
      platform: 'android',
      locale: 'fr',
      localRemindersUntil: '2026-11-02T00:00:00.000Z',
    });
    expect(currentNativePushToken()).toBe('fcm-1');
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe('fcm-1');
  });

  it('jeton renouvelé : previousToken transmis ; couverture absente = champ omis', async () => {
    mockPlatform.mockReturnValue('ios');
    plugin.tokens = ['fcm-1', 'fcm-2'];
    await registerNativePush(session);
    await registerNativePush({ ...session, coveredUntil: null });
    const [, second] = calls('POST');
    expect(bodyOf(calls('POST')[0])).not.toHaveProperty('localRemindersUntil');
    expect(bodyOf(second)).toEqual({
      token: 'fcm-2',
      platform: 'ios',
      locale: 'fr',
      localRemindersUntil: null,
      previousToken: 'fcm-1',
    });
    expect(currentNativePushToken()).toBe('fcm-2');
  });

  it('rafraîchissement spontané par FCM : renvoyé aussitôt pour la session active', async () => {
    plugin.tokens = ['fcm-1'];
    await registerNativePush(session);
    (pushListeners.get('registration') as (p: { value: string }) => void)({ value: 'fcm-3' });
    await flush();
    const last = calls('POST').at(-1)!;
    expect(bodyOf(last)).toMatchObject({ token: 'fcm-3', previousToken: 'fcm-1' });
    expect(currentNativePushToken()).toBe('fcm-3');
  });

  it('erreur d’enregistrement (Firebase absent) ou refus de l’API : « error », jeton non retenu', async () => {
    plugin.registrationError = 'no google-services.json';
    expect(await registerNativePush(session)).toBe('error');
    expect(mockAuthFetch).not.toHaveBeenCalled();

    plugin.registrationError = null;
    plugin.tokens = ['fcm-9'];
    mockAuthFetch.mockResolvedValueOnce({ ok: false, status: 400 } as Response);
    expect(await registerNativePush(session)).toBe('error');
    expect(currentNativePushToken()).toBeNull();
  });

  it('les écouteurs du plugin ne sont posés qu’une fois', async () => {
    await registerNativePush(session);
    await registerNativePush(session);
    expect(plugin.addListener).toHaveBeenCalledTimes(2); // registration + registrationError
  });
});

describe('unregisterNativePush', () => {
  it('retire le jeton du compte puis l’oublie', async () => {
    plugin.tokens = ['fcm-1'];
    await registerNativePush(session);
    await unregisterNativePush('jwt');
    const [del] = calls('DELETE');
    expect(bodyOf(del)).toEqual({ token: 'fcm-1' });
    expect(del[2]).toEqual({ logoutOn401: false });
    expect(currentNativePushToken()).toBeNull();
    // Plus de session : un rafraîchissement spontané n'est plus transmis.
    mockAuthFetch.mockClear();
    (pushListeners.get('registration') as (p: { value: string }) => void)({ value: 'fcm-4' });
    await flush();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('sans jeton connu ou sans session : aucun appel', async () => {
    await unregisterNativePush('jwt');
    expect(mockAuthFetch).not.toHaveBeenCalled();
    localStorage.setItem(PUSH_TOKEN_KEY, 'fcm-1');
    await unregisterNativePush(null);
    expect(mockAuthFetch).not.toHaveBeenCalled();
    expect(currentNativePushToken()).toBeNull();
  });

  it('une erreur réseau ne remonte jamais', async () => {
    localStorage.setItem(PUSH_TOKEN_KEY, 'fcm-1');
    mockAuthFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterNativePush('jwt')).resolves.toBeUndefined();
  });
});

describe('syncNativePush', () => {
  it('rappels programmés : enregistre avec la couverture ; hors ligne : couverture omise', async () => {
    plugin.tokens = ['fcm-1', 'fcm-1'];
    const until = new Date('2026-11-02T00:00:00.000Z');
    await syncNativePush({ outcome: 'scheduled', count: 3, source: 'network', coveredUntil: until }, session);
    expect(bodyOf(calls('POST')[0]).localRemindersUntil).toBe(until.toISOString());
    await syncNativePush({ outcome: 'scheduled', count: 3, source: 'cache' }, session);
    expect(bodyOf(calls('POST')[1])).not.toHaveProperty('localRemindersUntil');
  });

  it('rappels coupés ou permission retirée : jeton retiré ; indisponible : rien', async () => {
    for (const outcome of ['disabled', 'no-permission'] as const) {
      localStorage.setItem(PUSH_TOKEN_KEY, 'fcm-1');
      mockAuthFetch.mockClear();
      await syncNativePush({ outcome, count: 0, source: null }, session);
      expect(calls('DELETE')).toHaveLength(1);
    }
    mockAuthFetch.mockClear();
    localStorage.setItem(PUSH_TOKEN_KEY, 'fcm-1');
    await syncNativePush({ outcome: 'unavailable', count: 0, source: null }, session);
    expect(mockAuthFetch).not.toHaveBeenCalled();
    expect(plugin.register).not.toHaveBeenCalled();
  });

  it('web : sans effet', async () => {
    mockIsNative.mockReturnValue(false);
    await syncNativePush({ outcome: 'scheduled', count: 1, source: 'network', coveredUntil: new Date() }, session);
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });
});

describe('pushNotificationRoute', () => {
  it('fiche de l’animal, sinon agenda ; ignore les notifications étrangères', () => {
    expect(pushNotificationRoute({ kind: NATIVE_PUSH_KIND, animalId: 'a 1' })).toBe('/mes-animaux/detail?id=a%201');
    expect(pushNotificationRoute({ kind: NATIVE_PUSH_KIND, animalId: '' })).toBe('/agenda');
    expect(pushNotificationRoute({ kind: NATIVE_PUSH_KIND })).toBe('/agenda');
    expect(pushNotificationRoute({ kind: 'autre', animalId: 'a1' })).toBeNull();
    expect(pushNotificationRoute(null)).toBeNull();
    expect(pushNotificationRoute('x')).toBeNull();
  });
});
