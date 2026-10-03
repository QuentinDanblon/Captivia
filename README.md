# Captivia

Captivia est l'application des particuliers qui ont un ou plusieurs animaux : on y note leur santé
(vaccins, traitements, pesées, visites chez le vétérinaire), on est prévenu au bon moment (rappels,
agenda, abonnement calendrier) et on apprend ce que chaque espèce demande, grâce à environ 1 500 fiches
d'espèces et de races sourcées (GBIF, Wikipédia, Wikidata, Liste rouge UICN, CITES, PubMed).

- **Web** : application complète dans le navigateur (ordinateur, tablette, téléphone), en six langues
  (français, anglais, espagnol, allemand, italien, portugais).
- **Mobile** : la même application pour Android et iOS (Capacitor 7), en préparation pour les stores.
- **Offre** : sans compte ou avec un compte gratuit, un animal avec tout son carnet ; Premium
  (achats intégrés dans l'app mobile) pour suivre plusieurs animaux.
- **Communauté** (photos, questions, commentaires) : code livré, fermée tant que la modération n'est
  pas prête.

Site : <https://captivia-app.netlify.app> · API : <https://captiviacaptivia-api.onrender.com/health>

## Statut

Le code de la version web 1.0 est livré ; la mise en ligne publique attend des actions du
propriétaire (CI GitHub, services Netlify et Render, prestataire d'e-mail, textes légaux). Au
2026-10-03, l'API répond sur Render ; le site Netlify n'est pas encore publié. Les applications
mobiles ne sont pas encore publiées (projets natifs à générer, comptes stores à ouvrir). État détaillé, décisions et actions
restantes : [`docs/PLAN-PRODUCTION.md`](docs/PLAN-PRODUCTION.md) (§ 0).

## Stack

| Partie | Technologies |
|---|---|
| `backend/` | NestJS 11, Prisma 6, PostgreSQL (Neon en production), Node 22 |
| `frontend/` | Next.js 16 (App Router), next-intl, Tailwind CSS 4, Radix UI, Capacitor 7 pour l'app mobile |
| Hébergement | Netlify (site), Render Free à Francfort (API), Neon Free à Francfort (base) |
| Achats | RevenueCat (App Store, Google Play) ; aucun paiement sur le web |

## Démarrer en local

### Avec Docker Compose (stack complète)

Prérequis : Docker avec Compose v2.

```bash
cp .env.example .env
# Renseigner dans .env les deux valeurs obligatoires (Compose refuse de démarrer sans elles) :
#   POSTGRES_PASSWORD=<openssl rand -hex 24>
#   JWT_SECRET=<openssl rand -base64 48>   (32 caractères minimum : le backend tourne en mode production)
docker compose up --build -d
docker compose run --rm migrate npx prisma db seed   # catalogue des espèces, une fois (idempotent)
```

Compose démarre PostgreSQL et Redis, applique les migrations (service `migrate`), puis lance le
backend et le frontend :

| Service | Adresse |
|---|---|
| Frontend | <http://localhost:3000> |
| Backend | <http://localhost:3001> (sonde : `/health`) |

`docker compose logs -f backend`, `docker compose run --rm migrate` après une nouvelle migration,
`docker compose down` (garde les données), `docker compose down -v` (repart d'une base vide). Les ports
et l'URL d'API du bundle (`NEXT_PUBLIC_API_URL`, lue au build, joignable depuis le navigateur) se
règlent dans `.env`.

### Sans Docker (développement)

Prérequis : Node 22 (`.nvmrc`) et un PostgreSQL local.

```bash
# Backend (http://localhost:3001)
cd backend
cp .env.example .env            # DATABASE_URL de votre base, JWT_SECRET d'au moins 16 caractères
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run start:dev

# Frontend, dans un autre terminal (http://localhost:3000)
cd frontend
npm ci
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

À la racine, `npm install` puis `npm run dev` lance les deux serveurs ensemble (`concurrently`),
une fois les dépendances de `backend/` et `frontend/` installées (`npm run install:all`).

## Documentation

| Document | Contenu |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Règles du dépôt, carte du code, commandes de vérification (à lire avant toute contribution) |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Vision produit, offre, ton (fait foi) |
| [`docs/MESSAGING.md`](docs/MESSAGING.md) | Textes publiés : landing, stores, boutons |
| [`frontend/docs/DESIGN.md`](frontend/docs/DESIGN.md) | Système visuel, composants, garde-fous |
| [`docs/PLAN-PRODUCTION.md`](docs/PLAN-PRODUCTION.md) | État d'avancement (source unique), décisions D-xx, actions du propriétaire |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Mise en ligne Netlify + Render + Neon, variables d'environnement, CSP |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Exploitation : supervision, incidents, sauvegardes, secrets, purges, modération |
| [`docs/MOBILE.md`](docs/MOBILE.md) | Applications Android / iOS (Capacitor), push natif, liens universels |
| [`docs/PAYMENTS.md`](docs/PAYMENTS.md) | Premium par achats intégrés (RevenueCat) |
| [`docs/legal/registre-traitements.md`](docs/legal/registre-traitements.md) | Registre RGPD des traitements |
| [`docs/store/`](docs/store/README.md) | Fiches et déclarations des stores |
| [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md) | Détails propres à chaque application |

Les documents périmés sont dans [`docs/archive/`](docs/archive/README.md).

## Licence

Code propriétaire, tous droits réservés (`UNLICENSED`). Le choix d'un fichier `LICENSE` est une
décision ouverte (D-13). Les contenus tiers (textes Wikipédia sous CC BY-SA, données GBIF, photos sous
licence libre) gardent leur licence et sont crédités dans l'application.
