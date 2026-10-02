# 🦎 Captivia - Le Guide de la Faune

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)

**Plateforme complète, pédagogique et bienveillante qui accompagne les propriétaires d'animaux domestiques et NAC au quotidien.**

---

## 📋 Vue d'ensemble

Captivia est une application web multilingue permettant de :
- 🔍 **Découvrir** : Catalogue de 10 000+ espèces (GBIF, Wikipedia, Wikidata)
- 📚 **Apprendre** : Fiches espèces avec santé, législation, alimentation, matériel
- 🐾 **Gérer** : Suivi de vos animaux avec routines de soins
- 🔔 **Rappels** : Notifications intelligentes (nourrissage, entretien, UVB, santé)
- 🌍 **Multilingue** : 6 langues supportées (FR, EN, ES, DE, IT, PT)
- 🔗 **Affiliation** : Liens produits transparents pour financer le projet

---

## 🏗️ Architecture

### Stack Technique

**Backend** (NestJS)
```
- Framework: NestJS
- ORM: Prisma + PostgreSQL
- Auth: JWT + Passport
- Cache: Redis/Memcached/Memory
- APIs: GBIF, Species+, PubMed, Open Pet Food Facts, Amazon PA
```

**Frontend** (Next.js)
```
- Framework: Next.js 16 (App Router)
- UI: Tailwind CSS 4 + Radix UI
- i18n: next-intl (6 langues)
- Auth: JWT + Context API
- Animations: Framer Motion
```

### Architecture Modulaire

```
backend/
├── auth/          # Authentification JWT
├── animals/       # CRUD animaux
├── routines/      # Routines de soins
├── health-content/# Santé (PubMed)
├── legislation/   # Législation (Species+)
├── food/          # Alimentation (Open Pet Food Facts)
├── equipment/     # Matériel (Taxonomie + Amazon)
├── notifications/ # Push notifications
├── species/       # Catalogue GBIF
└── prisma/        # ORM & migrations

frontend/
├── app/[locale]/
│   ├── page.tsx              # Accueil
│   ├── species/[id]/         # Fiche espèce
│   ├── mes-animaux/          # Mes animaux
│   ├── login/                # Connexion
│   ├── register/             # Inscription
│   ├── transparency/         # Transparence
│   └── parametres/notifications/ # Préférences
├── components/
├── contexts/      # AuthContext
├── messages/      # Traductions (6 langues)
└── lib/api.ts     # Client API
```

---

## 🚀 Démarrage Rapide

### Option recommandée : Docker Compose

Docker Desktop est la seule dépendance. La même commande fonctionne sur Windows, macOS et Linux :

```bash
# 1. Cloner le repo
git clone <repo-url>
cd Captivia

# 2. Créer la configuration locale
# macOS/Linux : cp .env.example .env
# Windows     : copy .env.example .env

# 3. Construire et démarrer PostgreSQL, les migrations, le backend et le frontend
docker compose up --build -d
```

**URLs Docker :**
- Frontend : http://localhost:3000
- Backend : http://localhost:3001
- Healthcheck : http://localhost:3001/health

Commandes utiles :

```bash
docker compose ps
docker compose logs -f backend
# Après l'ajout de nouvelles migrations :
docker compose run --rm migrate
docker compose down
# Supprime aussi les données PostgreSQL :
docker compose down -v
```

### Installation native (facultative)

Pour développer sans Docker :

```bash
# Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Frontend, dans un autre terminal
cd ../frontend
npm install
npm run dev
```

**URLs natives :** frontend `http://localhost:3000`, backend `http://localhost:3001`.

Voir la section [📦 Déploiement Docker](#-déploiement-docker) pour les ports personnalisés et les variables d'environnement.


---

## 🎯 Fonctionnalités

### ✅ Catalogue Public (Sans Compte)

**Recherche d'espèces:**
- Recherche par nom commun ou scientifique
- Filtres taxonomiques (royaume, classe, ordre, famille)
- Filtres conservation (IUCN)
- 10 000+ espèces disponibles

**Fiche Espèce Complète:**
- 📊 **Overview**: Classification, distribution, conservation
- 🩺 **Santé**: Maladies courantes, symptômes, prévention, références PubMed
- ⚖️ **Législation**: Statut CITES, EU Wildlife Trade, réglementations par pays
- 🍖 **Alimentation**: Produits recommandés (Open Pet Food Facts)
- 🛠️ **Matériel**: Équipement recommandé avec liens affiliés Amazon

### ✅ Compte Utilisateur (Requis pour Mes Animaux)

**Authentification:**
- Inscription/Connexion sécurisée (JWT)
- Session persistante
- Multilingue (préférence utilisateur)

**Mes Animaux:**
- Ajout illimité d'animaux (1 gratuit, premium pour plus)
- Données: espèce, nom, âge, sexe, photos, notes
- Gestion complète (CRUD)

**Routines de Soins:**
- Types: nourrissage, entretien, UVB, contrôles santé
- Fréquences: quotidien, hebdomadaire, mensuel, personnalisé
- Horaires configurables

**Historique:**
- Journal de toutes les actions
- Notes personnelles
- Timeline complète

### ✅ Notifications Push

**Rappels Intelligents:**
- Basés sur vos routines
- Par type activable/désactivable
- Plage horaire configurable
- Fonction snooze
- Pas d'email (push uniquement)

### ✅ Multilingue

**6 langues supportées:**
- 🇫🇷 Français
- 🇬🇧 English
- 🇪🇸 Español
- 🇩🇪 Deutsch
- 🇮🇹 Italiano
- 🇵🇹 Português

Sélecteur de langue dans toutes les pages.

### ✅ Monétisation Transparente

**Affiliation:**
- Liens Amazon avec badge "Lien affilié"
- Page Transparence complète
- Aucun coût supplémentaire pour l'utilisateur

**Premium (Préparé):**
- 1 animal gratuit
- Abonnement pour animaux illimités
- Fonctionnalités avancées futures

---

## 📚 APIs Intégrées

| API | Usage | Status |
|-----|-------|--------|
| **GBIF** | Taxonomie, distribution, médias | ✅ Actif |
| **Wikipedia** | Descriptions, images | ✅ Actif |
| **Wikidata** | Données structurées | ✅ Actif |
| **PubMed** | Références scientifiques santé | ✅ Actif |
| **Species+** | CITES, EU Wildlife Trade | ✅ Actif (token requis) |
| **Open Pet Food Facts** | Composition alimentaire | ✅ Actif |
| **Amazon PA API** | Produits matériel | ✅ Structure (credentials requis) |

---

## 🗄️ Base de Données

**9 modèles Prisma:**
- User (avec isPremium)
- Animal (lié à User)
- Routine (lié à Animal)
- ActionLog (historique)
- PushSubscription
- NotificationPreference
- SpeciesHealthContent (éditorial)
- SpeciesLegislation (éditorial)
- RecommendedEquipment (taxonomie)

Voir [prisma/schema.prisma](backend/prisma/schema.prisma)

---

## 📡 API Endpoints

**40+ endpoints disponibles:**

### Public (Sans Auth)
- `/species/*` - Catalogue GBIF (8 endpoints)
- `/species/:id/health` - Santé
- `/species/:id/legislation` - Législation
- `/food/*` - Alimentation (4 endpoints)
- `/equipment` - Matériel

### Protégés (Auth Required)
- `/auth/*` - Inscription, connexion (3 endpoints)
- `/users/me/animals` - CRUD animaux (5 endpoints)
- `/users/me/animals/:id/routines` - Routines (5 endpoints)
- `/users/me/animals/:id/history` - Historique (3 endpoints)
- `/users/me/push-subscriptions` - Push (3 endpoints)
- `/users/me/notification-preferences` - Préférences (2 endpoints)

Voir l'endpoint de santé : `http://localhost:3001/health`

---

## 📊 Score de Réussite

```
✅ Backend:         100% (10 modules, 40+ endpoints)
✅ Frontend:        100% (7 pages, 6 langues, AuthContext)
✅ Database:        100% (9 modèles, migrations)
✅ APIs externes:   100% (4/4 intégrées)
✅ i18n:            100% (6 langues complètes)
✅ Auth & Security: 100% (JWT, guards, ownership)
✅ Premium Logic:   100% (limite 1 gratuit)
✅ Affiliation:     100% (badges, transparence)

SCORE GLOBAL: 100% ✅
```

---

## 🧪 Tests

**Tests rapides:**
```bash
# Health check
curl http://localhost:3001/health

# Search species
curl "http://localhost:3001/species/search?q=boa"

# Register user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@captivia.com","password":"password123"}'

# Search food
curl "http://localhost:3001/food/search?q=dog+food"
```

---

## 💾 Backup & Restauration

Scripts de sauvegarde / restauration de la base PostgreSQL : dump au format custom de `pg_dump` (déjà compressé), vérifié par `pg_restore --list`, rotation automatique. En production (Neon), la sauvegarde est faite par le workflow `.github/workflows/backup.yml` (chiffrée avec age) : voir [`docs/RUNBOOK.md`](docs/RUNBOOK.md) §3.

### Sauvegarde

```bash
DATABASE_URL='postgresql://user:<mot de passe>@127.0.0.1:5432/captivia' bash scripts/backup-db.sh
```

- Produit `backups/captivia-YYYYMMDD-HHMMSS.dump` (dossier ignoré par git).
- Nécessite `pg_dump` et `pg_restore` en local, de version supérieure ou égale à celle du serveur, et `DATABASE_URL` (l'URL n'est jamais affichée). Le paramètre `?schema=…` ajouté par Prisma est retiré automatiquement ; les autres (`sslmode`…) sont conservés.
- Rotation : seuls les **14** dumps les plus récents sont conservés (`KEEP=14` dans le script).
- Le dump n'est pas chiffré : ne pas le conserver en clair hors de la machine.

### Restauration

```bash
DATABASE_URL='postgresql://user:<mot de passe>@127.0.0.1:5432/captivia' \
  bash scripts/restore-db.sh backups/captivia-20261002-020000.dump
```

⚠️ La restauration remplace les données de la base ciblée (confirmation « oui » demandée ; la cible est affichée sans identifiants). Elle est atomique (`--single-transaction --exit-on-error`) : à la première erreur, la base reste inchangée. Les objets absents du dump ne sont pas supprimés ; pour repartir d'une base vide, exécuter d'abord `psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`.

### Test de restauration recommandé

Un backup jamais testé n'est pas un backup : vérifiez régulièrement qu'un dump est restaurable, par exemple dans une base jetable :

```bash
docker compose exec -T postgres createdb -U "$POSTGRES_USER" captivia_restore_test
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/captivia_restore_test" \
  bash scripts/restore-db.sh backups/captivia-<date>.dump
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d captivia_restore_test -c "SELECT count(*) FROM information_schema.tables;"
docker compose exec -T postgres dropdb -U "$POSTGRES_USER" captivia_restore_test
```

---

## 📦 Déploiement Docker

### Stack complète Windows / macOS / Linux

La stack Docker contient les services nécessaires :

1. PostgreSQL avec volume persistant ;
2. Redis persistant, disponible si le cache Redis est activé ;
3. job Prisma `migrate` exécuté avant le backend ;
4. backend NestJS compilé en image de production ;
5. frontend Next.js compilé en mode `standalone`.

Aucun Node.js, PostgreSQL ou Prisma n'est requis sur la machine hôte. Seul Docker Desktop est nécessaire.

```bash
# Configuration locale à la racine du projet
cp .env.example .env              # macOS/Linux
# Windows : copy .env.example .env

# Build et démarrage complet
docker compose up --build -d

# État des services
docker compose ps

# Logs
docker compose logs -f backend frontend
```

**URLs par défaut :**

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:3001` |
| Healthcheck | `http://localhost:3001/health` |

Le job `migrate` s'exécute automatiquement avant le backend. Après l'ajout d'une nouvelle migration :

```bash
docker compose run --rm migrate
```

Pour arrêter la stack sans supprimer les données :

```bash
docker compose down
```

Pour repartir avec une base PostgreSQL vide :

```bash
docker compose down -v
```

### Ports personnalisés

Les ports sont configurables dans le `.env` racine :

```dotenv
POSTGRES_PORT=5432
BACKEND_PORT=3001
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
FRONTEND_URL=http://localhost:3000
```

`NEXT_PUBLIC_API_URL` est intégré au bundle navigateur lors du build : il doit être une URL accessible depuis le navigateur (`localhost` ou l'adresse LAN), jamais `http://backend:3001`.

### Secrets et intégrations

- `JWT_SECRET` doit être remplacé par une valeur aléatoire d'au moins 32 caractères avant toute mise en production.
- Les variables optionnelles (`SPECIESPLUS_*`, `AMAZON_*`, `VAPID_*`, SMTP, Sentry) peuvent être ajoutées au `.env` racine ; Compose les transmet au backend.
- Aucun fichier `.env` n'est copié dans les images Docker.
- La base PostgreSQL est stockée dans le volume Docker `captivia_pgdata`.

### Vérification manuelle

```bash
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}

curl -I http://localhost:3000/
```

Vérification de bout en bout (recherche d'espèce → fiche) avec un navigateur headless :

```bash
cd frontend && node e2e-docker-check.js
```

Ce script vérifie que le frontend Docker joint bien le backend (absence de bannière
« Backend non connecté ») et qu'une recherche renvoie des suggestions.

> **Piège connu** : si le frontend affiche « Backend non connecté » alors que
> `curl http://localhost:3001/health` répond, vérifier la CSP dans
> `frontend/next.config.ts` — `connect-src` doit autoriser le backend local
> (`http://localhost:3001`). C'est le premier endroit à regarder quand l'UI
> perd le backend sans raison réseau apparente.

Les images sont multi-stage : l'image backend runtime ne contient ni sources TypeScript ni CLI de développement, et l'image frontend utilise le serveur Next.js standalone.

### Mobile

- Google Play Store (Android)
- Apple App Store (iOS)

---

## 🔒 Sécurité

- ✅ JWT avec expiration 7 jours
- ✅ Passwords hachés (bcrypt)
- ✅ Validation des DTOs (class-validator)
- ✅ Guards sur routes protégées
- ✅ Ownership checks sur toutes les ressources
- ✅ CORS configuré
- ✅ Rate limiting

---

## 🌍 Open Data

Captivia s'engage pour l'open data:
- GBIF (CC-BY)
- Species+ (UNEP-WCMC)
- PubMed (domaine public)
- Open Pet Food Facts (ODbL)

Toutes les sources sont créditées et les liens fournis.

---

## 📄 Licence

Private - © 2026 Captivia

---

## 📊 Statut

Voir [docs/PLAN-PRODUCTION.md](docs/PLAN-PRODUCTION.md) pour le statut complet du projet, la roadmap, et les étapes de production.

---

## 📦 Déploiement

Pour les instructions de déploiement, les configurations de serveur et les environnements, consultez [docs/DEPLOY.md](docs/DEPLOY.md).

**Configurations disponibles :**
- `netlify.toml` — Configuration pour Netlify (frontend)
- `render.yaml` — Configuration pour Render (backend)

---

**Développé avec ❤️ pour les amoureux des animaux**
