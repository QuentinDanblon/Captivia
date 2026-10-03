# Audit fonctionnel Captivia — 2026-08-09

Méthode : tests unitaires (backend jest, frontend jest), tests e2e (backend supertest, frontend playwright), **tests live** de l'API complète (curl/python contre le serveur tournant sur :3001), pages frontend servies par `next start` (:3000), DB PostgreSQL locale re-créée (`prisma db push` + seed 51 espèces).

---

## ✅ Ce qui fonctionne (vérifié en live)

| Domaine | Résultat |
|---|---|
| Inscription | 201 + token, email invalide → 400, mdp < 8 → 400, doublon → 409 |
| Login | OK (mauvais mdp → 401, message uniforme) — *voir bug B1* |
| /auth/me | OK |
| Reset password | Flow complet OK : token 32B loggé (pas de SMTP), single-use (re-usage → 400), ancien mdp invalidé, login au nouveau mdp OK |
| Change password | OK (mauvais mdp actuel → 401) |
| Animaux | CRUD complet OK, limite gratuite 1 animal / premium illimité, BOLA → 403 |
| Carnet de santé | CRUD complet OK (types vaccine/surgery/specific_food/medical_history), sans premium → 403, BOLA → 403 |
| Routines | CRUD + action log + historique OK, BOLA → 403 |
| QR / page publique | Génération slug 16 chars + URL OK (premium requis → 403 sinon), page `/animal-public/<slug>` OK, slug inconnu → 404 |
| Abonnement | Statut OK (le user seed est premium) — *attention : l'activation est un mock, voir rapport sécurité* |
| Grade / points | OK, pas de re-crédit (un événement ne donne des points qu'une fois) |
| Notifications | Préférences + événements du jour OK |
| Espèces (DB locale) | Recherche, détail, vernacular, health-content, legislation, food, equipment, affiliate-stores : tous 200 |
| Gateway GBIF | enriched / complete / conservation : 200 (fallback GBIF fonctionne) |
| PubMed / Species+ | Répondent 200 (Species+ renvoie en fait une erreur 401 interne : token API non configuré → données vides, voir N2) |
| Frontend | `next build` ✓ (18 pages), pages servies (login, register, mes-animaux, species, magasin, transparency, animal-public…) : 200 |
| Seed | Complet : 51 espèces, user test `test@captivia.local` (mdp réinitialisé pendant l'audit → `NewPass456!`), animal Rango |

---

## ❌ Bugs fonctionnels

**B1 — Codes HTTP POST incorrects : login et autres renvoient 201 au lieu de 200**
`POST /auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/users/me/subscription` renvoient tous **201 Created** (défaut NestJS sur POST, aucun `@HttpCode(200)`). Non standard — certains clients/API gateways strictes cassent.
→ `@HttpCode(HttpStatus.OK)` sur ces routes.

**B2 — Recherche avancée espèces : 8 routes en 404**
`AdvancedSearchController` (`species/advanced-search.controller.ts`) n'est pas déclaré dans `species.module.ts` (controllers: [SpeciesController] uniquement). Toutes ses routes sont inaccessibles : `/species/search/advanced`, `/search/suggestions`, `/search/filters`, `/search/conservation/:status`, `/search/region/:region`, `/search/taxonomy/:taxonomic`, `/search/media/:hasMedia`, `/search/iucn/:hasIucn`.
→ Ajouter le contrôleur (+ son service s'il n'est pas fourni) au module.

**B3 — API Open Data : 6 routes en 404**
`OpenDataController` (`external/open-data.controller.ts` — wikipedia, wikidata, iNaturalist, EOL, multi, taxons) n'est enregistré dans **aucun** module. `ExternalModule` n'importe que WikipediaModule + WikidataModule.
→ Enregistrer le contrôleur (et vérifier que `OpenDataService` est fourni).

**B4 — Wikipedia et Wikidata : 403 permanents → endpoints en erreur 500**
Aucun User-Agent défini dans `wikipedia.service.ts` et `wikidata.service.ts` → axios envoie `axios/1.13.4`, que Wikipedia et Wikidata **bloquent en 403** (vérifié en curl : 403 avec UA axios, 200 avec UA descriptif). Conséquences :
- `/wikipedia/search`, `/wikidata/search`, `/gateway/wikipedia/article`, `/gateway/wikidata/entity` → **500**
- enrichissement Wikipedia/Wikidata dans `/gateway/search` et `/gateway/enriched` → silencieusement vide (le frontend affiche des fiches sans section Wikipedia/Wikidata)
- `/gateway/health` → wikipedia/wikidata « unhealthy »
GBIF fonctionne car il définit `Captivia/1.0 (https://captivia.com)`.
→ Ajouter le même User-Agent descriptif aux deux services (le fix du commit récent « GBIF fallback » montre que le pattern existe).

**B5 — `npm run start:prod` cassé**
Le script pointe vers `node dist/main` mais le build Nest sort dans `dist/src/main.js` → MODULE_NOT_FOUND au démarrage. Le serveur ne démarre qu'avec `node dist/src/main.js`.
→ Corriger le script (`node dist/src/main` ou `"entryFile": "src/main"` côté nest-cli si le layout dist/src est voulu).

**B6 — Migrations Prisma incomplètes : déploiement DB impossible sur base vierge**
`prisma/migrations/` ne contient que 5 migrations **incrémentales** (ALTER TABLE...) ; la migration de création du schéma manque. `prisma migrate deploy` échoue (P3005/P3018) sur une DB neuve. Contournement utilisé pour l'audit : `prisma db push`.
→ Générer une migration initiale (ou baseline) et vérifier `migrate deploy` sur une DB vide.

**B7 — Inscription concurrente : 500 au lieu de 409**
Deux POST `/auth/register` simultanés avec le même email → l'un passe le check `findUnique` puis crash sur la contrainte unique non gérée → **500**. (Le test e2e edge-cases « double form submission » le confirme : reçu [201, 500], attendu [201, 409].)
→ Catch de l'erreur Prisma P2002 dans register → ConflictException.

**B8 — E2E Playwright frontend : configuration cassée**
`playwright.config.ts` : `baseURL: 'http://localhost:3001'` (le **backend** !) et webserver qui lance `npm run dev:local` (frontend sur :3000) en attendant une URL sur :3001 → le webserver n'est jamais prêt, et les tests naviguent vers l'API au lieu des pages. Vérifié : home.spec → 4 échecs / 1 pass sur chromium.
→ baseURL → `http://localhost:3000`, webserver → `next dev` + url :3000.

**B9 — Recherche : pagination et requêtes lentes = timeouts** *(fragilité)*
`/species/search` appelle GBIF en direct (réseau) : le test e2e « pagination at exact boundary » et le stress test (50 req/5 s) timeout à 5 s. En usage réel, la recherche dépend de la latence GBIF (jusqu'à 10 s de timeout axios, sans cache sur le premier hit).

---

## ⚠️ Tests cassés (à réparer)

- **Backend unit : 5 suites rouges (22 tests)** — mocks obsolètes, le code a évolué sans eux : `auth.service.spec` spy sur `bcrypt` (le code utilise `bcryptjs`), `animals.service.spec` mock prisma sans `$transaction`, `gbif.service.spec`, `species.controller.spec`, `species.service.spec` (mocks gbif/transformer/filter à jour ?). 265 tests passent.
- **Backend e2e :** e2e-spec 32/33 (l'échec = le bug B1, login 201≠200 — le test est juste) ; edge-cases : 2 vrais échecs (B7 + timeout réseau B9) + 1 test mal écrit (missing Content-Type : attend [201,400,415], reçoit 409 car dépendant de l'état DB) ; security : 1 test mal écrit (CORS sans header Origin → ACAO absent par comportement standard de cors()) ; performance : timeout (B9).
- **Frontend unit : api.test.ts 6 tests rouges** — le code a évolué (URLs complètes, paramètres category/size) mais les tests attendent les anciennes formes.

---

## Notes

- **N1** — Les endpoints admin (`/database/stats`, `/errors/*`, `/monitoring/*`, `/analytics/*`) ne répondent que si `REDIS_ENABLED=true` (modules conditionnels dans `app.module.ts`) : en config par défaut ils sont en 404. Comportement volontaire mais à connaître.
- **N2** — Species+ : le token API (`SPECIESPLUS_API_TOKEN`) n'est pas configuré → le endpoint répond 200 mais log une erreur 401 interne et renvoie des données vides. Prévu de configurer l'env en prod.
- **N3** — Le user seed (`test@captivia.local`) a été passé en premium par le seed ; son mot de passe a été réinitialisé pendant l'audit (`NewPass456!`).
- **N4** — La page publique du QR expose notes + carnet de santé complet (choix produit, voir rapport sécurité).
- **N5** — Warning Next 16 : le fichier `middleware.ts` (i18n) est déprécié au profit de `proxy.ts` — cosmétique, à migrer à l'occasion.

---

## Verdict

**L'application fonctionne globalement bien** : tous les flows métier principaux (auth, reset, animaux, carnet de santé, routines, QR, espèces locales, grade) ont été validés en live, avec un BOLA systématiquement étanche et une validation stricte. Les 9 bugs identifiés sont circonscrits : **B2/B3** (fonctionnalités entières inaccessibles), **B4** (intégrations Wikipedia/Wikidata mortes — impact visible dans l'UI des fiches espèces), **B5/B6** (déploiement), **B1/B7** (conformité/robustesse), **B8** (tests e2e). Priorité : B4, B2, B3 (impact produit), puis B5/B6 (déploiement), puis B1/B7/B8.
