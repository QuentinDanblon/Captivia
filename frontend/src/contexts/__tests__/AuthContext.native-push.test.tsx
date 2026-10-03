import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * W6-07 (revue de sécurité, constat 3) : une déconnexion FORCÉE dans l'app (401 → `auth:logout`)
 * invalide aussi le jeton de push natif de l'appareil, sans appel serveur (session perdue).
 */
jest.mock('@/lib/web-push', () => ({ unsubscribeFromPush: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/lib/platform', () => ({
  ...jest.requireActual('@/lib/platform'),
  isNative: () => true,
  tokenStorage: {
    getItem: (k: string) => localStorage.getItem(k),
    setItem: (k: string, v: string) => localStorage.setItem(k, v),
    removeItem: (k: string) => localStorage.removeItem(k),
    hydrate: async () => undefined,
  },
}));
const mockUnregister = jest.fn(async (_authToken: string | null) => {
  localStorage.removeItem('captivia.push.token');
});
jest.mock('@/lib/native-push', () => ({
  PUSH_TOKEN_KEY: 'captivia.push.token',
  currentNativePushToken: () => localStorage.getItem('captivia.push.token'),
  unregisterNativePush: (authToken: string | null) => mockUnregister(authToken),
}));

import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const user = { id: 'u1', email: 'a@b.c', locale: 'fr', isPremium: false };
const jwt = () => {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
};

describe('AuthContext — push natif à la déconnexion forcée', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUnregister.mockClear();
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => user }) as Response);
  });

  it('auth:logout : jeton natif invalidé (unregisterNativePush(null)) puis session vidée', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.login(jwt(), user));
    localStorage.setItem('captivia.push.token', 'fcm-1');

    act(() => {
      window.dispatchEvent(new Event('auth:logout'));
    });

    expect(result.current.user).toBeNull();
    expect(mockUnregister).toHaveBeenCalledTimes(1);
    expect(mockUnregister).toHaveBeenCalledWith(null);
  });

  it('logout() explicite : un seul retrait (avec la session), pas de second unregister', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.login(jwt(), user));
    localStorage.setItem('captivia.push.token', 'fcm-1');

    act(() => result.current.logout());

    expect(mockUnregister).toHaveBeenCalledTimes(1);
    expect(mockUnregister.mock.calls[0][0]).toEqual(expect.any(String));
  });

  it('sans jeton natif connu : rien à invalider', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.login(jwt(), user));
    act(() => {
      window.dispatchEvent(new Event('auth:logout'));
    });
    expect(mockUnregister).not.toHaveBeenCalled();
  });
});
