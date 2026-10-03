import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { unsubscribeFromPush } from '@/lib/web-push';

jest.mock('@/lib/web-push', () => ({
  unsubscribeFromPush: jest.fn(() => Promise.resolve(true)),
}));
const unsubscribeMock = unsubscribeFromPush as jest.Mock;

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('should provide initial auth state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should login and store user data', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const mockUser = {
      id: 'user-123',
      email: 'test@captivia.com',
      locale: 'fr',
      isPremium: false,
    };
    const mockToken = 'jwt-token-123';

    act(() => {
      result.current.login(mockToken, mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toEqual(mockToken);
    expect(localStorage.getItem('token')).toEqual(mockToken);
    expect(localStorage.getItem('user')).toEqual(JSON.stringify(mockUser));
  });

  it("updateToken remplace le jeton (state + localStorage) sans toucher à l'utilisateur", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    const mockUser = { id: 'u1', email: 'a@b.c', locale: 'fr', isPremium: false };

    act(() => {
      result.current.login('old-token', mockUser);
    });
    act(() => {
      result.current.updateToken('new-token');
    });

    expect(result.current.token).toBe('new-token');
    expect(result.current.user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('should logout and clear data', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const mockUser = {
      id: 'user-123',
      email: 'test@captivia.com',
      locale: 'fr',
      isPremium: false,
    };
    const mockToken = 'jwt-token-123';

    act(() => {
      result.current.login(mockToken, mockUser);
    });

    expect(result.current.user).not.toBeNull();

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('should restore session from localStorage', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@captivia.com',
      locale: 'fr',
      isPremium: false,
    };
    const mockToken = 'jwt-token-123';

    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toEqual(mockToken);
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleErrorSpy.mockRestore();
  });

  it('should handle isPremium flag correctly', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const premiumUser = {
      id: 'user-123',
      email: 'premium@captivia.com',
      locale: 'fr',
      isPremium: true,
    };

    act(() => {
      result.current.login('token', premiumUser);
    });

    expect(result.current.user?.isPremium).toBe(true);
  });

  it('should update localStorage when user logs in multiple times', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const user1 = {
      id: 'user-1',
      email: 'user1@captivia.com',
      locale: 'fr',
      isPremium: false,
    };

    const user2 = {
      id: 'user-2',
      email: 'user2@captivia.com',
      locale: 'en',
      isPremium: true,
    };

    act(() => {
      result.current.login('token-1', user1);
    });

    expect(result.current.user?.id).toBe('user-1');

    act(() => {
      result.current.login('token-2', user2);
    });

    expect(result.current.user?.id).toBe('user-2');
    expect(result.current.token).toBe('token-2');
    expect(localStorage.getItem('token')).toBe('token-2');
  });

  describe('robustesse de la session', () => {
    const user = { id: 'user-123', email: 'test@captivia.com', locale: 'fr', isPremium: false };
    const makeJwt = (exp?: number) => {
      const b64 = (o: object) =>
        btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(exp === undefined ? { sub: 'u' } : { sub: 'u', exp })}.sig`;
    };
    const nowSec = () => Math.floor(Date.now() / 1000);
    const fetchMock = () => global.fetch as jest.Mock;

    beforeEach(() => {
      fetchMock().mockReset();
      fetchMock().mockResolvedValue({ ok: true, status: 200, json: async () => user });
    });

    it('purge un cache utilisateur JSON corrompu au lieu de planter', async () => {
      localStorage.setItem('token', makeJwt(nowSec() + 3600));
      localStorage.setItem('user', '{not json');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('déconnecte au démarrage si le JWT est expiré (sans appeler le backend)', async () => {
      localStorage.setItem('token', makeJwt(nowSec() - 10));
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(fetchMock()).not.toHaveBeenCalled();
    });

    it("conserve une session dont le JWT n'est pas expiré, ou sans claim exp", async () => {
      const valid = makeJwt(nowSec() + 3600);
      localStorage.setItem('token', valid);
      localStorage.setItem('user', JSON.stringify(user));

      const first = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(first.result.current.token).toBe(valid));
      first.unmount();

      const noExp = makeJwt();
      localStorage.setItem('token', noExp);
      const second = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(second.result.current.token).toBe(noExp));
    });

    it('vide la session quand lib/api émet auth:logout (401)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      act(() => {
        result.current.login(makeJwt(nowSec() + 3600), user);
      });
      expect(result.current.user).not.toBeNull();

      act(() => {
        window.dispatchEvent(new Event('auth:logout'));
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('refreshProfile : un 401 de /auth/me déconnecte', async () => {
      localStorage.setItem('token', makeJwt(nowSec() + 3600));
      localStorage.setItem('user', JSON.stringify(user));
      fetchMock().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.token).toBeNull());
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('refreshProfile : un 403 ou une erreur réseau ne déconnecte PAS', async () => {
      const token = makeJwt(nowSec() + 3600);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      fetchMock().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
      const first = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(first.result.current.token).toBe(token);
      first.unmount();

      fetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const second = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(2));
      await act(async () => {});
      expect(second.result.current.token).toBe(token);
      expect(localStorage.getItem('token')).toBe(token);
    });

    it("refreshProfile : met à jour l'utilisateur depuis /auth/me", async () => {
      const token = makeJwt(nowSec() + 3600);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      const fresh = { ...user, isPremium: true };
      fetchMock().mockResolvedValue({ ok: true, status: 200, json: async () => fresh });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.user?.isPremium).toBe(true));
      expect(JSON.parse(localStorage.getItem('user') as string)).toEqual(fresh);
    });

    it('W1-01 : login stocke le refresh token, logout le révoque côté serveur et le purge', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      act(() => result.current.login('access-1', user, 'refresh-1'));
      expect(localStorage.getItem('refreshToken')).toBe('refresh-1');

      act(() => result.current.logout());
      expect(localStorage.getItem('refreshToken')).toBeNull();
      const call = fetchMock().mock.calls.find(([url]) => String(url).includes('/auth/logout'));
      expect(call).toBeDefined();
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ refreshToken: 'refresh-1' });
    });

    it('logout libère l’abonnement push de ce navigateur (best effort, sans bloquer la déconnexion)', () => {
      unsubscribeMock.mockClear();
      // Un désabonnement qui ne répond jamais ne doit pas retarder la déconnexion.
      unsubscribeMock.mockReturnValueOnce(new Promise(() => undefined));
      const { result } = renderHook(() => useAuth(), { wrapper });
      act(() => result.current.login('access-1', user, 'refresh-1'));

      act(() => result.current.logout());

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
      expect(unsubscribeMock).toHaveBeenCalledWith('access-1');
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('logout sans session : aucun désabonnement tenté', () => {
      unsubscribeMock.mockClear();
      const { result } = renderHook(() => useAuth(), { wrapper });
      act(() => result.current.logout());
      expect(unsubscribeMock).not.toHaveBeenCalled();
    });

    it('W1-01 : JWT expiré + refresh token → rotation au démarrage au lieu de déconnecter', async () => {
      const fresh = makeJwt(nowSec() + 1800);
      localStorage.setItem('token', makeJwt(nowSec() - 10));
      localStorage.setItem('refreshToken', 'refresh-1');
      localStorage.setItem('user', JSON.stringify(user));
      fetchMock().mockImplementation(async (url: string) =>
        String(url).includes('/auth/refresh')
          ? { ok: true, status: 200, json: async () => ({ accessToken: fresh, refreshToken: 'refresh-2' }) }
          : { ok: true, status: 200, json: async () => user },
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.token).toBe(fresh);
      expect(result.current.user).toEqual(user);
      expect(localStorage.getItem('refreshToken')).toBe('refresh-2');
    });

    it('W1-01 : logoutAll appelle /auth/logout-all puis vide la session', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      act(() => result.current.login('access-1', user, 'refresh-1'));
      fetchMock().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      await act(async () => {
        await result.current.logoutAll();
      });

      const call = fetchMock().mock.calls.find(([url]) => String(url).includes('/auth/logout-all'));
      expect((call![1] as RequestInit).headers).toEqual({ Authorization: 'Bearer access-1' });
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });
});

/** Non-régression de la revue frontend : cas D et constats 2, 3, 4. */
describe('AuthContext — revue frontend', () => {
  const user = { id: 'u1', email: 'a@b.c', locale: 'fr', isPremium: false };
  const fetchMock = () => global.fetch as jest.Mock;
  const json = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock().mockReset();
    unsubscribeMock.mockClear();
  });

  it('D. logoutAll avec access token expiré : refresh, rejeu, toutes les sessions révoquées', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1-expired', user, 'refresh-1'));
    const calls: Array<[string, RequestInit | undefined]> = [];
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      if (url.includes('/auth/refresh')) return json(200, { accessToken: 'T2', refreshToken: 'refresh-2' });
      const authz = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return authz === 'Bearer T2' ? json(200, { message: 'ok' }) : json(401, { message: 'Unauthorized' });
    });

    await act(async () => {
      await result.current.logoutAll();
    });

    const logoutAllCalls = calls.filter(([u]) => u.includes('/auth/logout-all'));
    expect(logoutAllCalls).toHaveLength(2);
    expect((logoutAllCalls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer T2');
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('D bis. logoutAll : 401 persistant → révoque le refresh token de cet appareil et lève une erreur', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1-expired', user, 'refresh-1'));
    const calls: Array<[string, RequestInit | undefined]> = [];
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return json(401, { message: 'Unauthorized' });
    });

    let error: unknown;
    await act(async () => {
      error = await result.current.logoutAll().catch((e) => e);
    });

    expect(error).toBeInstanceOf(Error);
    const revoke = calls.find(([u]) => u.endsWith('/auth/logout'));
    expect(revoke).toBeDefined();
    expect(JSON.parse(String(revoke![1]?.body))).toEqual({ refreshToken: 'refresh-1' });
    await waitFor(() => expect(result.current.token).toBeNull());
  });

  it('logoutAll : erreur serveur → lève, la session locale est conservée', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1', user, 'refresh-1'));
    fetchMock().mockResolvedValue(json(500, { message: 'boom' }));

    let error: unknown;
    await act(async () => {
      error = await result.current.logoutAll().catch((e) => e);
    });

    expect(error).toBeInstanceOf(Error);
    expect(result.current.token).toBe('T1');
  });

  it('constat 4. logoutAll libère d’abord l’abonnement push de ce navigateur', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1', user, 'refresh-1'));
    const order: string[] = [];
    unsubscribeMock.mockImplementationOnce(async () => {
      order.push('push');
      return true;
    });
    fetchMock().mockImplementation(async (url: string) => {
      order.push(url.includes('/auth/logout-all') ? 'logout-all' : url);
      return json(200, {});
    });

    await act(async () => {
      await result.current.logoutAll();
    });

    expect(unsubscribeMock).toHaveBeenCalledWith('T1');
    expect(order).toEqual(['push', 'logout-all']);
  });

  it('constat 2. événement storage : nouveau jeton adopté, jeton vidé → déconnexion locale', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1', user, 'refresh-1'));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', oldValue: 'T1', newValue: 'T2' }));
    });
    expect(result.current.token).toBe('T2');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: null }));
    });
    expect(result.current.token).toBe('T2');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', oldValue: 'T2', newValue: null }));
    });
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('reloadUser relit /auth/me et met à jour la session (Premium activé par le webhook)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1', user, 'refresh-1'));
    fetchMock().mockImplementation(async (url: string) =>
      url.endsWith('/auth/me') ? json(200, { ...user, isPremium: true }) : json(404, {}),
    );
    let fresh: unknown;
    await act(async () => {
      fresh = await result.current.reloadUser();
    });
    expect(fresh).toEqual({ ...user, isPremium: true });
    expect(result.current.user?.isPremium).toBe(true);
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').isPremium).toBe(true);
  });

  it('reloadUser : sans session ou en cas d’erreur, null sans déconnecter', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(result.current.reloadUser()).resolves.toBeNull();
    expect(fetchMock()).not.toHaveBeenCalled();
    act(() => result.current.login('T1', user, 'refresh-1'));
    fetchMock().mockResolvedValue(json(500, { message: 'boom' }));
    let fresh: unknown = 'unset';
    await act(async () => {
      fresh = await result.current.reloadUser();
    });
    expect(fresh).toBeNull();
    expect(result.current.user).toEqual(user);
    expect(result.current.token).toBe('T1');
  });

  it('reloadUser ignore la réponse d’un autre compte (session changée entre-temps)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login('T1', user, 'refresh-1'));
    fetchMock().mockResolvedValue(json(200, { ...user, id: 'u2', isPremium: true }));
    let fresh: unknown = 'unset';
    await act(async () => {
      fresh = await result.current.reloadUser();
    });
    expect(fresh).toBeNull();
    expect(result.current.user).toEqual(user);
  });
});
