/**
 * Non-régression de la revue frontend (session / refresh) : cas A à E et constats 1, 2, 6, 9.
 * Chaque cas reproduisait un bug ; il vérifie désormais le comportement corrigé.
 */
import { api, ApiError, authFetch, BACKEND_UNAVAILABLE_MESSAGE } from '../api';
import { fetchAgenda } from '../agenda';
import {
  isJwtExpired,
  refreshAccessToken,
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  TOKEN_REFRESHED_EVENT,
  USER_KEY,
} from '../session';

global.fetch = jest.fn();
const fetchMock = () => global.fetch as jest.Mock;
const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
});
const auth = (init?: RequestInit) =>
  (init?.headers as Record<string, string> | undefined)?.Authorization;
const makeJwt = (exp: number) => {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u', exp })}.sig`;
};
const nowSec = () => Math.floor(Date.now() / 1000);

describe('revue frontend — session et refresh', () => {
  let logout: jest.Mock;
  let refreshed: jest.Mock;
  beforeEach(() => {
    fetchMock().mockReset();
    localStorage.clear();
    logout = jest.fn();
    refreshed = jest.fn();
    window.addEventListener('auth:logout', logout);
    window.addEventListener(TOKEN_REFRESHED_EVENT, refreshed);
  });
  afterEach(() => {
    window.removeEventListener('auth:logout', logout);
    window.removeEventListener(TOKEN_REFRESHED_EVENT, refreshed);
  });

  it('A. jeton réutilisé (autre onglet) refusé à son tour → vrai refresh, une fois, sans déconnexion', async () => {
    // Onglet B garde T1 ; l'onglet A a écrit T2 (refusé par l'API) et refresh-2 (valide).
    localStorage.setItem(TOKEN_KEY, 'T2-expired');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-2');
    const urls: string[] = [];
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.includes('/auth/refresh')) return json(200, { accessToken: 'T3', refreshToken: 'refresh-3' });
      return auth(init) === 'Bearer T3' ? json(200, []) : json(401, { message: 'Unauthorized' });
    });

    await expect(api.getMyAnimals('T1')).resolves.toEqual([]);

    expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(1);
    expect(logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('T3');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-3');
  });

  it('A bis. le jeton réutilisé et rejeté encore après le vrai refresh → auth:logout, sans boucle', async () => {
    localStorage.setItem(TOKEN_KEY, 'T2');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-2');
    fetchMock().mockImplementation(async (url: string) =>
      url.includes('/auth/refresh')
        ? json(200, { accessToken: 'T3', refreshToken: 'refresh-3' })
        : json(401, { message: 'Unauthorized' }),
    );

    await expect(api.getMyAnimals('T1')).rejects.toMatchObject({ status: 401 });

    // 1 requête + rejeu T2 + refresh + rejeu T3.
    expect(fetchMock()).toHaveBeenCalledTimes(4);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('constat 2. un jeton stocké mais EXPIRÉ n’est pas réutilisé : refresh direct', async () => {
    localStorage.setItem(TOKEN_KEY, makeJwt(nowSec() - 60));
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-2');
    const urls: string[] = [];
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.includes('/auth/refresh')) return json(200, { accessToken: 'T3', refreshToken: 'refresh-3' });
      return auth(init) === 'Bearer T3' ? json(200, []) : json(401, {});
    });

    await api.getMyAnimals('T1');

    // Pas de rejeu inutile avec le jeton expiré : requête, refresh, rejeu.
    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain('/auth/refresh');
  });

  it('constat 2. le raccourci « déjà renouvelé » émet TOKEN_REFRESHED_EVENT', async () => {
    const fresh = makeJwt(nowSec() + 600);
    localStorage.setItem(TOKEN_KEY, fresh);
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-2');

    const r = await refreshAccessToken('T1');

    expect(r).toEqual({ ok: true, accessToken: fresh, reused: true });
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect((refreshed.mock.calls[0][0] as CustomEvent).detail).toEqual({ accessToken: fresh });
  });

  it('isJwtExpired : expiré, valide, illisible', () => {
    expect(isJwtExpired(makeJwt(nowSec() - 1))).toBe(true);
    expect(isJwtExpired(makeJwt(nowSec() + 60))).toBe(false);
    expect(isJwtExpired('opaque')).toBe(false);
  });

  it('B. agenda : 401 → refresh puis rejeu, sans déconnexion (constat 1)', async () => {
    localStorage.setItem(TOKEN_KEY, 'T1');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    const urls: string[] = [];
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.includes('/auth/refresh')) return json(200, { accessToken: 'T2', refreshToken: 'refresh-2' });
      return auth(init) === 'Bearer T2'
        ? json(200, { from: '2026-10-01', to: '2026-10-30', items: [], truncated: false })
        : json(401, { message: 'Unauthorized' });
    });

    await expect(fetchAgenda('T1', '2026-10-01', '2026-10-30')).resolves.toMatchObject({ items: [] });

    expect(urls.some((u) => u.includes('/auth/refresh'))).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  it('B bis. agenda : session révoquée → une seule déconnexion (émise par authFetch)', async () => {
    localStorage.setItem(TOKEN_KEY, 'T1');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock().mockImplementation(async () => json(401, { message: 'Unauthorized' }));

    await expect(fetchAgenda('T1', '2026-10-01', '2026-10-30')).rejects.toMatchObject({ status: 401 });

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('C. refresh en échec passager (503) : « service indisponible », pas de 401 ni de déconnexion (constat 6)', async () => {
    localStorage.setItem(TOKEN_KEY, 'T1');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock().mockImplementation(async (url: string) =>
      url.includes('/auth/refresh') ? json(503, {}) : json(401, { message: 'Unauthorized' }),
    );

    const err = await api.getMedications('a1', 'T1').catch((e) => e);
    const err2 = await api.getAnimal('a1', 'T1').catch((e) => e);

    for (const e of [err, err2]) {
      expect(e).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(ApiError);
      expect((e as Error).message).toBe(BACKEND_UNAVAILABLE_MESSAGE);
    }
    expect(logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('authFetch : requête authentifiée avec refresh + rejeu (en-têtes Headers conservés)', async () => {
    localStorage.setItem(TOKEN_KEY, 'T1');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) return json(200, { accessToken: 'T2', refreshToken: 'refresh-2' });
      const h = new Headers(init?.headers);
      return h.get('Authorization') === 'Bearer T2' && h.get('X-Test') === '1' ? json(200, {}) : json(401, {});
    });

    const res = await authFetch('https://api.test/x', {
      headers: new Headers({ Authorization: 'Bearer T1', 'X-Test': '1' }),
    });

    expect(res.status).toBe(200);
  });

  it('E. logout pendant un refresh en vol : la session effacée ne renaît pas (constat 9)', async () => {
    localStorage.setItem(TOKEN_KEY, 'T1');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    localStorage.setItem(USER_KEY, '{"id":"u"}');
    let release!: () => void;
    fetchMock().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(json(200, { accessToken: 'T2', refreshToken: 'refresh-2' }));
        }),
    );

    const pending = refreshAccessToken('T1');
    await Promise.resolve();
    // logout() : clearStoredSession()
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    release();
    const r = await pending;

    expect(r).toEqual({ ok: false, revoked: false });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(refreshed).not.toHaveBeenCalled();
  });
});
