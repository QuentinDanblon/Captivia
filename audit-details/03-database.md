# Audit Base de Données Captivia — `03-database.md`

**Date :** 2026-08-09 · **Cible :** `backend/prisma/schema.prisma` (322 lignes, 16 modèles) · **DB live :** PostgreSQL 15.18 (`captivia-postgres`), 17 tables + `_prisma_migrations` · **Mode :** lecture seule (SELECT uniquement).

**Méthode :** lecture intégrale du schéma Prisma → lecture des 5 `migration.sql` → comparaison structurelle avec la DB live (`information_schema`, `pg_indexes`, `pg_constraint`) → requêtes d'intégrité → analyse des patterns de requêtes Prisma dans `backend/src/**/*.service.ts` et `*.controller.ts`.

---

## 0. SYNTHÈSE EXÉCUTIVE

| | |
|---|---|
| Modèles audités | 16 / 16 |
| Tables en DB | 17 (toutes présentes, y compris les 3 absentes des migrations) |
| Problèmes critiques | 4 (bloquants pour `migrate deploy` / intégrité référentielle espèces) |
| Problèmes majeurs | 8 |
| Problèmes mineurs | 9 |
| Orphelins FK | 0 sur les 8 FK déclarées |
| Doublons (email, endpoint, publicSlug) | 0 |

**Verdict :** le modèle de données est sain pour un MVP mono-région, mais **la base n'est PAS déployable en production via `prisma migrate deploy`** : l'historique de migrations est inapplicable dans l'ordre (les migrations 1-3 altèrent des tables créées seulement dans la migration 4), et 3 tables + 3 colonnes du schéma n'existent dans **aucune** migration (créées par `db push` uniquement). Le passage en prod exige un squash de l'historique en une migration initiale complète et cohérente.

---

## 1. COHÉRENCE SCHÉMA ↔ MIGRATIONS ↔ DB LIVE

### 1.1 État des migrations

5 fichiers, tous des `ALTER TABLE`/`CREATE` incrémentaux. **Aucun n'est une migration de création initiale complète.** Le fichier `20260201215742_add_species_profiles_and_animal_care_data` joue de fait ce rôle (crée User, Animal, Routine, ActionLog, PushSubscription, NotificationPreference + toutes les tables Species*) mais son nom ne le reflète pas.

**Problème critique C1 — l'historique est inapplicable dans l'ordre lexicographique** (ordre d'exécution Prisma) :

| # | Migration | Référence à | Table créée en |
|---|---|---|---|
| 1 | `20260201120000` | `ALTER TABLE "NotificationPreference"` | m4 (`20260201215742`) |
| 2 | `20260201130000` | `ALTER TABLE "User"` + `CREATE NotificationEvent` + FK | m4 (User) |
| 3 | `20260201180000` | `ALTER TABLE "Animal"` | m4 |
| 4 | `20260201215742` | crée les tables de base | — |
| 5 | `20260201222044` | modifie SpeciesProfile/SpeciesHabitat/RecommendedEquipment | m4 |

`prisma migrate deploy` sur une DB vide échoue dès la migration 1 (table `NotificationPreference` inexistante). C'est la matérialisation du bug connu « migration de création initiale manquante » — **confirmé** : `_prisma_migrations` ne contient qu'UNE entrée (`20260201120000`), avec `applied_steps_count = 0` et `finished_at = NULL` → la DB live a été construite par `prisma db push`, sans historique exploitable.

**Problème critique C2 — 3 tables du schéma absentes de TOUTES les migrations** (existent en live uniquement grâce à `db push`) :

| Table | Créée par une migration ? | En DB live |
|---|---|---|
| `PasswordResetToken` | ❌ aucune | ✅ (index + FK créés par db push) |
| `AnimalHealthRecord` | ❌ aucune | ✅ |
| `AffiliateStore` | ❌ aucune | ✅ |

→ En prod, un `migrate deploy` propre ne créerait jamais ces tables : **auth (reset password), carnet de santé et magasins plantent au premier appel**.

**Problème critique C3 — 3 colonnes du schéma absentes des migrations** (db push uniquement) :

| Colonne | Migration qui l'ajoute | En DB live |
|---|---|---|
| `NotificationPreference.deliveryChannel` | ❌ aucune | ✅ (`TEXT NOT NULL DEFAULT 'push'`) |
| `NotificationEvent.routineId` | ❌ aucune | ✅ (+ index `NotificationEvent_routineId_idx`) |
| `NotificationEvent.animalId` | ❌ aucune | ✅ |

### 1.2 Écarts de nullabilité (drift silencieux)

**Problème majeur M1 — 5 colonnes array NULLABLE en DB mais `String[]` (non-nullable) dans le schéma.** La migration 4 les a créées sans `NOT NULL` et le `db push` ne les a pas corrigées :

`Animal.photos`, `RecommendedEquipment.searchTerms`, `AffiliateStore.categories`, `AffiliateStore.types`, `SpeciesLegislation.sources`.

Preuve live : `is_nullable = YES` pour ces 5 colonnes ; le schéma les déclare non-nullables. Aucun crash au runtime (Prisma ne vérifie pas la nullabilité DB), mais 1 ligne `Animal.photos = NULL` existe déjà, et un futur `migrate deploy` tentera des `SET NOT NULL` qui peuvent échouer sur données existantes.

### 1.3 Écarts résiduels migration 4 → migration 5 (déjà corrigés en DB, mais historiques)

- `SpeciesProfile` : migrée de `id SERIAL` + `gbifKey` vers `id TEXT` + `speciesId INT NOT NULL UNIQUE` (migration 5, avec warnings de data-loss : drop de colonnes, `ADD COLUMN speciesId NOT NULL` sans défaut → **échoue si la table est non vide**, changement de PK). OK en live, mais ce chemin de migration est fragile à rejouer.
- `SpeciesHabitat.tempMin/tempMax/humidity*` : `INTEGER` → `DOUBLE PRECISION` (migration 5). Cohérent avec `Float` du schéma.
- `RecommendedEquipment.isEssential` : créée en m4, **droppée en m5**. Absente du schéma. OK.
- La migration 4 contient des `CREATE TABLE` **sans** `IF NOT EXISTS` (contrairement aux autres) → double exécution impossible, et conflit direct si la table existe déjà via db push.

---

## 2. AUDIT PAR MODÈLE (16)

### 2.1 `User`
- **Champs :** `id String @id @default(uuid())`, `email String @unique`, `passwordHash String`, `locale String @default("fr")`, `isPremium Boolean @default(false)`, `points Int @default(0)`, `grade String @default("bronze")`, `createdAt/updatedAt`.
- **Contraintes :** unique email. Index : `User_email_idx` **redondant** avec `User_email_key` (unique) — doublon systématique.
- **Relations :** 1-n vers Animal, PushSubscription, NotificationPreference, NotificationEvent, PasswordResetToken — toutes `onDelete: Cascade`.
- **Problèmes :**
  - **M2** : `grade` est un `String` libre — aucune CHECK contrainte (`bronze|silver|gold|platinum|diamond`). Une faute de frappe applicative passe silencieusement (0 valeur hors liste aujourd'hui).
  - **M3** : `points Int` sans CHECK `>= 0` (0 valeurs négatives aujourd'hui) et **aucune contrainte de cohérence points↔grade** (un user peut avoir 10 000 points et rester « bronze »).
  - **m1** : pas de `deletedAt`/soft delete (voir RGPD, §7).
  - `locale` non contraint (`fr|en|...`).

### 2.2 `PasswordResetToken`
- **Champs :** `id uuid`, `userId String`, `token String @unique`, `expiresAt DateTime`, `createdAt`.
- **Relations :** `user` → `onDelete: Cascade`. Index : token (unique + **redondant** `token_idx`), userId, expiresAt.
- **Problèmes :**
  - **C2** : table absente de toutes les migrations (db push only) → reset password inutilisable en prod déployée proprement.
  - **m2** : aucun mécanisme de purge des tokens expirés (pas de cron/cleanup visible) → croissance illimitée en prod.
  - `expiresAt` indexé ✓ (requête de purge future couverte).

### 2.3 `Animal`
- **Champs :** `id uuid`, `userId String`, `speciesId Int` (commentaire « GBIF key »), `name String`, `birthDate DateTime?`, `sex String?`, `photos String[]`, `notes String?`, `publicSlug String? @unique`, `createdAt/updatedAt`.
- **Contraintes :** unique `publicSlug`. Index : userId, speciesId, publicSlug (unique + **redondant** `publicSlug_idx`).
- **Relations :** `user` (Cascade), 1-n routines/history/healthRecords (Cascade).
- **Problèmes :**
  - **C4 — absence de FK `Animal.speciesId → SpeciesProfile.speciesId`** : aucune contrainte référentielle. Preuve live : **8 des 9 animaux ont un `speciesId` (1 ou 123) sans SpeciesProfile** (espèces fantômes). La fiche espèce d'un animal est silencieusement vide.
  - **M1** : `photos` nullable en DB (drift) ; 1 ligne NULL.
  - **m3** : `name` et `notes` sans limite de taille. **Preuve : un animal de test a un `name` de ~1 200 caractères (« AAAA… »)** — aucun CHECK, aucune validation de longueur en base.
  - `sex` libre (m/f/autre/…), `publicSlug` non contraint en format (slug valide ?).

### 2.4 `AnimalHealthRecord`
- **Champs :** `id uuid`, `animalId String`, `type String` (vaccine|surgery|specific_food|medical_history), `title String`, `date DateTime`, `notes String?`, `details Json?`, `createdAt/updatedAt`.
- **Relations :** `animal` → `onDelete: Cascade`. Index : `animalId`, `(animalId, type)` — couvrent les requêtes du code (`findMany {animalId} orderBy date desc`, `findFirst {id, animalId}`) ✓.
- **Problèmes :**
  - **C2** : table absente des migrations (db push only).
  - **M4** : `details Json?` non contraint : aucune structure garantie (vétérinaire, prochain rappel…), non filtrable en SQL, pas de validation JSON Schema. 1 ligne live avec `details = NULL` (OK, champ optionnel) mais rien n'empêche des formes invalides.
  - `type`/`title` sans CHECK.

### 2.5 `Routine`
- **Champs :** `id uuid`, `animalId String`, `name String?`, `type String` (nourrissage|entretien|uvb|controle), `frequency String` (daily|weekly|custom — mais le scheduler gère aussi `monthly`), `schedule Json` (obligatoire), `active Boolean @default(true)`, `createdAt/updatedAt`.
- **Relations :** `animal` → Cascade. Index : `animalId`, `active` ✓.
- **Problèmes :**
  - **M5 — `schedule Json` non structuré et fragile** : le scheduler (`notifications-scheduler.service.ts`) parse à la main `schedule.hour`, `schedule.day`, `schedule.date`, `schedule.hours` selon le `frequency` — aucune contrainte de forme, un schedule mal formé (ex. `days: [...]` comme dans le seed, qui n'est jamais lu par le code !) rend la routine muette ou crash (`schedule.hour === currentHour` avec undefined). Le seed lui-même écrit `{ days: ['tuesday','friday'], time: '19:00' }` — champs **jamais lus** par le scheduler → incohérence seed ↔ code.
  - **m4** : pas de CHECK sur `frequency` (le code gère `monthly` qui n'est pas dans le commentaire du schéma).
  - Index composite `(animalId, active)` manquant (requête `getActiveRoutines` : routines par animal filtrées `active: true`) — mineur à ce volume.

### 2.6 `ActionLog`
- **Champs :** `id uuid`, `animalId String`, `type String`, `note String?`, `doneAt DateTime @default(now())`. **Pas de `updatedAt`** — cohérent pour un journal append-only ✓.
- **Relations :** `animal` → Cascade. Index : `animalId`, `doneAt` ✓.
- **Problèmes :** **m5** : index composite `(animalId, doneAt)` manquant pour le pattern réel `findMany {animalId} orderBy doneAt desc take limit` (le tri par date se fait avec un index séparé → sort + fetch, OK à petit volume, sous-optimal en prod).

### 2.7 `PushSubscription`
- **Champs :** `id uuid`, `userId String`, `endpoint String @unique`, `keys Json` ({p256dh, auth}), `createdAt`.
- **Relations :** `user` → Cascade. Index : userId ✓ + endpoint unique ✓.
- **Problèmes :**
  - **M6** : `keys Json` sans validation de forme (clés manquantes → échec d'envoi push au runtime seulement).
  - **m6** : index composite `(userId, endpoint)` manquant — le code fait `findFirst {userId, endpoint}` (upsert manuel) : couvert par 2 index séparés, composite optimal (mineur).
  - **Données live : 0 abonnement** — la brique push n'a jamais été exercée en DB.
  - `endpoint` unique global : un même device pour 2 comptes → conflit ; à surveiller (voir §7 : unicité `(userId, endpoint)` au lieu de globale).

### 2.8 `NotificationPreference`
- **Champs :** `id uuid`, `userId String @unique` (1 seule préférence par user ✓), `types Json` (obligatoire), `typeSchedules Json?`, `schedule Json` (obligatoire), `snooze Int @default(15)`, `deliveryChannel String @default("push")`, `createdAt/updatedAt`.
- **Relations :** `user` → Cascade.
- **Problèmes :**
  - **C3** : colonne `deliveryChannel` absente des migrations (db push only) → en prod déployée proprement, le schéma Prisma ne peut pas écrire cette colonne (erreur Prisma à la création de préférence).
  - **M4** : 3 champs JSONB (types, typeSchedules, schedule) sans contrainte de forme ni filtrabilité ; le seed utilise `{nourrissage: true, ...}` (clés sans accents) alors que les événements sont typés « Nourrissage » (avec accent) — **risque de mismatch de clés** entre prefs et events.
  - **M2** : `deliveryChannel` sans CHECK (`push|email|both`).
  - 27/28 users n'ont pas de préférence (normal : créées à la demande) ; le scheduler itère **tous** les users puis filtre en JS.

### 2.9 `NotificationEvent`
- **Champs :** `id uuid`, `userId String`, `type String`, `label String?`, `scheduledAt DateTime`, `status String @default("pending")`, `pointsAwarded Int @default(0)`, `routineId String?`, `animalId String?`, `createdAt/updatedAt`.
- **Relations :** `user` → Cascade. **Aucune relation Prisma vers Routine/Animal** (colonnes libres). Index : userId, scheduledAt, `(userId, scheduledAt)` ✓ (couvre `grade.service` `findMany {userId, scheduledAt gte/lte}`), `routineId` (db push only).
- **Problèmes :**
  - **C3** : `routineId`/`animalId` absents des migrations.
  - **M7 — pas de FK sur `routineId`/`animalId`** : si une routine ou un animal est supprimé, les events qui le référencent gardent un ID mort (aucune cascade, aucun `ON DELETE SET NULL`). 0 orphelin aujourd'hui uniquement parce que la table est **vide (0 ligne)**.
  - **M8 — pipeline jamais exercé** : 0 événement en DB alors que le scheduler tourne — le scheduler actuel **ne crée pas** de `NotificationEvent` (il envoie des notifications directes) ; le grade.service les lit (0 → aucun point attribué, aucun user ne peut progresser de grade). Incohérence fonctionnelle entre scheduler et système de points.
  - **m7** : index `(userId, status, scheduledAt)` manquant si une file de traitement par statut (pending) voit le jour.
  - `status` sans CHECK (0 valeur invalide aujourd'hui, table vide).

### 2.10 `SpeciesProfile`
- **Champs :** `id uuid`, `speciesId Int @unique`, `commonNameFr String`, `scientificName String`, `category String`, `subcategory String?`, `domesticationType String`, `description String?` (max 500 chars annoncés), `createdAt/updatedAt`.
- **Contraintes :** unique `speciesId` ✓. Index : category, domesticationType ✓ + **redondant** `speciesId_idx` (doublon du unique).
- **Problèmes :**
  - **C4** : aucune FK depuis `Animal.speciesId` (voir §2.3).
  - **m3** : `description` « max 500 chars » non enforce en base (0 dépassement aujourd'hui, validation applicative seulement).
  - `category`/`domesticationType` validés dans le seed (listes fermées) mais non contraints en DB.
  - 51 profils seedés, mais **5 seulement ont des données équipement** (les 5 espèces du seed) — le reste (46 espèces) n'a ni équipement ni forcément health/legislation (27 health, 147 legislation).

### 2.11 `SpeciesFeeding`
- **Champs :** `id uuid`, `speciesId Int`, `locale String @default("fr")`, `dietType String`, `recommendedFoods Json`, `foodsToAvoid Json`, `mealFrequency String`, `specificNeeds String?`, `createdAt/updatedAt`.
- **Contraintes :** `@@unique([speciesId, locale])` ✓. Index : speciesId, dietType ✓.
- **Problèmes :** **M4** : `recommendedFoods`/`foodsToAvoid` JSONB non contraints (formes `{name, frequency, notes}` / `{name, reason}` non vérifiées, non filtrables). Pas de FK vers SpeciesProfile (espèce orpheline possible — vérifié : 51 feeding pour 51 profils, cohérent aujourd'hui). `locale` non contraint (fr|en|...).

### 2.12 `SpeciesHabitat`
- **Champs :** `id uuid`, `speciesId Int`, `locale`, `habitatType String`, `tempMin/tempMax Float` (DOUBLE PRECISION en DB ✓ après migration 5), `humidityMin/humidityMax Float?`, `minSpaceSize String`, `lightNeeds String`, `activityEnrichment String`, `hygieneNotes String?`, `costEstimate String`, `createdAt/updatedAt`.
- **Contraintes :** `@@unique([speciesId, locale])` ✓. Index : speciesId, habitatType ✓.
- **Problèmes :**
  - **m3** : aucun CHECK `tempMin <= tempMax` ni `0 <= humidity <= 100` (données inversées possibles).
  - **M4** : champs texte longs non contraints en taille (minSpaceSize, lightNeeds, activityEnrichment).
  - `costEstimate` validé seed-side (`faible|moyen|élevé`) mais libre en DB.

### 2.13 `SpeciesBehavior`
- **Champs :** `id uuid`, `speciesId Int`, `locale`, `generalBehavior String`, `sociability String`, `difficultyLevel String`, `compatibilityWithChildren String?`, `compatibilityWithOtherAnimals String?`, `createdAt/updatedAt`.
- **Contraintes :** `@@unique([speciesId, locale])` ✓. Index : speciesId, difficultyLevel ✓.
- **Problèmes :** **M2** : `sociability`/`difficultyLevel` sans CHECK (listes fermées validées seed-side uniquement).

### 2.14 `SpeciesHealthContent`
- **Champs :** `id uuid`, `speciesId Int`, `locale`, `diseases Json`, `sources Json` (Array de {type: pubmed|lafebervet|ivis, url, title}), `createdAt/updatedAt`.
- **Contraintes :** `@@unique([speciesId, locale])` ✓. Index : speciesId ✓.
- **Problèmes :** **M4** : `diseases`/`sources` JSONB non contraints (27 lignes live, formes non vérifiées). `type` de source non contraint.

### 2.15 `SpeciesLegislation`
- **Champs :** `id uuid`, `speciesId Int`, `country String` (ISO), `status String` (allowed|prohibited|permit_required), `details Json`, `sources String[]`, `createdAt/updatedAt`.
- **Contraintes :** `@@unique([speciesId, country])` ✓. Index : speciesId, country ✓.
- **Problèmes :**
  - **M1** : `sources` nullable en DB (drift, 0 NULL aujourd'hui).
  - **M2** : `status` sans CHECK (0 valeur invalide sur 147 lignes).
  - **M4** : `details Json` ({citesAppendix, euAnnex, permits, restrictions}) non contraint.
  - `country` non contraint en format ISO (2 lettres).

### 2.16 `RecommendedEquipment`
- **Champs :** `id uuid` (**mais le seed injecte des IDs déterministes** `{speciesId|'general'}-{category}-{order}`), `speciesId Int?` (null = général), `category String`, `label String`, `size String?`, `searchTerms String[]`, `order Int @default(0)` (mot réservé SQL, échappé par Prisma ✓), `createdAt/updatedAt`.
- **Contraintes :** aucune unicité métier. Index : speciesId, category ✓.
- **Problèmes :**
  - **m8** : pas d'unicité `(speciesId, category, label)` → doublons possibles (l'upsert du seed ne protège que via l'ID explicite).
  - **M1** : `searchTerms` nullable en DB (drift).
  - **m3** : `label`/`searchTerms` sans limite de taille.
  - **m9** : `order` : tri stable `orderBy order asc` — OK.

### 2.17 `AffiliateStore`
- **Champs :** `id uuid`, `name String`, `url String`, `description String?`, `categories String[]`, `types String[]`, `order Int @default(0)`, `createdAt/updatedAt`.
- **Contraintes :** aucune unicité. Index : `AffiliateStore_categories_idx` (btree sur array).
- **Problèmes :**
  - **C2** : table absente des migrations.
  - **M9 — index btree sur array INUTILE pour la requête principale** : le code filtre `categories: { has: category }` / `types: { has: type }` (opérateur `@>`). Un index btree sur un tableau ne sert que l'égalité de tableau ; il faut un **index GIN** (`USING GIN (categories)`, `USING GIN (types)`). Sans impact à 9 lignes, pénalisant en prod.
  - **m8** : pas d'unicité sur `url` (doublons de liens affiliation possibles) ; `name`/`url` sans limite.
  - **m10** : le seed utilise des **URLs placeholder** (`https://www.example-pet-shop.fr/...`) — aucun lien d'affiliation réel (commentaire du seed : « Compléter les URL avec vos vrais liens »). 9 lignes live = placeholders → **aucune revenue affiliation possible en l'état**.

---

## 3. INDEX MANQUANTS (PROD)

Couverts aujourd'hui (vérifiés dans le code) : `Animal.userId` ✓, `Animal.publicSlug` ✓ (public-animal.controller), `AnimalHealthRecord.animalId` ✓ (+ `(animalId,type)`), `Routine.animalId` ✓, `ActionLog.animalId` ✓, `PushSubscription.userId` ✓, `NotificationEvent.(userId, scheduledAt)` ✓ (grade.service), `NotificationEvent.userId` ✓, `PasswordResetToken.token/expiresAt` ✓, `Species*.speciesId` ✓, `RecommendedEquipment.category` ✓ (distinct), `User.email` ✓ (auth).

| # | Index manquant | Requête concernée | Impact |
|---|---|---|---|
| I1 | `AffiliateStore` : **GIN** sur `categories` et `types` | `affiliate.service.ts` : `categories: { has }`, `types: { has }` — requête principale de l'onglet Magasin | **Majeur** (l'index btree existant est inutile pour `@>`) |
| I2 | `ActionLog (animalId, doneAt)` | `routines.service.ts` : `findMany {animalId} orderBy doneAt desc take N` | Mineur (tri+fetch) |
| I3 | `Routine (animalId, active)` | `getActiveRoutines` (animal → routines `active: true`) | Mineur |
| I4 | `NotificationEvent (userId, status, scheduledAt)` | file de traitement par statut (si implémentée) | À prévoir |
| I5 | `PushSubscription (userId, endpoint)` | `notifications.service.ts` : `findFirst {userId, endpoint}` | Mineur (couvert par 2 index) |

**Index redondants à supprimer** (doublons d'index uniques, coût d'écriture inutile) : `User_email_idx`, `PasswordResetToken_token_idx`, `Animal_publicSlug_idx`, `SpeciesProfile_speciesId_idx` (4 index dupliqués par des contraintes UNIQUE).

---

## 4. RELATIONS / CASCADES

Toutes les 8 FK réelles sont `ON DELETE CASCADE ON UPDATE CASCADE` :

```
User ──CASCADE──► Animal ──CASCADE──► Routine
  │                │                  ActionLog
  │                │                  AnimalHealthRecord
  ├──CASCADE──► PushSubscription
  ├──CASCADE──► NotificationPreference   (1:1 via userId UNIQUE)
  ├──CASCADE──► NotificationEvent        (colonnes routineId/animalId SANS FK)
  └──CASCADE──► PasswordResetToken
```

**Suppression d'un User :** propre — animaux, routines, logs, health records, push subs, prefs, events, tokens partent en cascade. Aucun orphelin possible sur les FK déclarées (vérifié : 0 orphelin).

**Trous :**
1. **M7 — `NotificationEvent.routineId`/`animalId` sans FK** : suppression d'une Routine/d'un Animal → events avec références mortes (aucune cascade, aucun SET NULL). À corriger par FK avec `onDelete: SetNull` (ou suppression ciblée en app).
2. **C4 — `Animal.speciesId` sans FK** vers `SpeciesProfile.speciesId` : espèces fantômes déjà présentes (8/9 animaux).
3. Pas de relation entre les tables éditoriales `Species*` elles-mêmes (SpeciesProfile → SpeciesFeeding/Habitat/…) : cohérence assurée uniquement par la convention `speciesId` + le seed ; une espèce peut n'avoir que feeding sans habitat (aucune contrainte). Vérifié : 51/51/51/51 profils-feeding-habitat-behavior, mais seulement 27 health et 147 legislation (sur 51 espèces × pays).

---

## 5. INTÉGRITÉ DES DONNÉES (requêtes live)

**Comptages :** User 28 · Animal 9 · AnimalHealthRecord 1 · Routine 1 · ActionLog 1 · PushSubscription 0 · NotificationPreference 1 · NotificationEvent 0 · PasswordResetToken 0 · SpeciesProfile 51 · SpeciesFeeding 51 · SpeciesHabitat 51 · SpeciesBehavior 51 · SpeciesHealthContent 27 · SpeciesLegislation 147 · RecommendedEquipment 36 · AffiliateStore 9.

**Résultats des contrôles (21 requêtes) :**

| Contrôle | Résultat |
|---|---|
| Animaux sans user, health records sans animal, routines/actionlogs orphelins, push subs/prefs/events sans user | **0** ✓ (FK CASCADE fonctionnelles) |
| Events avec routineId/animalId orphelins | 0 (mais table vide — non probant) |
| Doublons email / endpoint push / publicSlug | **0** ✓ |
| Users email NULL/vide | 0 ✓ |
| grade hors liste, points négatifs | 0 ✓ |
| status events / legislation invalides | 0 ✓ (tables vides ou seed validé) |
| schedule/types NULL (JSONB obligatoires) | 0 ✓ |
| notes > 1000 chars (Animal) | 0 ✓ |
| **Animaux avec speciesId sans SpeciesProfile** | **8/9** ⚠ (speciesId 1 et 123 — espèces fantômes) |
| **Users sans NotificationPreference** | **27/28** ⚠ (normal : préférence créée à la demande) |
| **Animaux sans routine** | 8/9 ⚠ (normal) |
| dates health futures | 0 ✓ |
| description > 500 chars (SpeciesProfile) | 0 ✓ |
| `Animal.photos` NULL (drift nullabilité) | 1 ⚠ |

**Qualité du seed / données :**
- **m11 — la DB est polluée par des fixtures de tests automatisés** : 27 des 28 users sont des artifacts de tests E2E (`edge-test-*`, `perf-test-*`, `double-submit-*`, `cleanup-test-*`, `audit*/free*/op*/cp*@test.local`, `test@example.com`) et 7 des 9 animaux sont issus de ces tests (noms « L'Animal de José & María », « AAAAA… » × 1200 chars, speciesId factices 1/123). La DB « locale » ne peut pas servir de référence de qualité.
- **m12 — seed de démo mélangé au seed de prod** : `seed.ts` crée un user `test@captivia.local` avec mot de passe **en dur** (`Test1234!`, bcrypt 10), un animal à ID explicite `test-animal-rango`, une routine `test-routine-feeding`, et vide/recrée `AffiliateStore` (`deleteMany` puis `createMany`) à chaque exécution → **exécuter le seed en prod = création d'un compte admin de démo compromis + destruction des magasins**.
- **m13 — IDs explicites non-uuid dans les fixtures** : `test-animal-rango`, `test-routine-feeding`, `general-thermostat-0`… Techniquement sans impact (PK TEXT), mais ils côtoient des `uuid()` applicatifs : le seed n'est pas idempotent au sens propre pour ces lignes (upsert OK, mais mélange des conventions).
- **Incohérence seed ↔ scheduler** : le seed écrit `schedule: { days: ['tuesday','friday'], time: '19:00' }` alors que le scheduler ne lit que `hour`/`day`/`date`/`hours` → la routine seedée ne déclenche jamais rien.

---

## 6. ANALYSE DES TYPES

### 6.1 JSONB (types/typeSchedules/schedule/details/recommendedFoods/foodsToAvoid/diseases/sources/keys)
**Constat :** 10 champs JSONB. Aucune requête SQL filtrable dessus dans le code actuel (tout est chargé puis filtré en JS) → **acceptable au volume actuel, c'est un choix d'architecture à assumer**, pas un bug. Risques :
- Aucune contrainte de forme (pas de validation JSON Schema en DB ni de `CHECK (jsonb_typeof(...))`) → données invalides possibles (déjà : mismatch de clés prefs `nourrissage` vs events `Nourrissage`).
- Le jour où il faudra « les events de type X en attente » ou « les routines qui se déclenchent à 08:00 », il faudra **normaliser en colonnes** (ou index GIN + expressions) — planifier cette migration.
- `Routine.schedule` est le cas le plus risqué : le scheduler le parse ad hoc (cf. M5).

### 6.2 IDs
- `uuid()` pour tous les modèles sauf fixtures de seed (IDs explicites). Cohérent, TEXT PK, pas de conflit technique. Aucun impact perf (uuid v4 aléatoire → index fragmentation légère, négligeable à ce volume ; envisager `gen_random_uuid()` côté DB pour le parallélisme d'insertion si besoin).
- **Impact du seed :** IDs explicites = risque que le seed de démo soit exécuté en prod (cf. m12/m13).

### 6.3 `speciesId Int` vs BigInt (GBIF)
- Les **nubKeys du backbone GBIF** sont bornés par `NUB_MAXIMUM_KEY` (constante `int` Java côté GBIF) → **Int32 suffit pour les taxonKeys du backbone** (espèces usuelles : 5221172, 7587934…). OK pour l'usage actuel.
- **Risque** : les `usageKey` de checklists non-NUB (WoRMS, iNaturalist, Catalogue of Life — cf. discussion GBIF « int to long ») peuvent **dépasser 2^31-1**. Si Captivia référence un jour des espèces via usageKeys de checklists ou des occurrences (`gbifID`), passer à `BigInt`.
- **Recommandation :** garder `Int` pour les nubKeys (documenter la contrainte), ou migrer en `BigInt` par précaution avant le gel du schéma. À trancher maintenant (changer un Int en BigInt plus tard = migration de type).

### 6.4 Timestamps
- **M10 — `TIMESTAMP(3) WITHOUT TIME ZONE`** partout (Prisma `DateTime` par défaut sur PostgreSQL). Pour une app mondiale avec **notifications programmées à l'heure locale** (routine « 19:00 »), l'absence de timezone est un piège : l'interprétation dépend du fuseau du serveur et aucun offset n'est stocké. `scheduledAt`, `schedule.hour`, `doneAt` sont tous concernés.
- **Recommandation :** passer en `timestamptz` (UTC) via migration dédiée, et convertir les heures de routine côté applicatif selon le fuseau du user (champ `timezone` à ajouter sur User/NotificationPreference).

### 6.5 Divers
- `points Int`, `grade String` : cf. M3. `order Int` (x2) : OK. `Float` température : OK (double precision).
- `snooze Int @default(15)` : OK. `photos String[]` : stockage d'URLs en array — pas de limite de taille du tableau.

---

## 7. RECOMMANDATIONS PROD (priorisées)

**Bloquant avant tout déploiement :**
1. **R1 (C1/C2/C3)** — Squasher l'historique : créer UNE migration initiale complète et ordonnée (17 tables, colonnes, index, FK, GIN), supprimer les 5 migrations existantes, puis valider en CI un `prisma migrate deploy` sur DB vide + `prisma migrate diff` vs schéma = 0 écart. C'est la seule façon de rendre la prod reproductible.
2. **R2 (C4)** — FK `Animal.speciesId → SpeciesProfile.speciesId` (ou à défaut validation stricte à l'écriture + nettoyage des 8 animaux à speciesId 1/123). Idem pour les colonnes `speciesId` des tables Species* (ou assouplir volontairement avec commentaire).
3. **R3 (M7)** — FK `NotificationEvent.routineId/animalId` avec `onDelete: SetNull` (Prisma : `onDelete: SetNull`), pour tuer les références mortes.
4. **R4 (M10)** — Migrer tous les timestamps en `timestamptz` + champ `timezone` par user ; stocker en UTC.

**Avant montée en charge :**
5. **R5 (M9/I1)** — Index GIN sur `AffiliateStore.categories` et `.types`.
6. **R6 (M2/M3)** — CHECK constraints : `grade IN (...)`, `deliveryChannel IN (...)`, `status` (events/legislation) IN (...), `frequency`/`type` (routines) IN (...), `points >= 0` — plus simple : les appliquer en validation applicative + CHECK en base pour les champs critiques.
7. **R7 (M5)** — Structurer `Routine.schedule` : soit colonnes dédiées (`hour`, `days Int[]`, `date`), soit validation JSON (zod) à l'écriture + aligner seed ↔ scheduler.
8. **R8 (M1)** — Aligner la nullabilité des 5 colonnes array sur le schéma (`SET NOT NULL` après nettoyage du 1 NULL).
9. **R9 (m12/m13)** — Séparer `seed.ts` (démo) d'un seed de prod sans fixtures (pas de compte de test, pas de mot de passe en dur, pas de `deleteMany` destructeur) ; purger les fixtures de tests de la base avant tout snapshot de référence.

**Hygiène / évolutions :**
10. **R10** — Supprimer les 4 index redondants (doublons des uniques) ; ajouter I2/I3 (composites ActionLog, Routine) ; unicité `RecommendedEquipment(speciesId, category, label)` et `AffiliateStore.url`.
11. **R11** — Purge cron des `PasswordResetToken` expirés ; soft delete `deletedAt` sur User (RGPD/suppression différée) + index partiel.
12. **R12** — Limites de taille en base (name ≤ 100, notes ≤ 2000…) via CHECK ou validation stricte (prouvé nécessaire : name 1 200 chars).
13. **R13** — Vrais liens d'affiliation (placeholders actuels) + contrainte d'unicité url.
14. **R14** — Partitionnement : **prématuré** (≈440 lignes au total) ; prévoir pour `NotificationEvent` et `ActionLog` (append-only, croissance linéaire avec l'usage) — prévoir dès maintenant la colonne de partition (`createdAt`) et ne pas créer d'index trop larges dessus. Revoir à 1M+ lignes.
15. **R15** — Décider maintenant `speciesId Int` (nubKeys) vs `BigInt` (tous usageKeys GBIF) — cf. §6.3.
16. **R16** — `NotificationEvent` : rendre le pipeline effectif (le scheduler ne crée aucun event aujourd'hui → système de points mort) et index `(userId, status, scheduledAt)` quand la file par statut existera.

---

## 8. TABLEAU RÉCAPITULATIF DES PROBLÈMES

| ID | Gravité | Modèle(s) | Problème |
|---|---|---|---|
| C1 | 🔴 Critique | global | Historique de migrations inapplicable dans l'ordre (m1-m3 altèrent des tables créées en m4) ; `_prisma_migrations` sans historique valide |
| C2 | 🔴 Critique | PasswordResetToken, AnimalHealthRecord, AffiliateStore | 3 tables du schéma absentes de toutes les migrations (db push only) |
| C3 | 🔴 Critique | NotificationPreference, NotificationEvent | 3 colonnes (deliveryChannel, routineId, animalId) absentes des migrations |
| C4 | 🔴 Critique | Animal, SpeciesProfile | Pas de FK speciesId → espèce fantôme (8/9 animaux concernés) |
| M1 | 🟠 Majeur | Animal, RecommendedEquipment, AffiliateStore, SpeciesLegislation | Nullabilité array divergente DB vs schéma (5 colonnes) |
| M2 | 🟠 Majeur | User, NotificationPreference, SpeciesBehavior, SpeciesLegislation, NotificationEvent | Champs enum-like sans CHECK (grade, status, deliveryChannel, frequency…) |
| M3 | 🟠 Majeur | User | points/grade sans contrainte de cohérence ni CHECK ≥ 0 |
| M4 | 🟠 Majeur | 10 champs JSONB | Données non contraintes, non filtrables ; mismatch de clés prefs/events ; schedule parse ad hoc |
| M5 | 🟠 Majeur | Routine | `schedule` Json fragile ; seed écrit des champs jamais lus par le scheduler (routine muette) |
| M6 | 🟠 Majeur | PushSubscription | `keys` Json sans validation ; 0 abonnement en DB (brique jamais exercée) |
| M7 | 🟠 Majeur | NotificationEvent | Pas de FK routineId/animalId → références mortes à la suppression |
| M8 | 🟠 Majeur | NotificationEvent | Pipeline jamais exercé (0 event) → système de points/grade inerte |
| M9 | 🟠 Majeur | AffiliateStore | Index btree sur array inutile pour `has` (@>) ; GIN requis |
| M10 | 🟠 Majeur | tous | Timestamps sans timezone (app mondiale, notifications locales) |
| m1 | 🟡 Mineur | User | Pas de soft delete (RGPD) |
| m2 | 🟡 Mineur | PasswordResetToken | Pas de purge des tokens expirés |
| m3 | 🟡 Mineur | Animal, SpeciesProfile, SpeciesHabitat, RecommendedEquipment | Champs texte sans limite de taille (prouvé : 1 200 chars) |
| m4 | 🟡 Mineur | Routine | `monthly` géré par le code mais absent du commentaire du schéma |
| m5 | 🟡 Mineur | ActionLog | Index composite (animalId, doneAt) manquant |
| m6 | 🟡 Mineur | PushSubscription | Index composite (userId, endpoint) manquant |
| m7 | 🟡 Mineur | NotificationEvent | Index (userId, status, scheduledAt) à prévoir |
| m8 | 🟡 Mineur | RecommendedEquipment, AffiliateStore | Pas d'unicité métier (doublons possibles) |
| m9 | 🟡 Mineur | SpeciesHabitat | Pas de CHECK tempMin ≤ tempMax, humidité 0-100 |
| m10 | 🟡 Mineur | AffiliateStore | URLs placeholder — aucun lien d'affiliation réel |
| m11 | 🟡 Mineur | global | DB polluée par fixtures de tests (27/28 users, 7/9 animaux) |
| m12 | 🟡 Mineur | seed | Seed démo dangereux en prod (compte en dur, deleteMany destructeur) |
| m13 | 🟡 Mineur | seed | IDs explicites non-uuid mélangés aux uuid() (fixtures) |

**Total : 4 critiques · 10 majeurs · 9 mineurs = 23 problèmes.**
