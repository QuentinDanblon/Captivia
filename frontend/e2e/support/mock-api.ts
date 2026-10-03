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

/** Mode invité simulé : jetons émis par POST /auth/guest et POST /auth/upgrade. */
export const GUEST_TOKEN = 'e2e-guest-token';
export const UPGRADED_TOKEN = 'e2e-upgrade-token';
/** Adresse déjà associée à un compte : POST /auth/upgrade répond 409. */
export const TAKEN_EMAIL = 'pris@captivia.test';

export const GUEST_USER = {
  id: 'guest-e2e-1',
  email: null,
  isGuest: true,
  locale: 'fr',
  isPremium: false,
  emailVerified: false,
};

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/** Origine des photos d'espèces des fixtures (species-media.json), servies par `page.route`. */
export const PHOTO_ORIGIN = 'https://inaturalist-open-data.s3.amazonaws.com';
/** Image servie pour toute photo d'espèce simulée (fichier du dépôt, aucune requête externe). */
const SAMPLE_PHOTO = path.join(__dirname, '..', '..', 'public', 'images', 'animals', 'bearded-dragon-480.webp');

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

/** Soin de l'agenda agrégé (GET /users/me/agenda), cf. src/lib/agenda.ts. */
export interface MockAgendaItem {
  id: string;
  date: string;
  day: string;
  allDay: boolean;
  type: 'routine' | 'medication' | 'vaccination' | 'vet_appointment';
  animalId: string;
  animalName: string;
  title: string;
  detail: string | null;
  status: 'pending' | 'done' | 'skipped' | 'cancelled';
  sourceId: string;
}

/** Publication de la communauté telle que la renvoie l'API (src/lib/community.ts, `CommunityPost`). */
export interface MockCommunityPost {
  id: string;
  type: 'PHOTO' | 'QUESTION';
  body: string;
  speciesCategory: string | null;
  status: string;
  createdAt: string;
  author: { handle: string | null; avatarUrl: string | null };
  animal: { name: string; species: string; scientificName: string } | null;
  media: { id: string; url: string; width: number; height: number }[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
  helpfulCommentId: string | null;
}

export interface MockCommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  status: string;
  createdAt: string;
  author: { handle: string | null; avatarUrl: string | null };
  isMine: boolean;
  isHelpful: boolean;
  replies?: MockCommunityComment[];
}

/**
 * Communauté simulée (routes `/community/*`). `enabled: false` (défaut) reproduit un serveur avec
 * `COMMUNITY_ENABLED=false` : toutes les routes répondent 404, comme le vrai garde.
 */
export interface MockCommunity {
  enabled: boolean;
  /** Profil de la session (`GET /community/profile`). */
  me: {
    profile: { handle: string; avatarUrl: string | null; rulesVersion: string; rulesAcceptedAt: string; suspendedUntil: string | null; createdAt: string } | null;
    currentRulesVersion: string;
    canPublish: boolean;
    reasons: string[];
    ageConfirmationRequired: boolean;
  };
  posts: MockCommunityPost[];
  comments: Record<string, MockCommunityComment[]>;
  blocks: { handle: string; avatarUrl: string | null; blockedAt: string }[];
  /** `GET /community/me/reports` ; null = route absente (API antérieure au contrat F3) → 404. */
  reports: Record<string, unknown>[] | null;
}

/** Profil communautaire actif par défaut (compte du fixture, e-mail vérifié). */
export const COMMUNITY_HANDLE = 'kaa_et_moi';
export const COMMUNITY_RULES = '2026-10';
/** Origine (simulée) des images de la communauté : pilote local, servies par l'API. */
export const COMMUNITY_MEDIA_PREFIX = `${API_ORIGIN}/community/media/`;

export function communityPost(overrides: Partial<MockCommunityPost> & { id: string }): MockCommunityPost {
  return {
    type: 'PHOTO',
    body: '',
    speciesCategory: 'REPTILE',
    status: 'VISIBLE',
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    author: { handle: 'gecko.lea', avatarUrl: null },
    animal: null,
    media: [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    isMine: false,
    helpfulCommentId: null,
    ...overrides,
  };
}

export interface MockApi {
  /** Animaux de l'utilisateur (modifiable avant la navigation). */
  animals: MockAnimal[];
  /** Soins renvoyés par l'agenda (vide par défaut ; modifiable avant la navigation). */
  agenda: MockAgendaItem[];
  /** Sous-collections d'un animal (`measurements`, `vaccinations`…), vides par défaut. */
  collections: Record<string, unknown[]>;
  /** Toutes les requêtes reçues, dans l'ordre. */
  calls: RecordedCall[];
  /** Requêtes sans route simulée (doit rester vide). */
  unmocked: string[];
  /** Requêtes reçues pour `METHOD /chemin` (le chemin exclut la query string). */
  callsTo: (method: string, pathname: string) => RecordedCall[];
  /** Profil de l'invité converti par POST /auth/upgrade (null avant). */
  upgradedUser: Record<string, unknown> | null;
  /** Communauté (désactivée par défaut, comme en production). */
  community: MockCommunity;
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
    agenda: [],
    collections: {},
    calls: [],
    unmocked: [],
    upgradedUser: null,
    community: {
      enabled: false,
      me: {
        profile: {
          handle: COMMUNITY_HANDLE,
          avatarUrl: null,
          rulesVersion: COMMUNITY_RULES,
          rulesAcceptedAt: '2026-09-01T10:00:00.000Z',
          suspendedUntil: null,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        currentRulesVersion: COMMUNITY_RULES,
        canPublish: true,
        reasons: [],
        ageConfirmationRequired: false,
      },
      posts: [],
      comments: {},
      blocks: [],
      reports: null,
    },
    callsTo: (method, pathname) => api.calls.filter((c) => c.method === method && c.path === pathname),
  };
  const user = fixture<Record<string, unknown>>('user');

  // Hébergeur des photos d'espèces (URL des médias GBIF simulés) : servi localement, hors réseau.
  await page.route(`${PHOTO_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(SAMPLE_PHOTO) }),
  );

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

    const authorization = request.headers()['authorization'] ?? '';
    const authorized = authorization.startsWith('Bearer ');
    const bearer = authorization.replace(/^Bearer\s+/, '');
    const unauthorized = () => json(route, 401, { statusCode: 401, message: 'Unauthorized' });
    /** Profil de la session portée par la requête (invité, invité converti, ou compte du fixture). */
    const sessionUser = (): Record<string, unknown> =>
      bearer === GUEST_TOKEN ? GUEST_USER : bearer === UPGRADED_TOKEN && api.upgradedUser ? api.upgradedUser : user;

    // --- Espèces (public) ---
    if (method === 'GET' && pathname === '/species/search') {
      return json(route, 200, fixture('species-search'));
    }
    if (method === 'GET' && pathname === '/species/2435099') return json(route, 200, fixture('species'));
    if (method === 'GET' && pathname === '/species/2435099/health') return json(route, 200, fixture('species-health'));
    if (method === 'GET' && pathname === '/species/2435099/legislation') {
      return json(route, 200, fixture('species-legislation'));
    }
    // Photos (GET /species/:id/media) : 2435099 a une photo NC (refusée) puis une photo CC BY créditée ;
    // 2435100 n'a qu'une photo NC (repli silhouette) ; les autres espèces, aucune.
    if (method === 'GET' && pathname === '/species/2435099/media') return json(route, 200, fixture('species-media'));
    if (method === 'GET' && pathname === '/species/2435100/media') {
      return json(route, 200, fixture<unknown[]>('species-media').slice(0, 1));
    }
    if (method === 'GET' && /^\/species\/\d+\/media$/.test(pathname)) return json(route, 200, []);
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

    // --- Page publique d'un animal (lien ou QR code partagé) ---
    if (method === 'GET' && pathname.startsWith('/public/animal/')) {
      return json(route, 200, {
        name: 'Kaa',
        species: { commonName: 'Boa constricteur', scientificName: 'Boa constrictor' },
        sex: 'male',
        birthYear: 2023,
        photo: null,
        vaccinations: [{ name: 'Vermifuge', date: '2026-07-07T00:00:00.000Z' }],
      });
    }

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
    if (method === 'GET' && pathname === '/auth/me') return authorized ? json(route, 200, sessionUser()) : unauthorized();

    // --- Mode invité ---
    if (method === 'POST' && pathname === '/auth/guest') {
      return json(route, 201, { accessToken: GUEST_TOKEN, refreshToken: 'e2e-guest-refresh', user: GUEST_USER });
    }
    if (method === 'POST' && pathname === '/auth/upgrade') {
      if (bearer !== GUEST_TOKEN) return json(route, 403, { statusCode: 403, code: 'NOT_A_GUEST', message: 'Not a guest' });
      const { email } = (body ?? {}) as { email?: string };
      if (email === TAKEN_EMAIL) {
        return json(route, 409, { statusCode: 409, message: 'Email already registered' });
      }
      api.upgradedUser = { ...GUEST_USER, email: email ?? null, isGuest: false };
      return json(route, 201, { accessToken: UPGRADED_TOKEN, refreshToken: 'e2e-upgrade-refresh', user: api.upgradedUser });
    }

    // --- Communauté (/community/*) : 404 tant que le volet est fermé, comme CommunityEnabledGuard ---
    if (pathname.startsWith('/community/')) {
      const c = api.community;
      const notFound = () => json(route, 404, { statusCode: 404, message: 'Not Found' });
      if (!c.enabled) return notFound();
      // Images (pilote local) : publiques, sans jeton.
      if (method === 'GET' && pathname.startsWith('/community/media/')) {
        return route.fulfill({ status: 200, headers: { ...CORS_HEADERS, 'content-type': 'image/webp' }, body: readFileSync(SAMPLE_PHOTO) });
      }
      if (!authorized) return unauthorized();
      const isGuest = bearer === GUEST_TOKEN;
      const me = isGuest
        ? { profile: null, currentRulesVersion: COMMUNITY_RULES, canPublish: false, reasons: ['GUEST_ACCOUNT', 'COMMUNITY_PROFILE_REQUIRED'], ageConfirmationRequired: false }
        : c.me;
      const forbiddenGuest = () => json(route, 403, { statusCode: 403, code: 'GUEST_ACCOUNT', message: 'Create an account to publish in the community.' });
      const now = () => new Date().toISOString();

      if (method === 'GET' && pathname === '/community/rules') return json(route, 200, { version: COMMUNITY_RULES });
      if (pathname === '/community/profile') {
        if (method === 'GET') return json(route, 200, me);
        if (isGuest) return forbiddenGuest();
        if (method === 'POST') {
          const { handle } = (body ?? {}) as { handle?: string };
          if (handle === 'pris') return json(route, 409, { statusCode: 409, code: 'HANDLE_TAKEN', message: 'taken' });
          c.me = {
            ...c.me,
            profile: { handle: handle ?? 'membre', avatarUrl: null, rulesVersion: COMMUNITY_RULES, rulesAcceptedAt: now(), suspendedUntil: null, createdAt: now() },
            canPublish: true,
            reasons: [],
          };
          return json(route, 201, c.me.profile);
        }
      }
      if (method === 'GET' && pathname === '/community/me/decisions') return json(route, 200, { items: [], nextCursor: null, contactEmail: null });
      // Mes signalements (contrat F3) ; absente (null) : l'interface doit tolérer le 404.
      if (method === 'GET' && pathname === '/community/me/reports') {
        return c.reports ? json(route, 200, { items: c.reports, nextCursor: null, contactEmail: null }) : notFound();
      }
      if (method === 'GET' && pathname === '/community/blocks') return json(route, 200, { items: c.blocks });

      if (pathname === '/community/media' && method === 'POST') {
        if (isGuest) return forbiddenGuest();
        const n = api.calls.filter((call) => call.method === 'POST' && call.path === '/community/media').length;
        const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
        return json(route, 201, { id, url: `${COMMUNITY_MEDIA_PREFIX}${id}.webp`, width: 480, height: 320 });
      }

      if (pathname === '/community/posts') {
        if (method === 'GET') {
          const type = url.searchParams.get('type');
          const category = url.searchParams.get('category');
          const items = c.posts.filter((p) => p.status === 'VISIBLE' && (!type || p.type === type) && (!category || p.speciesCategory === category));
          const start = Number(url.searchParams.get('cursor') ?? 0) || 0;
          const limit = Number(url.searchParams.get('limit') ?? 20) || 20;
          const page = items.slice(start, start + limit);
          return json(route, 200, { items: page, nextCursor: start + limit < items.length ? String(start + limit) : null });
        }
        if (method === 'POST') {
          if (isGuest) return forbiddenGuest();
          const data = (body ?? {}) as { type: 'PHOTO' | 'QUESTION'; body?: string; mediaIds?: string[]; speciesCategory?: string };
          const created = communityPost({
            id: `10000000-0000-4000-8000-${String(c.posts.length + 1).padStart(12, '0')}`,
            type: data.type,
            body: data.body ?? '',
            speciesCategory: data.speciesCategory ?? null,
            createdAt: now(),
            author: { handle: c.me.profile?.handle ?? null, avatarUrl: null },
            media: (data.mediaIds ?? []).map((id) => ({ id, url: `${COMMUNITY_MEDIA_PREFIX}${id}.webp`, width: 480, height: 320 })),
            isMine: true,
          });
          c.posts.unshift(created);
          return json(route, 201, created);
        }
      }
      const postMatch = /^\/community\/posts\/([^/]+)(\/(comments|like|report))?$/.exec(pathname);
      if (postMatch) {
        const target = c.posts.find((p) => p.id === postMatch[1]);
        if (!target) return notFound();
        const sub = postMatch[3];
        if (!c.comments[target.id]) c.comments[target.id] = [];
        const comments = c.comments[target.id];
        if (!sub && method === 'GET') return json(route, 200, { ...target, comments: { items: comments, nextCursor: null } });
        if (sub === 'comments' && method === 'GET') return json(route, 200, { items: comments, nextCursor: null });
        if (sub === 'comments' && method === 'POST') {
          if (isGuest) return forbiddenGuest();
          const { body: text, parentId } = (body ?? {}) as { body?: string; parentId?: string };
          const created: MockCommunityComment = {
            id: `20000000-0000-4000-8000-${String(comments.length + 1).padStart(12, '0')}`,
            postId: target.id,
            parentId: parentId ?? null,
            body: text ?? '',
            status: 'VISIBLE',
            createdAt: now(),
            author: { handle: c.me.profile?.handle ?? null, avatarUrl: null },
            isMine: true,
            isHelpful: false,
          };
          if (parentId) comments.find((cm) => cm.id === parentId)?.replies?.push(created);
          else comments.push({ ...created, replies: [] });
          target.commentCount += 1;
          return json(route, 201, created);
        }
        if (sub === 'like') {
          if (isGuest && method === 'PUT') return forbiddenGuest();
          target.likedByMe = method === 'PUT';
          target.likeCount = Math.max(0, target.likeCount + (method === 'PUT' ? 1 : -1));
          return json(route, 200, { liked: target.likedByMe, likeCount: target.likeCount });
        }
        if (sub === 'report' && method === 'POST') {
          if (target.isMine) return json(route, 400, { statusCode: 400, code: 'COMMUNITY_CANNOT_REPORT_OWN', message: 'own' });
          return json(route, 200, { reported: true, alreadyReported: false });
        }
      }
      if (method === 'POST' && /^\/community\/comments\/[^/]+\/report$/.test(pathname)) {
        return json(route, 200, { reported: true, alreadyReported: false });
      }
      const userMatch = /^\/community\/users\/([^/]+)(\/posts)?$/.exec(pathname);
      if (userMatch && method === 'GET') {
        const handle = decodeURIComponent(userMatch[1]);
        const posts = c.posts.filter((p) => p.author.handle === handle);
        if (!posts.length && handle !== c.me.profile?.handle) return notFound();
        if (userMatch[2]) return json(route, 200, { items: posts, nextCursor: null });
        return json(route, 200, {
          handle,
          avatarUrl: null,
          memberSince: '2026-09-01T10:00:00.000Z',
          postCount: posts.length,
          isMe: handle === c.me.profile?.handle,
        });
      }
      const blockMatch = /^\/community\/blocks\/([^/]+)$/.exec(pathname);
      if (blockMatch && (method === 'PUT' || method === 'DELETE')) {
        const handle = decodeURIComponent(blockMatch[1]);
        if (method === 'PUT' && !c.blocks.some((b) => b.handle === handle)) c.blocks.push({ handle, avatarUrl: null, blockedAt: now() });
        if (method === 'DELETE') c.blocks = c.blocks.filter((b) => b.handle !== handle);
        return json(route, 200, { handle, blocked: method === 'PUT' });
      }
    }

    // --- Animaux de l'utilisateur ---
    if (pathname.startsWith('/users/me') && !authorized) return unauthorized();

    if (pathname === '/users/me/animals') {
      if (method === 'GET') return json(route, 200, api.animals);
      if (method === 'POST') {
        // Limite de l'offre (D-16) : 1 animal pour un invité ou un compte sans Premium.
        const current = sessionUser();
        if (api.animals.length >= 1 && (current.isGuest === true || current.isPremium !== true)) {
          return json(route, 403, { statusCode: 403, code: 'ANIMAL_LIMIT', message: 'Free users can only have 1 animal.' });
        }
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
    if (method === 'GET' && EMPTY_ANIMAL_COLLECTIONS.test(pathname)) {
      const collection = pathname.split('/').pop() ?? '';
      return json(route, 200, api.collections[collection] ?? []);
    }
    // Agenda agrégé (tableau de bord « Aujourd'hui », page Agenda).
    if (method === 'GET' && pathname === '/users/me/agenda') {
      return json(route, 200, { from: url.searchParams.get('from'), to: url.searchParams.get('to'), items: api.agenda, truncated: false });
    }
    // Carnet imprimable : l'export reprend l'animal et ses sous-collections simulées.
    const carnetMatch = /^\/users\/me\/animals\/([^/]+)\/carnet\/export$/.exec(pathname);
    if (method === 'GET' && carnetMatch) {
      const found = api.animals.find((a) => a.id === carnetMatch[1]);
      if (!found) return json(route, 404, { statusCode: 404, message: 'Animal introuvable' });
      return json(route, 200, {
        exportedAt: new Date().toISOString(),
        animal: found,
        sections: {
          healthRecords: api.collections['health-records'] ?? [],
          measurements: api.collections.measurements ?? [],
          vaccinations: api.collections.vaccinations ?? [],
          medications: api.collections.medications ?? [],
          vetAppointments: api.collections['vet-appointments'] ?? [],
        },
      });
    }
    if (method === 'GET' && /^\/users\/me\/animals\/[^/]+\/public-link$/.test(pathname)) {
      return json(route, 200, { enabled: false, showHealth: false, slug: null, url: null });
    }

    // --- Outils (agenda, paramètres, abonnement, magasin) : états par défaut d'un compte gratuit ---
    if (method === 'GET' && pathname === '/users/me/agenda/calendar-token') return json(route, 200, { active: false });
    if (method === 'GET' && pathname === '/users/me/subscription') return json(route, 200, { premium: false, isPremium: false });
    if (method === 'GET' && pathname === '/users/me/notification-preferences') {
      return json(route, 200, { types: {}, typeSchedules: {}, schedule: { start: '08:00', end: '22:00' }, snooze: 15, deliveryChannel: 'push' });
    }
    if (method === 'GET' && pathname === '/notifications/vapid-public-key') return json(route, 200, { publicKey: '' });
    if (method === 'GET' && pathname === '/users/me/grade') {
      return json(route, 200, { points: 0, grade: 'bronze', nextGrade: 'silver', pointsInCurrent: 0, pointsNeededForNext: 500, progressPercent: 0 });
    }
    if (method === 'GET' && pathname === '/users/me/notification-events') return json(route, 200, []);
    // Aucune boutique partenaire référencée (seed de production vide).
    if (method === 'GET' && pathname === '/affiliate-stores') return json(route, 200, []);

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

/**
 * Ouvre une session INVITÉ (comme après « Essayer sans compte ») : jetons de POST /auth/guest
 * posés avant le premier script de la page, une seule fois par contexte.
 */
export async function signInAsGuest(page: Page): Promise<void> {
  const session = { token: GUEST_TOKEN, refreshToken: 'e2e-guest-refresh', user: JSON.stringify(GUEST_USER) };
  await page.addInitScript((s) => {
    try {
      if (localStorage.getItem('__e2e_signed_in')) return;
      localStorage.setItem('__e2e_signed_in', '1');
      localStorage.setItem('token', s.token);
      localStorage.setItem('refreshToken', s.refreshToken);
      localStorage.setItem('user', s.user);
    } catch {
      // stockage indisponible : le test échouera de façon explicite
    }
  }, session);
}
