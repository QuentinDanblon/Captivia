import { api, BACKEND_UNAVAILABLE_MESSAGE } from '../api';
import { REFRESH_TOKEN_KEY, TOKEN_KEY, TOKEN_REFRESHED_EVENT } from '../session';

global.fetch = jest.fn();
const fetchMock = () => global.fetch as jest.Mock;

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
});

const authHeader = (call: unknown[]) =>
  ((call[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined)?.Authorization;

/** W1-01 — rafraîchissement automatique de l'access token sur 401. */
describe('lib/api — refresh token sur 401', () => {
  let logoutListener: jest.Mock;
  let refreshedListener: jest.Mock;

  beforeEach(() => {
    fetchMock().mockReset();
    localStorage.clear();
    logoutListener = jest.fn();
    refreshedListener = jest.fn();
    window.addEventListener('auth:logout', logoutListener);
    window.addEventListener(TOKEN_REFRESHED_EVENT, refreshedListener);
  });
  afterEach(() => {
    window.removeEventListener('auth:logout', logoutListener);
    window.removeEventListener(TOKEN_REFRESHED_EVENT, refreshedListener);
  });

  it('401 → /auth/refresh puis rejoue la requête avec le nouveau jeton', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 'a1' }], total: 1 }));

    const res = await api.getMyAnimals('old-access');

    expect(res).toBeDefined();
    const calls = fetchMock().mock.calls;
    expect(calls).toHaveLength(3);
    expect(String(calls[1][0])).toContain('/auth/refresh');
    expect(JSON.parse(String((calls[1][1] as RequestInit).body))).toEqual({ refreshToken: 'refresh-1' });
    expect(authHeader(calls[2])).toBe('Bearer new-access');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
    expect(refreshedListener).toHaveBeenCalledTimes(1);
    expect(logoutListener).not.toHaveBeenCalled();
  });

  it('requêtes concurrentes : un seul appel à /auth/refresh (verrou)', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    let refreshCalls = 0;
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse(200, { accessToken: 'new-access', refreshToken: 'refresh-2' });
      }
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return auth === 'Bearer new-access' ? jsonResponse(200, []) : jsonResponse(401, {});
    });

    await Promise.all([
      api.getMyAnimals('old-access'),
      api.getGrade('old-access'),
      api.getMyAnimals('old-access'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(logoutListener).not.toHaveBeenCalled();
  });

  it('refresh refusé (401) → auth:logout, une seule tentative', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'revoked');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Session expirée' }));

    await expect(api.getMyAnimals('old-access')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(logoutListener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('rejeu encore en 401 → auth:logout (pas de boucle)', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(api.getMyAnimals('old-access')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock()).toHaveBeenCalledTimes(3);
    expect(logoutListener).toHaveBeenCalledTimes(1);
  });

  it('jeton déjà renouvelé (autre onglet) : rejoue sans appeler /auth/refresh', async () => {
    localStorage.setItem(TOKEN_KEY, 'already-new');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-2');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, []));

    await api.getMyAnimals('stale-access');

    const calls = fetchMock().mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => String(c[0]).includes('/auth/refresh'))).toBe(false);
    expect(authHeader(calls[1])).toBe('Bearer already-new');
  });

  it('backend injoignable pendant le refresh : pas de déconnexion', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    // Échec passager : « service indisponible », jamais un faux 401 (qui déconnecterait).
    await expect(api.getMyAnimals('old-access')).rejects.toThrow(BACKEND_UNAVAILABLE_MESSAGE);

    expect(logoutListener).not.toHaveBeenCalled();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('logoutAll / verifyEmail / resendVerification appellent les bons endpoints', async () => {
    fetchMock().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    await api.logoutAll('tok');
    expect(String(fetchMock().mock.calls.at(-1)?.[0])).toContain('/auth/logout-all');
    await api.verifyEmail('abc');
    expect(String(fetchMock().mock.calls.at(-1)?.[0])).toContain('/auth/verify-email');
    await api.resendVerification('tok');
    expect(String(fetchMock().mock.calls.at(-1)?.[0])).toContain('/auth/resend-verification');
  });
});
