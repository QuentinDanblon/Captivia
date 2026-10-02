import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

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
  });
});
