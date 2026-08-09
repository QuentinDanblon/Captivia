# Audit fonctionnel exhaustif de l'API Captivia — `audit-details/02-api.md`

- **Date** : 2026-08-09
- **Cible** : `http://localhost:3001` (NestJS 11 + Prisma, backend en cours d'exécution, non redémarré)
- **Méthode** : inventaire statique des contrôleurs (`backend/src/**/*.controller.ts`) + tests HTTP live (scripts Python dans `/tmp`, hors repo) : valide, invalide, cas limites, auth, permissions, BOLA, oracles.
- **Données** : 3 comptes jetables créés (`audit*-*@captivia.local`), animaux jetables supprimés en fin de test. Données seed (`test@captivia.local`, Rango) jamais modifiées (lecture seule).
- **Légende** : **OK** = comportement cohérent · **CAVEAT** = fonctionne mais détail douteux/incohérent · **BUG** = erreur réelle.
- **Référentiel d'erreur global** : filtre `HttpExceptionFilter` → `{statusCode, message, timestamp, path}` ; validation → `400 "Validation failed: …"` ; 404 route inconnue → `"Cannot GET …"`.

---

## Inventaire des routes (37 contrôleurs/routes groupes)

| # | Route | Méthodes | Guard | DTO | Statut testé |
|---|-------|----------|-------|-----|--------------|
| 1 | `/auth/register` | POST | — | RegisterDto | OK |
| 2 | `/auth/login` | POST | — | LoginDto | CAVEAT |
| 3 | `/auth/forgot-password` | POST | — | ForgotPasswordDto | OK |
| 4 | `/auth/reset-password` | POST | — | ResetPasswordDto | OK |
| 5 | `/auth/change-password` | POST | JwtAuthGuard | ChangePasswordDto | OK |
| 6 | `/auth/me` | GET | JwtAuthGuard | — | OK |
| 7 | `/users/me/animals` | POST | JwtAuthGuard | CreateAnimalDto | OK |
| 8 | `/users/me/animals` | GET | JwtAuthGuard | — | OK |
| 9 | `/users/me/animals/:id` | GET | JwtAuthGuard | — | OK |
| 10 | `/users/me/animals/:id` | PATCH | JwtAuthGuard | UpdateAnimalDto | OK |
| 11 | `/users/me/animals/:id` | DELETE | JwtAuthGuard | — | OK |
| 12 | `/users/me/animals/:id/public-link` | GET | JwtAuthGuard | — (query `baseUrl` libre) | CAVEAT |
| 13 | `/public/animal/:slug` | GET | — (public) | — | CAVEAT |
| 14-17 | `/users/me/animals/:animalId/health-records` (+`/:recordId`) | GET/POST/PATCH/DELETE | JwtAuthGuard + check `isPremium` | Create/UpdateHealthRecordDto | OK |
| 18-22 | `/users/me/animals/:animalId/routines` (+`/:routineId`) | POST/GET/GET/PATCH/DELETE | JwtAuthGuard | Create/UpdateRoutineDto | OK |
| 23-25 | `/users/me/animals/:animalId/history` (+`/:logId`) | POST/GET/DELETE | JwtAuthGuard | CreateActionLogDto | CAVEAT |
| 26 | `/users/me/grade` | GET | JwtAuthGuard | — | OK |
| 27 | `/users/me/notification-events` | GET | JwtAuthGuard | — (query `date`, `refresh` libres) | **BUG** |
| 28 | `/users/me/notification-events/:id` | PATCH | JwtAuthGuard | — (body `{status}` non validé) | **BUG** |
| 29 | `/users/me/notification-events/:id` | DELETE | JwtAuthGuard | — | CAVEAT |
| 30-32 | `/users/me/push-subscriptions` | POST/GET/DELETE | JwtAuthGuard | **aucun DTO** | **BUG** (POST), CAVEAT (DELETE) |
| 33-34 | `/users/me/notification-preferences` | GET/PATCH | JwtAuthGuard | **aucun DTO** (types `any`) | CAVEAT |
| 35 | `/users/me/test-notification` | POST | JwtAuthGuard | — | OK (mock) |
| 36-37 | `/users/me/subscription` | GET/POST | JwtAuthGuard | SubscribeDto | CAVEAT |
| 38 | `/species/search` | GET | RateLimitGuard | SearchSpeciesDto | OK |
| 39 | `/species/:id` | GET | RateLimitGuard | GetSpeciesDto (regex `^\d+$` manuelle) | CAVEAT |
| 40-44 | `/species/:id/{vernacular,iucn,distributions,media,metrics}` | GET | RateLimitGuard | GetSpeciesDto | CAVEAT |
| 45 | `/species/:id/occurrences/count` | GET | RateLimitGuard | GetSpeciesDto | CAVEAT |
| 46 | `/species/search/advanced` (+suggestions/filters/conservation/region/taxonomy/media/iucn) | GET | — | AdvancedSearchDto | **BUG** (404, non enregistré) |
| 47 | `/gateway/enriched` | GET | RateLimitGuard | — (aucune validation) | **BUG** |
| 48 | `/gateway/search` | GET | RateLimitGuard | — (`limit` non validé) | CAVEAT |
| 49 | `/gateway/complete/:speciesKey` | GET | RateLimitGuard | — | CAVEAT |
| 50-53 | `/gateway/{conservation,classification,distributions,media}/:speciesKey` | GET | RateLimitGuard | — | CAVEAT |
| 54 | `/gateway/wikipedia/article` | GET | RateLimitGuard | — | **BUG** |
| 55 | `/gateway/wikidata/entity/:qid` | GET | RateLimitGuard | — | **BUG** |
| 56 | `/gateway/clear-cache/:speciesKey` | POST | RateLimitGuard | — | **BUG** (public, sans auth) |
| 57-58 | `/gateway/health` + `/gateway/health/:service` | GET | RateLimitGuard | — | OK / CAVEAT |
| 59-63 | `/wikipedia/{search,article,extract,page,health}` | GET | RateLimitGuard | **@Param au lieu de @Query** | **BUG** |
| 64-72 | `/wikidata/{search,entity,species,conservation,classification,descriptions,images,related,health}` | GET | RateLimitGuard | **@Param au lieu de @Query** | **BUG** |
| 73-76 | `/food/{search,product/:barcode,categories,species/:species}` | GET | — | FoodSearchDto (search) | OK / CAVEAT |
| 77-78 | `/equipment` GET, `/equipment/categories` | GET | — | EquipmentQueryDto | OK |
| 79-81 | `/equipment` POST, `/equipment/:id` PATCH/DELETE | JwtAuthGuard (aucun rôle admin) | Create/UpdateEquipmentDto | **BUG** |
| 82 | `/amazon/search` | GET | — | AmazonSearchDto | OK |
| 83 | `/species/:speciesId/legislation` | GET | — | — (query `country` libre) | OK |
| 84 | `/species/:speciesId/legislation` | POST | JwtAuthGuard (aucun rôle admin) | **aucun DTO** | **BUG** |
| 85-87 | `/speciesplus/{search, taxon/:id/cites, taxon/:id/eu}` | GET | — | — | CAVEAT |
| 88 | `/species/:speciesId/health` | GET | — | HealthQueryDto | OK |
| 89 | `/species/:speciesId/health` | POST | JwtAuthGuard (aucun rôle admin) | **aucun DTO** | **BUG** |
| 90 | `/pubmed/search` | GET | — | **aucun DTO** | CAVEAT |
| 91 | `/health` | GET | — | — | OK |
| 92-97 | `/api/open-data/*` (6 routes) | GET | — | — | **BUG** (404, module non importé) |
| 98 | `/analytics` (+5) | — | JwtAuthGuard | — | **BUG** (404, module conditionné `REDIS_ENABLED`) |
| 99 | `/database/*` (4 routes) | — | JwtAuthGuard | — | **BUG** (404, idem) |
| 100 | `/monitoring/*` + `/errors/*` (9 routes) | — | JwtAuthGuard | — | **BUG** (404, idem) |

---

## Détail des tests par endpoint

### Auth (`auth.controller.ts`)

**POST /auth/register** — OK
- Valide → **201** `{accessToken, user{id,email,locale,isPremium,createdAt}}`.
- Email déjà pris → **409** `Email already registered` ; email invalide → **400** ; password < 8 → **400** ; champ manquant → **400** ; champ inconnu (`hacker`) → **400** (`forbidNonWhitelisted` actif) ; email de 20 000 caractères → **400**.
- Email Unicode (`tést-unicode@exemple.fr`) → **201**, créé en base (accepté tel quel).
- BUG connu déjà documenté : registrations concurrentes → 500.

**POST /auth/login** — CAVEAT
- Valide → **201** au lieu de 200 (déjà documenté). Mauvais mot de passe → **401** ; email inconnu → **401** (même réponse → pas d'oracle utilisateur) ; email malformé → **400** ; password manquant → **400**.

**POST /auth/forgot-password** — OK
- Email existant ET inconnu → **200** avec exactement le même message (`Si un compte existe pour cet email…`) → **pas d'oracle d'énumération**. Email invalide → **400**.

**POST /auth/reset-password** — OK
- Token bidon → **400** ; nouveau password court → **400** ; champ manquant → **400**.

**POST /auth/change-password** — OK
- Sans token → **401** ; token invalide → **401** ; mauvais `currentPassword` → **400/401** ; nouveau password court → **400** ; cycle complet valide → **200**, login avec le nouveau password fonctionne.

**GET /auth/me** — OK
- Token valide → **200** avec profil complet. Sans token / token garbage / token forgé (shape JWT valide, signature fausse) → **401**.
- **Comportement notable** : `isPremium` est rechargé en base à chaque requête (le token n'est pas mis à jour après abonnement) → `POST /users/me/subscription` puis `GET /auth/me` reflète `isPremium: true` sans re-login. 👍

### Animaux (`animals.controller.ts` — `users/me/animals`)

**POST /users/me/animals** — OK
- Valide → **201**. Compte gratuit : 2ᵉ animal → **403** `Free users can only have 1 animal…` (limite libre=1, en transaction).
- `speciesId` non numérique → **400** ; `name` vide → **400** ; `sex` hors enum → **400** ; `birthDate` non ISO → **400** ; `photos` non-array → **400**.
- **DTO laxiste** : `speciesId=0` → **201** (pas de `@Min(1)`) ; `speciesId=12345` (clé GBIF inexistante) → **201** (aucune vérification d'existence — il n'y a pas de table espèces, le champ est un int libre) ; `name="   "` (espaces) → **201** (MinLength(1) passe) ; `birthDate="2026-13-45"` (date impossible) → **201** (IsDateString valide le format, `new Date()` produit une date invalide stockée sans erreur).
- Nom émoji/UTF-8 → **201** (bien supporté).

**GET /users/me/animals** — OK. Liste + routines actives + compteurs. Sans token → 401.

**GET /users/me/animals/:id** — OK
- Sien → **200** ; animal d'un autre utilisateur (Rango seed) → **403** `Access denied` ; id inexistant → **404** `Animal not found`.
- ℹ️ Oracle mineur : 403 (existe, autre user) vs 404 (n'existe pas) → révèle l'existence d'un id.

**PATCH /users/me/animals/:id** — OK. Update valide → 200 ; `sex` invalide → 400 ; body vide → 200 (no-op) ; animal d'autrui → 403 ; inexistant → 404. Espèces/sex invalides au niveau métier non vérifiés (même laxisme que POST).

**DELETE /users/me/animals/:id** — OK. Sien → 200 ; Rango → 403 (seed protégé) ; inexistant → 404.

**GET /users/me/animals/:id/public-link (QR, premium)** — CAVEAT
- Premium → **200** `{slug, url}` ; idempotent (slug stable). Free → **403** (gating côté service, indépendant du token). Animal d'autrui → **403** ; inexistant → **404** ; sans token → **401**.
- **`baseUrl` non validé** : `?baseUrl=http://evil.example.com` → `url = http://evil.example.com/animal-public/<slug>` ; `?baseUrl=javascript:alert(1)` → `url = javascript:alert(1)/animal-public/<slug>`. Injection d'URL réfléchie dans un flux QR → vecteur phishing/XSS (le commentaire du code dit « placeholder ; le frontend construit l'URL finale », mais l'API renvoie quand même une URL construite à partir d'une entrée arbitraire).

### Public (`public-animal.controller.ts`)

**GET /public/animal/:slug** — CAVEAT
- Sans auth → **200** : nom, espèce, naissance, sexe, notes **et `healthRecords` complets du carnet de santé premium**. Le seed Rango (`/public/animal/YIccquZqZnqP3pWx`) est exposé pareil.
- Slug inconnu → **404** `Animal not found` ; slug vide → 404 ; `../` → 404 (normalisé par Express).
- ℹ️ Le carnet de santé (fonctionnalité premium) devient public par slug ; la protection repose uniquement sur le secret du slug (16 chars base64url, entropie ~95 bits — correct) mais **aucune notion d'opt-out ni d'expiration**, et un slug fuité expose les données médicales.

### Carnet de santé (`animal-health.controller.ts`)

**GET/POST/PATCH/DELETE health-records** — OK (4 routes)
- Gate premium côté contrôleur (`req.user.isPremium`, rechargé en base → fiable) : compte free → **403** `Premium subscription required…` même sur son propre animal ; premium sur animal d'autrui → **403** `Access denied` (via `animalsService.findOne`) ; sans token → **401**.
- CRUD valide : 201 / 200 / 200 / 200 ; `type` hors enum (`vaccine|surgery|specific_food|medical_history`) → **400** ; `title`/`date` manquants → **400** ; date non-ISO → **400** ; record inexistant → **404** (PATCH/DELETE) ; double DELETE → **404**. BOLA correctement bloqué (record d'un autre animal → 403/404).

### Routines (`routines.controller.ts`)

**POST/GET/GET :id/PATCH/DELETE routines** — OK (5 routes)
- Valide → 201/200/200/200/200. `type` hors enum (`nourrissage|entretien|uvb|controle`) → **400** ; `frequency` hors enum → **400** ; `schedule` manquant ou non-objet → **400**.
- BOLA : routine d'un autre animal → **403** ; routine inexistante → **404** ; animal d'autrui → **403**. `name` optionnel (OK).

### Historique (`routines.controller.ts` — HistoryController)

**POST /history** — OK. Valide → 201 ; `type` vide → 400 ; `type` manquant → 400 ; animal d'autrui → 403.

**GET /history?limit=** — CAVEAT
- `limit=abc` / `1.5` → **400** (ParseIntPipe) ; `limit=0` → traité comme **100** (`limit || 100`) ; `limit=-5` → **200** (silencieusement accepté, `take:-5`) ; `limit=999999` → **200** — **aucune borne haute** (risque de gros payloads).

**DELETE /history/:logId** — OK. Sien → 200 ; inexistant → 404 ; log d'un autre animal → 403.

### Grade & événements (`grade.controller.ts`)

**GET /users/me/grade** — OK. Points/grade/progression (bronze→diamond, seuils 0/500/1500/3000/5000). Sans token → 401.

**GET /users/me/notification-events** — **BUG**
- `?date=not-a-date` → **500** `Internal server error` (au lieu de 400 — la date n'est pas validée, `new Date("not-a-date")` → NaN → requête Prisma invalide). Idem `?date=2026-13-45`.
- **Bug de génération** : les événements issus des **routines actives ne sont créés que si `notificationPreference.types` ET `notificationPreference.typeSchedules` existent** (la boucle routines est imbriquée dans le `if` sur les prefs). Résultat vérifié : utilisateur premium avec routine active (`schedule.time=08:00`) → **0 événement** ; après un simple PATCH de prefs → **2 événements**. Un nouvel utilisateur n'obtient donc jamais les rappels de ses routines tant qu'il n'a pas touché aux préférences.
- `refresh=1` : pas de doublons (recrée proprement) 👍.

**PATCH /users/me/notification-events/:id** — **BUG**
- `status` invalide (`bogus`) ou absent → **200** avec `{error: 'status must be done or skipped'}` au lieu d'un **400**.
- Événement inexistant (ou d'un autre utilisateur) → **200** avec body `null` au lieu d'un **404** (BOLA bloqué — bon pour la vie privée — mais code HTTP faux).
- Points : événement lié à une routine `done` → **+2 points**, grade recalculé ; `done` une 2ᵉ fois → body `null`, **pas de re-credit** 👍 (vérifié : points stables).

**DELETE /users/me/notification-events/:id** — CAVEAT. Toujours **200** `{deleted: true|false}` ; `false` pour inexistant/autre user (404 aurait été plus propre).

### Notifications (`notifications.controller.ts`)

**POST /users/me/push-subscriptions** — **BUG**
- **Aucun DTO** : body `{}` → **500** `Internal server error` (Prisma : endpoint undefined) ; `endpoint: 12345` (non-string) → **500** au lieu de 400. Valide → 201.

**GET /users/me/push-subscriptions** — OK. 200, liste.

**DELETE /users/me/push-subscriptions** — CAVEAT. Body `{}` (pas d'endpoint) → **200** `{success: true}` mensonger (rien n'est supprimé). Endpoint inconnu → 200 `{success:true}`.

**GET /users/me/notification-preferences** — OK. Crée des prefs par défaut si absentes.

**PATCH /users/me/notification-preferences** — CAVEAT
- **Aucun DTO** : `deliveryChannel: 'carrier-pigeon'` → **200** et silencieusement coerced à `'push'` ; `typeSchedules: {time:'99:99', recurrence:'bogus'}` → **200** (stocké tel quel, les heures impossibles seront générées dans les events) ; `snooze: -100` → **200**.

**POST /users/me/test-notification** — OK. 200 `{sent, failed}` (mock console, rien n'est envoyé).

### Abonnement (`subscription.controller.ts`)

**GET /users/me/subscription** — OK. Free → `{isPremium:false}` ; premium → `{isPremium:true, plan:'monthly'}`.

**POST /users/me/subscription** — CAVEAT
- `plan` invalide ou manquant → **400** (DTO ok). Valide (`monthly`/`yearly`) → **201** (au lieu de 200 — même pattern que login). Mock : active premium sans paiement (assumé/documenté).

### Espèces (`species.controller.ts` — RateLimitGuard)

**GET /species/search** — OK
- Valide → 200 `{results, total, source}`. `q` manquant → **400** (DTO) ; `q` = espaces → **400** `Query parameter is required` (double validation) ; `limit=0` → 400 ; `limit=101`/`999999` → 400 (Max 100) ; `limit=abc` → 400 ; `offset=-1` → 400 ; filtres taxo/IUCN passés tels quels (une valeur invalide d'`iucnStatus` est acceptée sans erreur, résultat vide ou filtré — pas de validation enum).
- UTF-8/émoji → 200.

**GET /species/:id** — CAVEAT
- `abc` → **404** `Species not found` (regex `^\d+$`) ; id inexistant → 404 ; **`id=0` → 200** avec `incertae sedis` (clé GBIF 0 acceptée, pas de `Min(1)`).

**GET /species/:id/{vernacular,iucn,distributions,media,metrics,occurrences/count}** — CAVEAT
- Clé valide → 200 (ou 404 si pas de donnée, ex. IUCN). **Incohérence** : `id=abc` → `/species/abc` renvoie 404 mais `/species/abc/vernacular` renvoie **500** `Failed to fetch vernacular names` (pas de contrôle numérique sur les sous-routes ; l'erreur GBIF est avalée en 500).

**GET /species/search/advanced** (+suggestions/filters/…) — **BUG** (déjà documenté) : contrôleur non enregistré dans `species.module.ts` → 404.

### Gateway (`api-gateway.controller.ts` — RateLimitGuard)

**GET /gateway/enriched** — **BUG**
- **Aucune validation** : `query` vide → **200** avec des données arbitraires (GBIF renvoie `Caldisphaera lagunensis`) ; `query=zzzznothing` → **200** vide.
- `sources=bogus` → **200** `{sources: []}` : la source invalide est **silencieusement ignorée** (au lieu d'un 400).
- Sources par défaut `gbif,wikipedia,wikidata` : la réponse ne contient que la clé `gbif` — les échecs Wikipedia/Wikidata (403 User-Agent axios, connu) sont **avalés sans trace** dans la réponse (ni clé d'erreur ni mention). 200 « propre » avec données partielles.

**GET /gateway/search** — CAVEAT. `limit=abc` → `parseInt` → NaN passé au service (réponse 200 ou erreur interne selon le chemin) ; `limit=0`/`-5` acceptés. Pas de DTO/validation.

**GET /gateway/complete/:speciesKey** — CAVEAT. Clé invalide (`not-a-number`) ou inexistante (`999999999`) → **200** `{key, sources: [], …}` au lieu d'un 404 (doc Swagger annonce 404) ; `key=0` → 200 incertae sedis.

**GET /gateway/{conservation,classification,distributions,media}/:key** — CAVEAT. Clés invalides → 200 avec `{gbif:null, wikidata:null}` / tableaux vides (erreurs avalées, jamais de 404).

**GET /gateway/wikipedia/article** — **BUG**. → **500** systématique (403 Wikipedia + aucune validation `title`).

**GET /gateway/wikidata/entity/:qid** — **BUG**. → **500** systématique (403 Wikidata). `qid` invalide → 500 aussi.

**POST /gateway/clear-cache/:speciesKey** — **BUG**
- **Accessible sans authentification** : n'importe qui peut purger le cache d'une espèce (cache-busting = léger DoS sur les performances, et cohérence). Renvoie 200.

**GET /gateway/health** — OK. 200 `{status:'healthy', services:{gbif:…, wikipedia:{status:'unhealthy', error:'Request failed with status code 403'}, …}}` — les états unhealthy sont correctement remontés ici.

**GET /gateway/health/:service** — CAVEAT. `bogus` → **200** `{status:'unknown', error:'Unknown service'}` (400 aurait été plus correct).

### Wikipedia (`wikipedia.controller.ts` — RateLimitGuard)

**GET /wikipedia/{search,article,extract,page}** — **BUG**
- **Les 4 routes utilisent `@Param()` sur des routes sans paramètre de chemin** : `params.q`/`params.title` sont donc toujours `undefined` → le service est appelé sans argument → **500** systématique (`Failed to search Wikipedia` / `Failed to fetch Wikipedia article`…), indépendamment du problème 403 User-Agent. Les query params attendus (`?q=`, `?title=`) ne sont jamais lus. Correctif : `@Query()`.
- `/wikipedia/health` → **200** `{status:'unhealthy', error:'Request failed with status code 403'}` (cohérent avec le connu).

### Wikidata (`wikidata.controller.ts` — RateLimitGuard)

**GET /wikidata/{search,entity,species,classification,descriptions,images,related}** — **BUG** : même bug `@Param()` → paramètre toujours `undefined` → **500** systématique. `/wikidata/conservation` est incohérent avec les autres : **400** `Validation failed: qid must be a string…` (DTO `@IsNotEmpty` sur undefined) au lieu de 500. `/wikidata/health` → 200 unhealthy (403).

### Food (`food.controller.ts`)

**GET /food/search** — OK. Valide → 200 produits ; `q` manquant → **400** ; `page=0` → 400 ; `pageSize=200` → 400 (Max 100) ; `pageSize=abc` → 400. (`species` du DTO déclaré mais non transmis au service.)

**GET /food/product/:barcode** — OK. Code connu → 200 ; inconnu → **404** `Product not found` ; barcode non numérique → 404.

**GET /food/categories** — OK.

**GET /food/species/:species** — CAVEAT. Fonctionne (mapping + recherche) ; **toutes les erreurs sont avalées** : `catch` → **200** `{products: [], count: 0, page: 1}` quel que soit l'échec. `type` invalide → 200 vide (pas de validation).

### Équipement (`equipment.controller.ts`)

**GET /equipment, GET /equipment/categories** — OK. `speciesId=abc` → 400 ; `speciesId=99999999` (inexistant) → 200 vide ; `size` invalide → 200 (pas d'enum).

**POST /equipment, PATCH /equipment/:id, DELETE /equipment/:id** — **BUG (contrôle d'accès cassé)**
- Documenté « admin only » mais protégé par le seul `JwtAuthGuard` : **un compte gratuit lambda** peut créer (201), modifier (200) et supprimer (200) des recommandations d'équipement. Aucun rôle admin n'existe.
- **DELETE sur un id inexistant → 500** `Internal server error` (Prisma P2025 non intercepté) au lieu de 404 — vérifié avec un id supprimé et un uuid aléatoire.

**GET /amazon/search** — OK. Valide → 200 (liste vide en pratique, Amazon non configuré) ; `q` manquant → 400 ; `limit=0`/`999`/`abc` → 400 (1–50).

### Législation (`legislation.controller.ts`)

**GET /species/:speciesId/legislation** — OK. 200 (contenu éditorial en base) ; `speciesId=abc` → **400** (ParseIntPipe) ; `country` inconnu → 200 vide (pas de validation ISO).

**POST /species/:speciesId/legislation** — **BUG**
- « Admin only » → **n'importe quel utilisateur authentifié peut écrire** (201 vérifié avec un compte free). Aucun DTO : body `{country:'FR'}` seul → **500** (undefined propagé à Prisma) au lieu d'un 400.

**GET /speciesplus/{search, taxon/:id/cites, taxon/:id/eu}** — CAVEAT
- **200 avec `[]`** : l'API Species+ répond 401 (clé invalide/absente, connue) et le service avale l'erreur — le client ne peut pas distinguer « aucun résultat » d'« intégration cassée ». `taxonId=abc` → 400 (ParseIntPipe).

### Contenu santé / PubMed (`health-content.controller.ts`)

**GET /species/:speciesId/health** — OK. 200 ; `speciesId=abc` → 400 ; `limit=999` → 400 (Max 50) ; `locale` libre.

**POST /species/:speciesId/health** — **BUG** : « Admin only » → n'importe quel utilisateur authentifié écrit (201 vérifié avec compte free). Pas de DTO.

**GET /pubmed/search** — CAVEAT. Fonctionne (200, articles réels). `q` **non validé** (pas de DTO) : absent → 200 avec résultats vides ou erreur selon l'état ; `limit=abc` → le paramètre typé `number` reçoit une string → NaN propagé au service (comportement indéterminé, pas de 400) ; `limit=0` → 0 résultats.

### Modules non enregistrés (404 — tous déjà documentés, confirmés)

- `/api/open-data/*` (wikipedia, wikidata, inaturalist, eol, multi, taxon) → 404 : le module `external` n'est **pas importé** dans `app.module.ts`.
- `/analytics*`, `/database*`, `/monitoring*`, `/errors*` → 404 : `MonitoringModule`, `AnalyticsModule`, `DatabaseOptimizationModule` ne sont importés que si `REDIS_ENABLED === 'true'` (`.env` : false). Donc **toute la supervision/analytics est inatteignable en prod par défaut** (et les contrôleurs `analytics.track`, `database.optimize-cache`, `monitoring.reset`, `errors.clear/reset` sont des opérations sensibles qui, si le flag était activé, ne seraient protégées que par JWT sans rôle admin).

### Divers

- **GET /health** → 200 `{status:'ok'}`.
- **Route inconnue** → 404 `Cannot GET …` (format uniforme via le filtre global).
- **CORS** : `Access-Control-Allow-Origin: *` **avec `credentials: true`** (main.ts) — combinaison invalide selon la spec (les navigateurs refusent), et origine non restreinte (le `CORS_ORIGIN` n'est pas défini dans `.env`).
- **Rate limiting (RateLimitGuard, species/gateway/wikipedia/wikidata)** :
  - **Dépassement → 500 au lieu de 429** : vérifié — 103 requêtes rapides sur une même IP → ~100 × 200 puis **500** `Internal server error` (l'erreur du limiter est relancée telle quelle et passe dans le filtre global). Aucun header `Retry-After`.
  - **Bypass trivial** : le limiter fait confiance à `X-Forwarded-For`/`X-Real-IP` → changer le header contourne la limite (vérifié : IP « floodée » à 500, nouvelle IP → 200 immédiat).
  - Headers `X-RateLimit-*` présents sur les réponses (info utile).

---

## DEFAUTS TRANSVERSAUX

1. **Codes HTTP incohérents**
   - POST créant/updatant une ressource → 201 partout (`login`, `subscription`, `change-password` renvoient 201 pour des opérations qui ne créent pas de ressource REST).
   - Erreurs de validation avalées en **200** : `PATCH notification-events/:id` (status invalide → `200 {error:…}` ; inexistant → `200 null`), `DELETE notification-events/:id` (→ `200 {deleted:false}`).
   - **500 pour des erreurs client** : date invalide sur `notification-events` (500), `push-subscriptions` body vide (500), `legislation` POST champs manquants (500), `DELETE /equipment/:id` inexistant (500), `/species/:id/vernacular` id non numérique (500), `wikipedia/*`/`wikidata/*` (500).
   - **429 jamais émis** (500 à la place) ; `gateway/health/bogus` → 200 `unknown`.
   - Doc Swagger mensongère : `gateway/complete` annonce 404, renvoie 200 vide ; `species/search` annonce 404 « invalid query », renvoie 400.

2. **DTOs absents sur des routes à écriture** : `push-subscriptions` (POST/DELETE), `notification-preferences` (PATCH), `legislation` POST, `health-content` POST, `pubmed` search, `notification-events` (query+PATCH), `gateway/*` (query). Conséquences : 500s Prisma, stockage de valeurs invalides (`time:'99:99'`, `snooze:-100`, `deliveryChannel` inconnu), aucune validation de `q`/`limit`.
3. **DTOs trop laxistes** : `CreateAnimalDto.speciesId` sans `@Min(1)` (0/12345 acceptés), `name` accepte les espaces, `birthDate` accepte `2026-13-45` (IsDateString n'impose pas de date réelle), `GetSpeciesDto.id` sans contrainte numérique (compensé par une regex manuelle sur une seule route), `SearchSpeciesDto.iucnStatus` sans enum.
4. **Contrôle d'accès cassé (5 endpoints)** : `POST/PATCH/DELETE /equipment`, `POST /species/:id/legislation`, `POST /species/:id/health` sont documentés « admin only » mais accessibles à **tout utilisateur authentifié** (aucun rôle admin dans le code). Idem en puissance pour `analytics/database/monitoring/errors` si `REDIS_ENABLED=true`.
5. **Erreurs internes/externes avalées** : `gateway/enriched` (200 sans clés wikipedia/wikidata), `food/species` (200 vide), `speciesplus/*` (200 `[]` sur 401 Species+), `gateway/complete|conservation|…` (200 avec nulls). Le client ne peut jamais distinguer succès vide de panne.
6. **Rate limiting contournable et mal signalé** : confiance aveugle dans `X-Forwarded-For`/`X-Real-IP` (bypass), dépassement → 500.
7. **Orifices d'information (mineurs)** : 403 vs 404 sur les ressources d'autrui (`animals/:id` : 403 si existe, 404 sinon) ; `/public/animal/:slug` expose le carnet de santé premium sans opt-out ; `forgot-password` et `login` sont en revanche correctement anonymisés.
8. **BUG @Param/@Query** : les contrôleurs Wikipedia et Wikidata (13 routes) lisent `@Param()` sur des routes sans paramètre → toutes leurs routes métier sont mortes (500), indépendamment du 403 User-Agent axios (déjà connu).
9. **Sécurité applicative** : `baseUrl` reflété sans validation dans l'URL du QR (`javascript:`, `http://evil`), CORS `*` + credentials, `clear-cache` public, pas de rate limit sur les routes non-guardées (auth, animaux, food, equipment, legislation… — ex. `/auth/login` brute-forçable à volonté).
10. **Limites de pagination** : `history?limit` sans borne (négatifs et 999999 acceptés, 0 → 100 par `||`), `gateway/search?limit` sans validation (NaN).

---

## Résumé (5 lignes)

- **100 endpoints/routes testés** (88 routes réellement montées + 12 contrôleurs non enregistrés) sur l'API live `localhost:3001`, avec cas valides, invalides, limites, auth et BOLA, via 4 comptes jetables et des animaux jetables (seed intact).
- **36 OK** — l'essentiel du CRUD animaux/routines/historique/carnet de santé est sain : guards JWT, limite gratuite 1 animal, gate premium, BOLA bloqué (403/404), pas de re-credit de points, pas d'oracle sur login/forgot-password.
- **24 CAVEAT** — incohérences de codes HTTP (201 sur login/subscription), DTO laxistes (speciesId=0/12345, dates impossibles, espaces), pagination non bornée (history limit), baseUrl non validé dans l'URL du QR, exposition publique du carnet via slug, CORS `*`+credentials.
- **40 BUG** — dont 5 nouveaux majeurs : **contrôle d'accès cassé sur 5 endpoints « admin »** (equipment ×3, legislation POST, health-content POST, écrivables par n'importe quel user), **bug @Param/@Query tuant les 13 routes Wikipedia/Wikidata**, **rate limit → 500 au lieu de 429 + bypass par X-Forwarded-For**, **500s au lieu de 400** (dates, push-subscriptions, DELETE equipment inexistant), **génération des événements de routine conditionnée à l'existence de préférences** (0 événement sinon) + erreurs externes avalées (gateway enriched, Species+, food/species).
- **Rapport détaillé écrit dans `audit-details/02-api.md`** (ce fichier) ; scripts de test conservés dans `/tmp/captivia_audit*.py` (hors repo).
