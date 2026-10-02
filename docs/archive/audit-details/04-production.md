# Audit de préparation à la production — Captivia

**Date** : 2026-08-09 · **Périmètre** : déploiement, configuration env, qualité de code, tests, observabilité, sécurité prod.
**Méthode** : lecture seule du repo (aucun fichier modifié, aucun serveur démarré). ESLint exécuté en `--no-fix` (JSON agrégé par script, fichiers temporaires supprimés). Tests : chiffres repris de `AUDIT-2026-08-09.md` et `FONCTIONNEL-AUDIT-2026-08-09.md` (non re-exécutés).

**Verdict global** : l'application est *fonctionnellement* mature (flows métier validés en live), mais **rien n'est prêt pour un déploiement en production** : aucun mécanisme de déploiement backend, `start:prod` cassé, migrations Prisma non déployables sur base vierge, pas de headers de sécurité, rate limiting auth absent, paywall factice, et un client API qui casserait en HTTPS (mixed content). Le README affirme « ✅ Production Ready! » — c'est faux.

---

## 1. DÉPLOIEMENT

### 1.1 Frontend (Vercel) — semi-préparé, jamais déployé

- **`frontend/vercel.json`** (v2) : build `@vercel/next` sur `package.json`, routes `/api/(.*)` → `/api/$1` (passthrough avec `cache-control: s-maxage=60, stale-while-revalidate`), et `env: NEXT_PUBLIC_API_URL: "@api_url"` → variable projet Vercel **`api_url`** qui n'existe pas encore (aucun projet Vercel créé / configuré).
- **`frontend/next.config.ts`** : rewrite `'/api-proxy/:path*' → ${backendUrl}/:path*` avec `backendUrl = NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'`.
  - ⚠️ **Le rewrite `/api-proxy` n'est utilisé nulle part** : `grep -rn "api-proxy" frontend/src frontend/e2e` → 0 occurrence. C'est une config morte. Tous les appels partent directement vers `NEXT_PUBLIC_API_URL` via `src/lib/api-client.ts` (axios). Le rewrite devrait être supprimé ou branché (il permettrait de masquer l'URL du backend et d'éviter le CORS).
  - ⚠️ En Vercel, la route `/api/(.*)` avec `cache-control` s'applique aussi aux API routes Next (ex. `app/api/mobile-link/route.ts`) : vérifier qu'aucune route API frontend ne doit être exclue du cache.
- `NEXT_PUBLIC_API_URL` en dev : `frontend/.env.local` → `http://localhost:3001`. En prod Vercel : **doit pointer vers l'URL HTTPS du backend** (via la variable `api_url`). Rien n'est défini aujourd'hui.

### 1.2 Backend (NestJS) — AUCUNE configuration de déploiement

- **Aucun Dockerfile** dans tout le repo (find → 0). **Aucun CI/CD** (pas de `.github/workflows`). **Aucun fichier de déploiement** (pas de `DEPLOYMENT.md`, pourtant référencé par le README — le fichier n'existe pas, comme `TESTING_CHECKLIST.md`, `CAPACITOR_SETUP.md`, `FIXES_APPLIED.md`).
- **`docker-compose.yml`** : PostgreSQL local uniquement (dev). Pas de service backend ni frontend. `POSTGRES_PASSWORD: password` en clair (I3 de l'audit sécurité — acceptable en dev, à ne jamais copier en prod).
- **`backend/package.json` scripts** :
  - `start:prod: node dist/main` → **cassé** (B5) : le build Nest sort dans `dist/src/main.js`. MODULE_NOT_FOUND au démarrage. Le serveur ne démarre qu'avec `node dist/src/main.js`.
  - Pas de script `migrate:deploy`, pas de `prestart`, pas de script de seed en prod.
  - `lint: eslint "{src,apps,libs,test}/**/*.ts" --fix` → contient `--fix` (à ne jamais lancer sans revue : 15 000+ problèmes auto-fixables, voir §3).
- **Migrations** : `prisma/migrations/` ne contient que 5 migrations incrémentales (ALTER TABLE) ; la migration de création du schéma manque → `prisma migrate deploy` **échoue (P3005/P3018) sur une base vierge** (B6). Contournement actuel : `prisma db push` (non recommandé en prod).
- **README.md §Déploiement** : aspirationnel (« Heroku, Railway, ou VPS », « Vercel (recommandé) ») — aucune procédure concrète, aucun lien, aucun environnement cible choisi.
- **`Plan de lAPI`** (racine) : plan d'intégration GBIF (référence un frontend **Flutter** qui n'existe plus — document obsolète), propose « Vercel Serverless » pour un backend NestJS long-running : incohérent. Aucune valeur opérationnelle pour le déploiement actuel.

### 1.3 Ce qui manque pour un backend scalable

| Élément | État | Détail |
|---|---|---|
| Dockerfile backend (multi-stage) | ❌ absent | build + prisma generate + node dist |
| Plateforme cible choisie | ❌ aucune | Railway / Fly.io / Render / VPS + reverse proxy TLS |
| Migrations au deploy | ❌ | `prisma migrate deploy` cassé sur DB vierge (B6) ; pas de script npm |
| Healthcheck | ⚠️ partiel | `GET /monitoring/health` existe (metrics.service) mais **désactivé si REDIS_ENABLED ≠ true** ; rien ne le branche sur la plateforme (probe) |
| Graceful shutdown | ❌ | `main.ts` n'appelle pas `app.enableShutdownHooks()` ; seul `PrismaService.onModuleDestroy` existe (ne ferme pas le serveur HTTP proprement sur SIGTERM) |
| Gestion des signaux | ❌ | aucun handler SIGTERM/SIGINT, aucun handler `unhandledRejection`/`uncaughtException` |
| Multi-instances / sessions | ❌ | rate limiting in-memory par défaut (incohérent en multi-réplicas) ; pas de Redis requis |
| Environnements (staging/preprod) | ❌ | un seul `.env.example`, pas de notion d'environnement |

---

## 2. CONFIGURATION ENV

### 2.1 Inventaire complet des variables utilisées

**Backend** (union de `process.env.*` direct, `ConfigService.get(...)` et schéma Joi de `app.module.ts`) :

| Variable | Utilisée où | Dans `.env.example` ? | Requise prod ? |
|---|---|---|---|
| `DATABASE_URL` | app.module (Joi **required**) | ✅ | **OUI (bloquant)** |
| `JWT_SECRET` | auth.module, jwt.strategy (Joi min 16, required) | ✅ | **OUI (bloquant)** |
| `PORT` | main.ts (défaut 3001) | ✅ | non (défaut) |
| `HOST` | main.ts (défaut 0.0.0.0) | ✅ commenté | non |
| `CORS_ORIGIN` | main.ts — **défaut `*` + credentials** | ❌ **ABSENT** | **OUI** (sinon CORS ouvert) |
| `CACHE_TYPE` | app.module (memory/redis/memcached) | ✅ | non (défaut memory) |
| `CACHE_TTL` | main.ts, cache | ✅ | non |
| `CACHE_TTL_SPECIES/SEARCH/VERNACULAR/METRICS/MEDIA/DISTRIBUTIONS` | cache/cache.config.ts | ❌ **ABSENTS** | non (défauts code) |
| `REDIS_ENABLED` | app.module (modules conditionnels) | ✅ | selon infra |
| `REDIS_HOST/PORT/PASSWORD/DB` | app.module, rate-limit.guard, error-tracking | ✅ | si Redis |
| `MEMCACHED_HOST/PORT` | cache | ✅ | si memcached |
| `MAIL_HOST/PORT/USER/PASS/FROM/SECURE` | auth.service (reset email) | ⚠️ commentés ; `MAIL_SECURE` ❌ absent | **OUI** (sinon reset link loggé en console — inacceptable en prod) |
| `FRONTEND_URL` | auth.service (reset link, défaut localhost:3001) | ✅ | **OUI** |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | notifications.service — **code commenté** (web-push non implémenté) | ✅ | dès que push activé |
| `VAPID_SUBJECT` | idem (mort) | ✅ | dès que push activé |
| `SPECIESPLUS_API_TOKEN` | legislation (Species+) | ✅ | **OUI** (sinon données vides, 401 interne silencieuse — N2) |
| `AMAZON_ACCESS_KEY/SECRET_KEY/AFFILIATE_TAG/MARKETPLACE` | equipment (Amazon PA) | ✅ | **OUI** (affiliation = modèle éco) |
| `OPERATOR_EMAILS` | auth.service (`effectivePremium`) | ⚠️ seul `OPERATOR_EMAIL` documenté | **OUI** (attention M4 : inscription possible sur email opérateur non confirmé) |
| `API_RATE_LIMIT_ENABLED/TTL` | api.config.ts | ✅ | non |
| `LOG_LEVEL` / `LOG_FORMAT` | api.config.ts — **jamais appliqués** (pas de `Logger.useLogger` au bootstrap) | ✅ | cosmétique (mort) |
| `WIKIPEDIA_API_BASE_URL/RATE_LIMIT/RATE_WINDOW` | api.config.ts | ✅ | non (défauts) |
| `WIKIDATA_API_BASE_URL/RATE_LIMIT/RATE_WINDOW` | api.config.ts (bug : `getWikipediaRateLimit` lit `WIKIDATA_RATE_WINDOW`) | ✅ | non |
| `JWT_EXPIRATION` | — | ✅ mais **MORT** : `expiresIn: '7d'` hardcodé dans auth.module.ts | à brancher ou retirer |
| `GBIF_API_BASE_URL` | — | ✅ commenté mais **MORT** (URL hardcodée dans gbif) | à retirer de l'exemple |
| `OPERATOR_EMAIL` (singulier) | auth.service | ✅ | alias de OPERATOR_EMAILS |

**Frontend** : `NEXT_PUBLIC_API_URL` (api-client.ts, 5× ; **la seule variable runtime**) · `PORT` (playwright) · `E2E_EMAIL` / `E2E_PASSWORD` / `BASE_URL` (tests e2e uniquement) · `VERCEL_APP_URL` (racine, script `vercel:open`).

### 2.2 Écarts exemple ↔ code (résumé)

- **Manquantes dans `backend/.env.example`** : `CORS_ORIGIN` (critique), `CACHE_TTL_*` (6 variables), `MAIL_SECURE`.
- **Présentes dans l'exemple mais mortes** : `JWT_EXPIRATION`, `GBIF_API_BASE_URL`, `VAPID_SUBJECT` (et VAPID_* tant que web-push est commenté).
- **Cohérence des ports** : 3 sources contradictoires — racine `.env.example` dit backend 3001 / frontend 3000 ; `frontend/.env.example` dit `NEXT_PUBLIC_API_URL=http://localhost:3000` ; `frontend/.env.local` et `backend/.env.example` disent backend 3001. Le README dit backend 3000. **À unifier** (la réalité : backend 3001, frontend 3000).
- Secrets : `.gitignore` couvre `.env`/`.env.local` ✅ ; aucun secret committé ✅ ; `backend/.env` réel contient `JWT_SECRET` et `SPECIESPLUS_API_TOKEN` (valeurs locales, à ne pas propager).

---

## 3. QUALITÉ DE CODE

### 3.1 ESLint (exécuté `--no-fix`, JSON agrégé — 2026-08-09)

**Backend** (`src/**/*.ts`) : **128 fichiers en erreur, 16 293 messages**.

| Règle | Nb | Lecture |
|---|---|---|
| `prettier/prettier` | 15 006 | **92 %** — quasi intégralement « Delete `␍` » (fins de ligne CRLF Windows). Bruit de formatage, auto-fixable, aucun risque |
| `@typescript-eslint/no-unsafe-member-access` | 508 | accès sur valeurs `any` — conséquence directe de `noImplicitAny: false` |
| `@typescript-eslint/no-unsafe-assignment` | 433 | idem |
| `@typescript-eslint/no-unsafe-return` | 87 | idem |
| `@typescript-eslint/no-unsafe-call` | 63 | idem |
| `@typescript-eslint/no-unsafe-argument` | 60 | idem |
| `@typescript-eslint/no-unused-vars` | 43 | code mort |
| `@typescript-eslint/no-misused-promises` | 28 | promesses non awaitées |
| `@typescript-eslint/unbound-method` | 28 | perte de `this` |
| `@typescript-eslint/await-thenable` | 18 | await sur non-promesse |
| autres (`require-await`, `no-require-imports`, `prefer-promise-reject-errors`, `prefer-const`…) | 19 | mineurs |

→ **~1 287 vrais problèmes typescript-eslint** (hors prettier) : tous liés au typage laxiste. Par dossier : `external` 2 835, `species` 1 933, `transformers` 1 162, `animals` 985, `notifications` 857, `routines` 843, `equipment` 837, `gateway` 786, `cache` 679, `legislation` 676, `auth` 675, `monitoring` 575, `health-content` 544, `filters` 452, `grade` 410, `analytics` 397, `food` 370, `database` 364, `common` 308, `dto` 146, `config` 97, `app.module.ts` 87, `subscription` 84, `affiliate` 71, `main.ts` 45, `gbif` 27, `prisma` 25, `health` 23.

**Frontend** (`src/**/*.{ts,tsx}`) : **18 fichiers en erreur, 114 messages** — `no-explicit-any` 57, `react/no-unescaped-entities` 17, `no-unused-vars` 15, `no-require-imports` 8, `no-img-element` 7, `react-hooks/set-state-in-effect` 4, `react-hooks/exhaustive-deps` 4, `prefer-const` 2. Par dossier : `app` 95, `lib` 10, `components` 8, `contexts` 1.

> Note : le chiffre « 1 439 problèmes » du contexte précédent correspond vraisemblablement à un périmètre/comptage différent (par ex. règles hors prettier ou périmètre `src` restreint). La mesure fraîche ci-dessus fait foi : **16 407 messages bruts, dont 15 006 de formatage CRLF**.

### 3.2 Typage `any` explicite

- Backend : **`: any` × 97** (transformers/species-transformer 17, wikidata 10, data-transformer.interface 8, gateway 6, species-profile 5, advanced-search 5, species.service 4…) + **`as any` × 18**.
- Frontend : **`: any` × 27** (mes-animaux/[id] 7, lib/api 5, notifications 5, page.tsx 5…) + **`as any` × 20**.
- **tsconfig backend** : `strictNullChecks: true` mais **`noImplicitAny: false`**, `strictBindCallApply: false`, `strictFunctionTypes`/`strictPropertyInitialization`/`noImplicitThis` non activés → **pas de mode strict**. C'est la cause racine des 1 287 erreurs `no-unsafe-*`.
- **tsconfig frontend** : `strict: true` ✅ (mais les `any` explicites restent autorisés).

### 3.3 Build

- `next build` ✅ (18 pages, vérifié lors de l'audit fonctionnel).
- `nest build` ✅ sort dans `dist/src/` — d'où le `start:prod` cassé.

---

## 4. TESTS — bilan chiffré (données FONCTIONNEL-AUDIT-2026-08-09)

| Suite | Résultat | Détail |
|---|---|---|
| Backend unit (jest) | **265 tests passent ; 5 suites rouges = 22 tests échoués** (sur ~17 suites) | `auth.service.spec` (spy sur `bcrypt`, le code utilise `bcryptjs`), `animals.service.spec` (mock prisma sans `$transaction`), `gbif.service.spec`, `species.controller.spec`, `species.service.spec` |
| Backend e2e (supertest + DB locale) | **32/33** | l'échec = bug B1 (login renvoie 201 au lieu de 200 — le test est juste, c'est le code qui est faux) |
| Backend e2e edge-cases | 2 vrais échecs | B7 (inscription concurrente → 500 au lieu de 409) + timeout réseau (B9, pagination) ; +1 test mal écrit (dépend de l'état DB) |
| Backend e2e security | 1 test mal écrit | CORS sans header Origin → ACAO absent (comportement standard de `cors()`) |
| Backend e2e performance | timeout | B9 : recherche espèces en direct GBIF > 5 s |
| Frontend unit (jest) | **2/3 suites vertes** | `api.test.ts` : 6 tests rouges — mocks obsolètes (le code a évolué : URLs complètes, paramètres category/size) |
| Frontend e2e (Playwright) | **cassé** | `playwright.config.ts` : `baseURL: 'http://localhost:3001'` = le **backend** ; webserver `dev:local` (:3000) attendu sur :3001 → jamais prêt. home.spec : 4 échecs / 1 pass |

**Causes racines des suites rouges** : majoritairement **mocks obsolètes** (le code a évolué sans les tests : bcrypt→bcryptjs, prisma $transaction, formes d'URL frontend) ; quelques **vrais bugs** que les tests capturent correctement (B1 : 201≠200, B7 : P2002 non géré, B8 : config Playwright).

**Tests MANQUANTS critiques pour la prod** :
1. **Aucun test e2e payment/subscription** (le paywall est un mock — aucun test ne verrouillerait son remplacement).
2. **Aucun test sur le rate limiting** (auth illimitée : pas de test de brute-force, pas de test du guard XFF).
3. Aucun test de `prisma migrate deploy` sur base vierge (le bug B6 n'a pas été attrapé).
4. Aucun test e2e du reset-password par email (SMTP), ni du flow push (web-push commenté).
5. Aucun test de charge/performance automatisé (le seul test perf timeoute).
6. Aucun test de sécurité automatisé des headers (Helmet absent → rien ne le vérifiera).

---

## 5. OBSERVABILITÉ

- **Pas de vrai logger structuré** : `console.log/error/warn` × **18 dans backend/src** (speciesplus 5, main.ts 4, openpetfoodfacts 3, pubmed 2, amazon-pa 2, notifications 1, auth 1 — dont le reset link en clair dans la console) et × **35 dans frontend/src** (mes-animaux/[id]/page.tsx : 17 à lui seul !). NestJS `Logger` utilisé dans 23 fichiers backend, mais :
  - `LOG_LEVEL` / `LOG_FORMAT` (json) sont **configurés nulle part** : `ApiConfigService.getLogLevel/getLogFormat` ne sont jamais appelés, aucun `app.useLogger()` → sortie console non structurée, pas de corrélation de requêtes.
- **Module `monitoring/`** : metrics.service (requêtes, temps de réponse, cache hits), error-tracking (logs d'erreurs en Redis), analytics, database-optimization. **Tous chargés conditionnellement à `REDIS_ENABLED=true`** (app.module.ts:82) ; `ErrorTrackingService` injecte Redis directement. En config par défaut (memory) : `/monitoring/*`, `/analytics/*`, `/database/stats`, `/errors/*` → **404** (N1). Décision à prendre : Redis obligatoire en prod (pour le rate limit distribué ET l'observabilité), ou module à re-architecturer.
- **Erreurs non captées** : aucun handler `process.on('unhandledRejection')` / `uncaughtException` dans le backend ; pas de Sentry, **pas d'APM**. Le `HttpExceptionFilter` standardise les réponses d'erreur HTTP mais n'écrit nulle part de log d'erreur exploitable (il ne fait pas appel à ErrorTrackingService).
- **Frontend** : `ErrorBoundary` présent (console.error uniquement), pas de Sentry.
- **Aucune métrique métier** (conversions, inscription, push) — seulement des compteurs HTTP en mémoire (perdus au redémarrage, non exposés Prometheus).

---

## 6. SÉCURITÉ PROD (complément à AUDIT-2026-08-09.md)

Rappel des findings sécurité (AUDIT-2026-08-09.md) : H1 paywall mock, H2 48 vuln backend (2 critical) + 17 frontend (12 high), M1 pas de rate limit auth, M2 XFF spoofable, M3 DoS `/gateway/search`, M4 premium opérateur usurpable, M5 CORS `*` + credentials, M6 pas de Helmet, L1 endpoints admin accessibles à tout compte, L2 open-data sans rate limit, L3 baseUrl QR non validé, L4 QR expose notes privées, I1 JWT en localStorage, I2 mobile-link expose IP LAN, I3 password docker-compose en clair, I4 mixed content.

**Compléments spécifiques prod** :

| Sujet | État | Action requise |
|---|---|---|
| **Mixed content `http://${host}:3001`** (`frontend/src/lib/api-client.ts:10`) | 🔴 **BLOQUANT** | `getApiBase()` : si l'hôte n'est pas localhost, il construit `http://<host>:3001`. Sur un frontend servi en HTTPS (Vercel), le navigateur **bloque** ces requêtes (mixed content) — et le port 3001 du backend n'est de toute façon pas exposé. De plus, en cas de serveur HTTP derrière un domaine, le JWT transiterait en clair. **Correction** : supprimer cette branche ; utiliser exclusivement `NEXT_PUBLIC_API_URL` (URL HTTPS absolue du backend) ; prévoir reverse proxy TLS devant le backend. |
| Helmet / CSP / HSTS / X-Frame-Options / X-Content-Type-Options | ❌ absent (M6) | `app.use(helmet())` + CSP adapté (Next sert ses propres headers côté Vercel ; à vérifier sur la config Vercel aussi) |
| Rate limiting auth (login/register/forgot-password) | ❌ absent (M1) | throttler 5-10 essais/min/IP+email sur `/auth/*` |
| XFF spoofing | ❌ (M2) | `rate-limit.guard.ts:96` lit le premier XFF : lire `req.ip` avec `trust proxy` configuré (et le proxy qui écrase XFF) |
| CORS | ❌ `*` + credentials (M5) | `CORS_ORIGIN` = origine exacte du frontend ; retirer `credentials: true` (auth par Bearer, pas de cookies) |
| Secrets management | ⚠️ | `.env` ignorés par git ✅ ; mais pas de gestionnaire de secrets (Vercel env / plateforme), `JWT_SECRET` et tokens API à injecter proprement ; `docker-compose` dev à ne pas copier |
| Backup DB | ❌ aucun | PITR ou dumps quotidiens + **test de restauration** avant le lancement |
| Rotation des clés | ❌ aucune | procédure de rotation JWT_SECRET (expiration 7 j) et VAPID |
| Cookies vs localStorage (I1) | ⚠️ | JWT en localStorage (volable par XSS) ; passer à cookie HttpOnly + SameSite=Strict (P2) |
| TLS | ❌ | backend non exposé en HTTPS : reverse proxy TLS obligatoire (Caddy/Nginx/Traefik ou TLS de la plateforme) |
| `mobile-link/route.ts` (I2) | ⚠️ | renvoie l'IP LAN : à neutraliser en prod |
| Vulnérabilités npm (H2) | 🔴 | `npm audit fix` (backend 48 dont 2 critical ; frontend 17) : `next` → 16.3.0 (request smuggling), `nodemailer` → 9.x (SMTP injection, major), `axios`, `@nestjs/core`, `@swc/cli`… |

---

## 7. CHECKLIST DE PASSAGE EN PROD MONDIALE (ordonnée, chiffrée)

Légende effort : h = heures, j = jours-homme. Total avant lancement ≈ **15–18 j**.

### P0 — Bloqueurs (rien ne se déploie tant que ce n'est pas fait)

| # | Action | Effort |
|---|---|---|
| P0.1 | **Bloquer l'auto-upgrade premium** (H1) : retirer l'endpoint d'activation ou le verrouiller (flag admin / vrai paiement Stripe Checkout ou Paddle) | 2–3 j |
| P0.2 | **Réparer `start:prod`** : `node dist/src/main` ou `entryFile` nest-cli ; tester le build de prod de bout en bout | 0,5 h |
| P0.3 | **Migrations déployables** : générer la migration baseline, valider `prisma migrate deploy` sur base vierge, ajouter le script au déploiement | 3–4 h |
| P0.4 | **`npm audit fix`** backend + frontend (next 16.3.0, nodemailer 9.x…), re-exécuter la suite de tests après | 2–4 h |
| P0.5 | **Mixed content api-client.ts** : supprimer `http://${host}:3001`, forcer `NEXT_PUBLIC_API_URL` HTTPS | 1–2 h |
| P0.6 | **CORS strict** : définir `CORS_ORIGIN`, retirer `credentials`, ajouter la variable à `.env.example` | 1 h |
| P0.7 | **Rate limiting `/auth/*`** + correction XFF/trust proxy (M1, M2) + rate limit sur `/api/open-data/*` (L2) | 3–4 h |
| P0.8 | **Helmet + headers sécurité** (CSP, HSTS, X-Frame-Options) côté API ; vérifier headers Vercel côté front | 2 h |
| P0.9 | **Déploiement backend** : Dockerfile multi-stage, choix plateforme (Railway/Fly/Render/VPS), reverse proxy TLS, healthcheck branché sur `/monitoring/health` (ou healthcheck dédié non-Redis), `enableShutdownHooks()` + gestion SIGTERM | 1–2 j |
| P0.10 | **Config env prod complète** : `CORS_ORIGIN`, `MAIL_*` (+`MAIL_SECURE`), `FRONTEND_URL`, `SPECIESPLUS_API_TOKEN`, `AMAZON_*`, `OPERATOR_EMAILS`, secrets via le gestionnaire de la plateforme ; compléter `.env.example` (CORS_ORIGIN, CACHE_TTL_*, MAIL_SECURE, retirer les morts JWT_EXPIRATION/GBIF_API_BASE_URL) | 2–3 h |

### P1 — Avant lancement (sécurité/conformité, fiabilité)

| # | Action | Effort |
|---|---|---|
| P1.1 | **Confirmation d'email à l'inscription** (M4 — empêche l'usurpation des emails opérateurs ; requiert SMTP de P0.10) | 1 j |
| P1.2 | **RBAC admin** sur `/database/stats`, `/errors/*`, `/monitoring/*`, `/analytics/*` (L1) | 3–4 h |
| P1.3 | **Borner l'enrichissement `/gateway/search`** (M3, max 10 espèces enrichies) | 2–3 h |
| P1.4 | **Corriger les bugs fonctionnels** : B1 (201→200 sur login/forgot/reset/change/subscription), B7 (P2002→409), B2/B3 (contrôleurs advanced-search & open-data non enregistrés), B4 (User-Agent Wikipedia/Wikidata), B9 (timeout recherche → cache + timeout) | 1 j |
| P1.5 | **Réparer les tests existants** : mocks unitaires backend (5 suites / 22 tests), `api.test.ts` frontend (6 tests), `playwright.config.ts` (baseURL :3000 + webserver) | 1–2 j |
| P1.6 | **Ajouter les tests critiques manquants** : e2e subscription/paiement (une fois P0.1), e2e rate limiting auth, test `migrate deploy` en CI, e2e reset-password via SMTP | 1–2 j |
| P1.7 | **Logger structuré** : remplacer les 18 console.* backend (et 35 frontend), appliquer LOG_LEVEL/LOG_FORMAT (`app.useLogger`), request-id | 4–6 h |
| P1.8 | **Décision Redis + observabilité** : activer `REDIS_ENABLED` en prod (rate limit distribué + `/monitoring/*` + `/analytics/*` fonctionnels) ou re-architecturer le module pour marcher sans Redis ; brancher un vrai stockage d'erreurs | 3–4 h |
| P1.9 | **Backup DB** : PITR ou dumps quotidiens + test de restauration documenté | 3–4 h |
| P1.10 | **Config Vercel** : créer le projet, définir `api_url` (URL HTTPS du backend), vérifier les rewrites (supprimer `/api-proxy` mort), tests e2e en CI | 2–3 h |
| P1.11 | **Push notifications** : implémenter web-push (actuellement commenté) avec VAPID — ou désactiver explicitement les rappels au lancement | 1 j |
| P1.12 | **Neutraliser `mobile-link/route.ts`** (I2) et valider `baseUrl` du QR (L3) | 1–2 h |
| P1.13 | **Unifier la doc des ports** (README/.env.example/.env.local : backend 3001, frontend 3000) et supprimer les docs fantômes référencées (DEPLOYMENT.md…) | 1 h |

### P2 — Après lancement (durcissement, scaling)

| # | Action | Effort |
|---|---|---|
| P2.1 | **Sentry (frontend + backend) + APM** : erreurs non captées, alerting | 1 j |
| P2.2 | **CI/CD complet** : GitHub Actions (lint --no-fix, test, build, migrate deploy sur DB de test, e2e, scan vulns) | 1–2 j |
| P2.3 | **tsc strict backend** : `noImplicitAny: true` + résorption des ~1 287 erreurs `no-unsafe-*` et 97 `: any` | 2–3 j |
| P2.4 | **Résorber le bruit prettier CRLF** (15 006 messages) : `.editorconfig` + normalization EOL, puis lint propre en CI | 2–3 h |
| P2.5 | **Cookies HttpOnly** à la place de localStorage pour le JWT (I1) | 1 j |
| P2.6 | **Rotation des clés** : procédure JWT/VAPID + alerte avant expiration | 3 h |
| P2.7 | **Tests de charge** (k6 : auth, species, gateway) avec objectifs chiffrés (latence p95, taux d'erreur) | 1 j |
| P2.8 | **Multi-régions / CDN** : images espèces via image cache GBIF + CDN, cache Redis partagé | 1 j |
| P2.9 | Migration `middleware.ts` → `proxy.ts` (i18n, N5) | 1 h |
| P2.10 | Observabilité continue : Prometheus + dashboards, alerting 429/5xx/latence | 1 j |

**Total estimé** : P0 ≈ 6–9 j · P1 ≈ 8–11 j · P2 ≈ 8–10 j.

---

*Sources : lecture directe du repo (vercel.json, next.config.ts, docker-compose.yml, package.json racine/backend/frontend, README.md, Plan de lAPI, .env.example ×3, main.ts, api-client.ts, app.module.ts, monitoring/*, cache.config.ts, auth.service.ts, tsconfig ×2), ESLint --no-fix agrégé (16 407 messages), grep process.env/console/any, et rapports AUDIT-2026-08-09.md + FONCTIONNEL-AUDIT-2026-08-09.md. Aucun fichier du repo n'a été modifié (fichiers eslint temporaires supprimés).*
