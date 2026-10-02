import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';

/**
 * API backend simulée pour les tests « smoke » : aucune requête ne quitte la machine.
 * Le bundle navigateur est construit avec NEXT_PUBLIC_API_URL = API_ORIGIN ; chaque appel
 * est intercepté par `page.route` et servi depuis e2e/fixtures/*.json (ou un état en mémoire).
 * Toute requête non prévue répond 404 ET est consignée dans `unmocked` : le fixture de test
 * échoue alors, ce qui évite qu'un appel oublié passe inaperçu.
 */
export const API_ORIGIN = 'http://127.0.0.1:4010';

/** Mot de passe accepté par la connexion et la suppression de compte simulées. */
export const VALID_PASSWORD = 'Password123!';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8')) as T;
}

export interface MockAnimal {
  id: string;
  name: string;
  speciesId: number;
  [key: string]: unknown;
}

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockApi {
  /** Animaux de l'utilisateur (modifiable avant la navigation). */
  animals: MockAnimal[];
  /** Toutes les requêtes reçues, dans l'ordre. */
  calls: RecordedCall[];
  /** Requêtes sans route simulée (doit rester vide). */
  unmocked: string[];
  /** Requêtes reçues pour `METHOD /chemin` (le chemin exclut la query string). */
  callsTo: (method: string, pathname: string) => RecordedCall[];
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

function json(route: Route, status: number, body: unknown, extra: Record<string, string> = {}) {
  return route.fulfill({
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
}

/** Sous-ressources d'un animal que l'écran de détail charge : toutes vides dans ces tests. */
const EMPTY_ANIMAL_COLLECTIONS =
  /^\/users\/me\/animals\/[^/]+\/(routines|routine-templates|offspring|medications|vet-appointments|health-records|measurements|vaccinations|breeding|history)$/;

export async function installMockApi(page: Page): Promise<MockApi> {
  const api: MockApi = {
    animals: [],
    calls: [],
    unmocked: [],
    callsTo: (method, pathname) => api.calls.filter((c) => c.method === method && c.path === pathname),
  };
  const user = fixture<Record<string, unknown>>('user');

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }

    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    api.calls.push({ method, path: pathname, query: url.searchParams, headers: request.headers(), body });

    const authorized = (request.headers()['authorization'] ?? '').startsWith('Bearer ');
    const unauthorized = () => json(route, 401, { statusCode: 401, message: 'Unauthorized' });

    // --- Espèces (public) ---
    if (method === 'GET' && pathname === '/species/search') {
      return json(route, 200, fixture('species-search'));
    }
    if (method === 'GET' && pathname === '/species/2435099') return json(route, 200, fixture('species'));
    if (method === 'GET' && pathname === '/species/2435099/health') return json(route, 200, fixture('species-health'));
    if (method === 'GET' && pathname === '/species/2435099/legislation') {
      return json(route, 200, fixture('species-legislation'));
    }
    if (method === 'GET' && pathname === '/species/2435099/reproduction') {
      return json(route, 404, { statusCode: 404, message: 'Not found' });
    }
    if (method === 'GET' && /^\/species\/\d+\/(health|legislation|reproduction)$/.test(pathname)) {
      return json(route, 404, { statusCode: 404, message: 'Not found' });
    }
    if (method === 'GET' && /^\/species\/\d+$/.test(pathname)) {
      return json(route, 404, { statusCode: 404, message: 'Species not found' });
    }
    if (method === 'GET' && pathname === '/equipment') return json(route, 200, fixture('equipment'));
    if (method === 'GET' && pathname.startsWith('/food/species/')) return json(route, 200, { products: [] });

    // --- Authentification ---
    if (method === 'POST' && pathname === '/auth/register') {
      const { email } = (body ?? {}) as { email?: string };
      return json(route, 201, { accessToken: 'e2e-register-token', user: { ...user, email } });
    }
    if (method === 'POST' && pathname === '/auth/login') {
      const { email, password } = (body ?? {}) as { email?: string; password?: string };
      if (password !== VALID_PASSWORD) {
        return json(route, 401, { statusCode: 401, message: 'Email ou mot de passe incorrect' });
      }
      return json(route, 200, { accessToken: 'e2e-login-token', user: { ...user, email } });
    }
    if (method === 'GET' && pathname === '/auth/me') return authorized ? json(route, 200, user) : unauthorized();

    // --- Animaux de l'utilisateur ---
    if (pathname.startsWith('/users/me') && !authorized) return unauthorized();

    if (pathname === '/users/me/animals') {
      if (method === 'GET') return json(route, 200, api.animals);
      if (method === 'POST') {
        const data = (body ?? {}) as Record<string, unknown>;
        const created = {
          photos: [],
          ...data,
          id: `animal-e2e-${api.animals.length + 1}`,
          speciesName: 'Boa constrictor',
        } as MockAnimal;
        api.animals.push(created);
        return json(route, 201, created);
      }
    }
    const animalMatch = /^\/users\/me\/animals\/([^/]+)$/.exec(pathname);
    if (animalMatch && method === 'GET') {
      const found = api.animals.find((a) => a.id === animalMatch[1]);
      return found ? json(route, 200, found) : json(route, 404, { statusCode: 404, message: 'Animal introuvable' });
    }
    if (method === 'GET' && EMPTY_ANIMAL_COLLECTIONS.test(pathname)) return json(route, 200, []);
    if (method === 'GET' && /^\/users\/me\/animals\/[^/]+\/public-link$/.test(pathname)) {
      return json(route, 200, { enabled: false, showHealth: false, slug: null, url: null });
    }

    // --- Compte (RGPD) ---
    if (method === 'GET' && pathname === '/users/me/export') {
      return json(route, 200, fixture('account-export'), {
        'content-disposition': 'attachment; filename="captivia-export.json"',
      });
    }
    if (method === 'DELETE' && pathname === '/users/me') {
      const { password } = (body ?? {}) as { password?: string };
      return password === VALID_PASSWORD
        ? route.fulfill({ status: 204, headers: CORS_HEADERS })
        : json(route, 401, { statusCode: 401, message: 'Invalid password' });
    }

    api.unmocked.push(`${method} ${pathname}`);
    return json(route, 404, { statusCode: 404, message: `Not mocked: ${method} ${pathname}` });
  });

  return api;
}

/** Date d'expiration lointaine : AuthContext purge les jetons JWT expirés au chargement. */
function fakeJwt(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ sub: 'user-e2e-1', exp: 4102444800 })}.signature`;
}

/**
 * Ouvre une session : pose `token` + `user` dans localStorage avant le premier script de la page
 * (comme après une connexion). Une seule fois par contexte : une déconnexion ou une suppression
 * de compte ne doit pas être « annulée » par une navigation ultérieure.
 */
export async function signIn(page: Page): Promise<void> {
  const session = { token: fakeJwt(), user: JSON.stringify(fixture('user')) };
  await page.addInitScript((s) => {
    try {
      if (localStorage.getItem('__e2e_signed_in')) return;
      localStorage.setItem('__e2e_signed_in', '1');
      localStorage.setItem('token', s.token);
      localStorage.setItem('user', s.user);
    } catch {
      // stockage indisponible : le test échouera de façon explicite
    }
  }, session);
}
