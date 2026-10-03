#!/usr/bin/env node
/**
 * Captures d'écran des fiches store (W6-10, MOB-38) : `npm run screenshots:store` (depuis frontend/).
 *
 * Playwright pilote le frontend de production (build standalone, comme le smoke e2e) face à une API
 * SIMULÉE (e2e/support/mock-api.ts + jeu de données propre à ces captures) : aucune requête ne
 * quitte la machine. Les photos sont celles de `public/images/animals` (licences libres, voir
 * `public/images/CREDITS.md`).
 *
 * Pages : Aujourd'hui · fiche animal · carnet · agenda · fiche espèce · ajout d'un animal.
 * Tailles : iPhone 6,9" (1320×2868) · iPhone 6,5" (1284×2778) · Play téléphone (1080×1920).
 *
 * Options :
 *   --out <dossier>      destination (défaut : <tmp>/captivia-store-shots) ; rien n'est écrit dans le dépôt
 *   --locales fr,en      langues de l'interface (défaut : fr). La fiche espèce vient de l'API (en français) :
 *                        elle n'est produite qu'en fr.
 *   --only <a,b>         noms de pages (aujourdhui, animal, carnet, agenda, espece, ajout)
 *   --port <n>           port du serveur (défaut 4410)
 *
 * Prérequis : le build de production avec l'API simulée.
 *   NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build
 * (lancé automatiquement s'il manque). Supprimer ensuite .next : `rm -rf .next out`.
 * Chromium : celui de Playwright, ou PW_CHROMIUM_PATH (voir playwright.config.ts).
 * Node 22.18+ : le script lit directement e2e/support/mock-api.ts (types retirés à la volée).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Les heures de soin sont calculées ici puis affichées par le navigateur (Europe/Paris) : même fuseau.
process.env.TZ = 'Europe/Paris';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'captivia-store-shots')));
const LOCALES = opt('locales', 'fr').split(',');
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const PORT = Number(opt('port', '4410'));
const BASE = `http://localhost:${PORT}`;

// mock-api.ts est écrit pour Playwright (CommonJS) : il lit `__dirname`, absent d'un module ES.
globalThis.__dirname = path.join(frontendDir, 'e2e', 'support');
const { installMockApi, API_ORIGIN, PHOTO_ORIGIN } = await import(path.join(frontendDir, 'e2e', 'support', 'mock-api.ts'));

/** Tailles de capture : pixels de sortie = viewport CSS × facteur d'échelle. */
const SIZES = [
  { dir: 'iphone-6.9', width: 440, height: 956, scale: 3 }, // 1320 × 2868
  { dir: 'iphone-6.5', width: 428, height: 926, scale: 3 }, // 1284 × 2778
  { dir: 'play', width: 360, height: 640, scale: 3 }, // 1080 × 1920
];

// --- Jeu de données --------------------------------------------------------------------------------

const AGAME = 2465641; // GBIF : Pogona vitticeps (agame barbu), clé de backend/prisma/species-massive-data.ts
const CHAT = 5281802; // GBIF : Felis catus, clé de backend/prisma/species-data.ts

const iso = (offsetDays, hour = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dayKey = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const utcDay = (offsetDays) => `${dayKey(offsetDays)}T00:00:00.000Z`;

const COPY = {
  fr: {
    user: 'camille@exemple.fr',
    sexMochi: 'female',
    notes: null,
    care: {
      vermifuge: 'Vermifuge',
      tcl: 'Typhus, coryza, leucose',
      rage: 'Rage',
      feed: 'Croquettes du soir',
      brush: 'Brossage',
      vet: 'Contrôle annuel',
      weigh: 'Pesée',
      uv: 'Changer le tube UVB',
      mist: 'Brumisation',
      detailFeed: '45 g',
    },
    vet: 'Dr Martin',
    vetReason: 'Contrôle annuel',
    recordTitle: 'Contrôle annuel',
    recordNotes: 'Poids stable, dents propres.',
    foodTitle: 'Croquettes stérilisé',
    foodNotes: 'Depuis la stérilisation.',
    medication: { name: 'Antiparasitaire', dose: '1', unit: 'pipette' },
    search: 'agame',
  },
  en: {
    user: 'camille@example.com',
    sexMochi: 'female',
    notes: null,
    care: {
      vermifuge: 'Dewormer',
      tcl: 'FVRCP',
      rage: 'Rabies',
      feed: 'Evening kibble',
      brush: 'Brushing',
      vet: 'Annual check-up',
      weigh: 'Weigh-in',
      uv: 'Replace the UVB tube',
      mist: 'Misting',
      detailFeed: '45 g',
    },
    vet: 'Dr Martin',
    vetReason: 'Annual check-up',
    recordTitle: 'Annual check-up',
    recordNotes: 'Stable weight, clean teeth.',
    foodTitle: 'Sterilised kibble',
    foodNotes: 'Since the spay.',
    medication: { name: 'Flea and tick treatment', dose: '1', unit: 'pipette' },
    search: 'bearded',
  },
};

function dataset(locale) {
  const c = COPY[locale] ?? COPY.fr;
  const mochi = {
    id: 'animal-mochi',
    name: 'Mochi',
    speciesId: CHAT,
    speciesName: 'Felis catus',
    birthDate: '2022-03-14T00:00:00.000Z',
    sex: c.sexMochi,
    photos: ['/images/animals/cat-tabby-800.webp'],
    notes: c.notes,
    fatherId: null,
    motherId: null,
    groupName: null,
    father: null,
    mother: null,
  };
  const sunny = {
    ...mochi,
    id: 'animal-sunny',
    name: 'Sunny',
    speciesId: AGAME,
    speciesName: 'Pogona vitticeps',
    birthDate: '2024-05-02T00:00:00.000Z',
    sex: 'male',
    photos: ['/images/animals/bearded-dragon-800.webp'],
  };
  const base = { animalId: mochi.id, animalName: 'Mochi', detail: null };
  const agenda = [
    { ...base, id: 'a1', date: iso(0, 19), day: dayKey(0), allDay: false, type: 'routine', title: c.care.feed, detail: c.care.detailFeed, status: 'pending', sourceId: 'r1' },
    { ...base, id: 'a2', date: iso(0, 21), day: dayKey(0), allDay: false, type: 'routine', title: c.care.brush, status: 'pending', sourceId: 'r2' },
    { ...base, animalId: sunny.id, animalName: 'Sunny', id: 'a3', date: iso(0, 18), day: dayKey(0), allDay: false, type: 'routine', title: c.care.mist, status: 'pending', sourceId: 'r3' },
    { ...base, id: 'a4', date: iso(2, 9), day: dayKey(2), allDay: false, type: 'vaccination', title: c.care.tcl, status: 'pending', sourceId: 'v1' },
    { ...base, id: 'a5', date: iso(3, 14), day: dayKey(3), allDay: false, type: 'vet_appointment', title: `${c.vet} · ${c.care.vet}`, status: 'pending', sourceId: 'p1' },
    { ...base, animalId: sunny.id, animalName: 'Sunny', id: 'a6', date: iso(5, 10), day: dayKey(5), allDay: false, type: 'routine', title: c.care.weigh, status: 'pending', sourceId: 'r4' },
    { ...base, id: 'a7', date: iso(6, 19), day: dayKey(6), allDay: false, type: 'routine', title: c.care.feed, detail: c.care.detailFeed, status: 'pending', sourceId: 'r1' },
    { ...base, animalId: sunny.id, animalName: 'Sunny', id: 'a8', date: iso(9, 10), day: dayKey(9), allDay: false, type: 'routine', title: c.care.uv, status: 'pending', sourceId: 'r5' },
    { ...base, id: 'a9', date: iso(-1, 19), day: dayKey(-1), allDay: false, type: 'routine', title: c.care.feed, detail: c.care.detailFeed, status: 'done', sourceId: 'r1' },
  ];
  const collections = {
    'animal-mochi': {
      measurements: [
        { id: 'w1', weightKg: 3.92, heightCm: null, measuredAt: iso(-180, 10), notes: null },
        { id: 'w2', weightKg: 4.01, heightCm: null, measuredAt: iso(-120, 10), notes: null },
        { id: 'w3', weightKg: 4.08, heightCm: null, measuredAt: iso(-75, 10), notes: null },
        { id: 'w4', weightKg: 4.12, heightCm: null, measuredAt: iso(-40, 10), notes: null },
        { id: 'w5', weightKg: 4.2, heightCm: null, measuredAt: iso(-6, 10), notes: null },
      ],
      vaccinations: [
        { id: 'v1', name: c.care.tcl, date: iso(-363, 10), nextDueDate: utcDay(2), batchNumber: null, vetName: null, notes: null },
        { id: 'v2', name: c.care.rage, date: iso(-330, 10), nextDueDate: utcDay(35), batchNumber: null, vetName: null, notes: null },
        { id: 'v3', name: c.care.vermifuge, date: iso(-55, 10), nextDueDate: utcDay(35), batchNumber: null, vetName: null, notes: null },
      ],
      medications: [
        { id: 'm1', name: c.medication.name, dose: c.medication.dose, unit: c.medication.unit, frequency: 'weekly', intervalHours: null, startDate: iso(-4), endDate: utcDay(24), notes: null, active: true },
      ],
      'vet-appointments': [
        { id: 'p1', vetName: c.vet, reason: c.vetReason, date: iso(3, 14), location: null, notes: null, status: 'scheduled', reminderDays: [1] },
      ],
      'health-records': [
        { id: 'h1', type: 'medical_history', title: c.recordTitle, date: iso(-330, 10), notes: c.recordNotes, details: null, createdAt: iso(-330, 10) },
        { id: 'h2', type: 'specific_food', title: c.foodTitle, date: iso(-200, 10), notes: c.foodNotes, details: null, createdAt: iso(-200, 10) },
      ],
      routines: [
        { id: 'r1', name: c.care.feed, type: 'feeding', frequency: 'daily', schedule: { time: '19:00', recurrence: 'daily' }, active: true },
        { id: 'r2', name: c.care.brush, type: 'cleaning', frequency: 'daily', schedule: { time: '21:00', recurrence: 'daily' }, active: true },
      ],
    },
    'animal-sunny': {
      measurements: [
        { id: 'w1', weightKg: 0.36, heightCm: null, measuredAt: iso(-60, 10), notes: null },
        { id: 'w2', weightKg: 0.41, heightCm: null, measuredAt: iso(-8, 10), notes: null },
      ],
      routines: [{ id: 'r3', name: c.care.mist, type: 'cleaning', frequency: 'daily', schedule: { time: '18:00', recurrence: 'daily' }, active: true }],
    },
  };
  return { mochi, sunny, agenda, collections, user: { id: 'user-store-1', email: c.user, locale, isPremium: true, emailVerified: true } };
}

/** Fiche de l'agame barbu : valeurs d'élevage usuelles, sources publiques réelles (Wikipédia). */
const AGAME_SPECIES = {
  key: AGAME,
  scientificName: 'Pogona vitticeps (Ahl, 1926)',
  canonicalName: 'Pogona vitticeps',
  rank: 'SPECIES',
  iucnStatus: 'LC',
  kingdom: 'Animalia',
  phylum: 'Chordata',
  class: 'Reptilia',
  order: 'Squamata',
  family: 'Agamidae',
  genus: 'Pogona',
  profile: {
    speciesId: AGAME,
    sourceUrl: 'https://fr.wikipedia.org/wiki/Pogona_vitticeps',
    commonNameFr: 'Agame barbu',
    scientificName: 'Pogona vitticeps',
    category: 'reptile',
    subcategory: 'lézard',
    domesticationType: 'NAC',
    description:
      "Pogona vitticeps, appelé agame barbu, est une espèce de sauriens de la famille des Agamidae, qui vit en Australie où elle est endémique. C'est une espèce populaire en terrariophilie.",
  },
  habitat: {
    habitatType: 'Terrarium',
    tempMin: 26,
    tempMax: 30,
    humidityMin: 30,
    humidityMax: 40,
    minSpaceSize: '120 × 60 × 60 cm (adulte)',
    lightNeeds: 'Cycle jour/nuit de 12 h, avec un tube UVB et un point chaud.',
    sources: [{ title: 'Wikipédia : Agame barbu', url: 'https://fr.wikipedia.org/wiki/Pogona_vitticeps' }],
  },
  feeding: {
    dietType: 'omnivore',
    mealFrequency: 'daily',
    recommendedFoods: [
      { name: 'Insectes (grillons, criquets)', frequency: 'surtout chez les jeunes' },
      { name: 'Verdures et salades variées', frequency: 'chaque jour chez l’adulte' },
    ],
    foodsToAvoid: [{ name: 'Avocat', reason: 'toxique' }],
    specificNeeds: null,
    sources: [{ title: 'Wikipédia : Agame barbu', url: 'https://fr.wikipedia.org/wiki/Pogona_vitticeps' }],
  },
  behavior: {
    generalBehavior: 'Diurne, il aime se chauffer sous la lampe et observer son environnement.',
    sociability: 'solitaire',
    difficultyLevel: 'debutant',
    compatibilityWithChildren: null,
    compatibilityWithOtherAnimals: null,
    sources: [{ title: 'Wikipédia : Agame barbu', url: 'https://fr.wikipedia.org/wiki/Pogona_vitticeps' }],
  },
  lastReviewedAt: new Date().toISOString(),
};

const CHAT_SPECIES = {
  key: CHAT,
  scientificName: 'Felis catus Linnaeus, 1758',
  canonicalName: 'Felis catus',
  rank: 'SPECIES',
  kingdom: 'Animalia',
  phylum: 'Chordata',
  class: 'Mammalia',
  order: 'Carnivora',
  family: 'Felidae',
  genus: 'Felis',
  profile: {
    speciesId: CHAT,
    sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
    commonNameFr: 'Chat domestique',
    scientificName: 'Felis catus',
    category: 'mammifère',
    subcategory: 'félin',
    domesticationType: 'domestique',
    description: null,
  },
  habitat: null,
  feeding: null,
  behavior: null,
};

// --- Serveur et API simulée -------------------------------------------------------------------------

const json = (route, body, status = 200) =>
  route.fulfill({
    status,
    headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Surcharges par-dessus le simulateur de base : les gestionnaires ajoutés après passent en premier. */
async function installStoreApi(page, data, { animals }) {
  const photo = readFileSync(path.join(frontendDir, 'public', 'images', 'animals', 'bearded-dragon-800.webp'));
  await page.route(`${PHOTO_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: photo }));

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const { pathname, searchParams } = new URL(request.url());
    const bearer = (request.headers().authorization ?? '').startsWith('Bearer ');

    if (pathname === '/auth/me') return bearer ? json(route, data.user) : route.fallback();
    if (pathname === '/users/me/animals') return json(route, animals);
    const one = /^\/users\/me\/animals\/([^/]+)$/.exec(pathname);
    if (one) {
      const found = animals.find((a) => a.id === one[1]);
      return found ? json(route, found) : route.fallback();
    }
    const sub = /^\/users\/me\/animals\/([^/]+)\/([a-z-]+)$/.exec(pathname);
    if (sub && data.collections[sub[1]] && sub[2] !== 'public-link' && sub[2] !== 'carnet') {
      return json(route, data.collections[sub[1]][sub[2]] ?? []);
    }
    const carnet = /^\/users\/me\/animals\/([^/]+)\/carnet\/export$/.exec(pathname);
    if (carnet) {
      const found = animals.find((a) => a.id === carnet[1]);
      const col = data.collections[carnet[1]] ?? {};
      if (!found) return route.fallback();
      return json(route, {
        exportedAt: new Date().toISOString(),
        animal: found,
        sections: {
          healthRecords: col['health-records'] ?? [],
          measurements: col.measurements ?? [],
          vaccinations: col.vaccinations ?? [],
          medications: col.medications ?? [],
          vetAppointments: col['vet-appointments'] ?? [],
        },
      });
    }
    if (pathname === '/users/me/agenda') {
      const from = searchParams.get('from') ?? '';
      const to = searchParams.get('to') ?? '9999';
      const items = data.agenda.filter((i) => i.animalId && animals.some((a) => a.id === i.animalId) && i.day >= from && i.day <= to);
      return json(route, { from, to, items, truncated: false });
    }
    if (pathname === '/species/search') {
      const q = (searchParams.get('q') ?? '').toLowerCase();
      const hit = ['agame', 'bearded', 'pogona'].some((w) => q.includes(w) || w.startsWith(q));
      return json(route, {
        total: hit ? 1 : 0,
        source: 'catalogue',
        results: hit
          ? [{ key: AGAME, scientificName: 'Pogona vitticeps', canonicalName: 'Pogona vitticeps', vernacularName: data.user.locale === 'fr' ? 'Agame barbu' : 'Bearded dragon', vernacularNames: ['Agame barbu'], class: 'Reptilia', order: 'Squamata', family: 'Agamidae', rank: 'SPECIES', iucnStatus: 'LC' }]
          : [],
      });
    }
    if (pathname === `/species/${AGAME}`) return json(route, AGAME_SPECIES);
    if (pathname === `/species/${CHAT}`) return json(route, CHAT_SPECIES);
    if (pathname === `/species/${AGAME}/media`) {
      return json(route, [
        {
          type: 'StillImage',
          format: 'image/jpeg',
          creator: 'Virtual-Pano',
          license: 'http://creativecommons.org/licenses/by/4.0/',
          identifier: `${PHOTO_ORIGIN}/pogona/bearded-dragon.jpg`,
          url: `${PHOTO_ORIGIN}/pogona/bearded-dragon.jpg`,
          references: 'https://commons.wikimedia.org/wiki/File:383_-_Head_of_central_bearded_dragon_(Pogona_vitticeps).jpg',
          title: 'Pogona vitticeps',
        },
      ]);
    }
    if (/^\/species\/\d+\/(health|legislation|reproduction)$/.test(pathname)) {
      return json(route, { statusCode: 404, message: 'Not found' }, 404);
    }
    return route.fallback();
  });
}

async function serverUp() {
  try {
    return (await fetch(`${BASE}/fr`, { redirect: 'manual' })).status < 500;
  } catch {
    return false;
  }
}

function ensureBuild() {
  const standalone = path.join(frontendDir, '.next', 'standalone');
  if (existsSync(path.join(standalone, 'server.js')) || existsSync(path.join(standalone, 'frontend', 'server.js'))) return;
  console.log('[captures] build de production avec l\'API simulée…');
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_API_URL: API_ORIGIN, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function chromiumPath() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    /* repli ci-dessous */
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium_headless_shell-\d+$|^chromium-\d+$/.test(d))
    .sort()
    .reverse()
    .flatMap((d) => [path.join(root, d, 'chrome-linux', 'headless_shell'), path.join(root, d, 'chrome-linux', 'chrome')]);
  return dirs.find((f) => existsSync(f));
}

// --- Pages ------------------------------------------------------------------------------------------

/** Chaque page : chemin, attente d'un repère visible, défilement éventuel, jeu d'animaux. */
const PAGES = [
  { name: 'aujourdhui', path: '/mes-animaux', ready: 'h1', animals: 'both' },
  { name: 'animal', path: '/mes-animaux/animal-mochi', ready: 'h1', animals: 'both', scrollTo: null },
  { name: 'carnet', path: '/mes-animaux/animal-mochi/carnet', ready: 'h1', animals: 'both' },
  { name: 'agenda', path: '/agenda', ready: 'h1', animals: 'both' },
  { name: 'espece', path: `/species/${AGAME}`, ready: 'h1', animals: 'both', frOnly: true },
  { name: 'ajout', path: '/mes-animaux', ready: '#animal-species', animals: 'none', type: 'search' },
];

async function shoot(browser, size, locale, spec, index) {
  const data = dataset(locale);
  const animals = spec.animals === 'none' ? [] : [data.mochi, data.sunny];
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    isMobile: true,
    hasTouch: true,
    locale: locale === 'fr' ? 'fr-FR' : 'en-GB',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const appOrigin = new URL(BASE).origin;
  const unmocked = [];
  await page.route(
    (url) => ![appOrigin, API_ORIGIN, PHOTO_ORIGIN].includes(url.origin) && /^https?:$/.test(url.protocol),
    (route) => route.abort(),
  );
  const api = await installMockApi(page);
  await installStoreApi(page, data, { animals });

  // Session : jetons posés avant le premier script, comme après une connexion.
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'none' })}.${encode({ sub: data.user.id, exp: 4102444800 })}.signature`;
  await page.addInitScript(
    (s) => {
      try {
        localStorage.setItem('token', s.token);
        localStorage.setItem('user', s.user);
        localStorage.setItem('captivia.locale', s.locale);
      } catch {
        /* stockage indisponible */
      }
    },
    { token, user: JSON.stringify(data.user), locale },
  );

  const url = `${BASE}${locale === 'fr' ? '' : `/${locale}`}${spec.path}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator(spec.ready).first().waitFor({ state: 'visible', timeout: 20_000 });

  if (spec.type === 'search') {
    await page.locator('#animal-species').fill(COPY[locale].search);
    await page.locator('#animal-species').blur().catch(() => {});
    await page.locator('#animal-species').focus();
    await page.getByRole('button', { name: /Pogona vitticeps/ }).first().waitFor({ state: 'visible', timeout: 10_000 });
  }
  if (spec.scrollTo) await page.locator(spec.scrollTo).first().scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const dir = path.join(OUT, size.dir);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(index + 1).padStart(2, '0')}-${spec.name}-${locale}.png`);
  await page.screenshot({ path: file });
  unmocked.push(...api.unmocked);
  await context.close();
  return { file, unmocked };
}

// --- Exécution --------------------------------------------------------------------------------------

ensureBuild();
let server = null;
if (!(await serverUp())) {
  server = spawn('node', ['e2e/support/serve.js'], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 60 && !(await serverUp()); i += 1) await new Promise((r) => setTimeout(r, 500));
  if (!(await serverUp())) {
    server.kill();
    console.error(`[captures] le serveur n'a pas démarré sur ${BASE}`);
    process.exit(1);
  }
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  // font-render-hinting=none : sans cela, Chromium sans écran espace mal certaines lettres (« f u », « é »).
  args: ['--host-resolver-rules=MAP localhost 127.0.0.1', '--font-render-hinting=none'],
});
let failures = 0;
try {
  for (const size of SIZES) {
    for (const locale of LOCALES) {
      for (const [index, spec] of PAGES.entries()) {
        if (ONLY && !ONLY.includes(spec.name)) continue;
        if (spec.frOnly && locale !== 'fr') continue;
        try {
          const { file, unmocked } = await shoot(browser, size, locale, spec, index);
          console.log(`[captures] ${path.relative(OUT, file)}${unmocked.length ? `  (API non simulée : ${unmocked.join(', ')})` : ''}`);
        } catch (error) {
          failures += 1;
          console.error(`[captures] ECHEC ${size.dir} ${locale} ${spec.name} : ${error.message.split('\n')[0]}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(`[captures] dossier : ${OUT}`);
process.exit(failures ? 1 : 0);
