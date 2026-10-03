# Backend Captivia (API)

API REST NestJS 11 de Captivia : comptes (dont le mode invité), animaux et carnet de santé,
rappels (e-mail, Web Push, push natif), agenda et flux calendrier, fiches espèces sourcées,
abonnement Premium par achats intégrés (RevenueCat), communauté (fermée par défaut).
Prisma 6 sur PostgreSQL. Règles du dépôt et commandes de vérification :
[`../AGENTS.md`](../AGENTS.md).

## Démarrer en local

```bash
cp .env.example .env      # renseigner JWT_SECRET (16 caractères minimum hors production)
npm ci
npx prisma migrate deploy # applique les migrations sur DATABASE_URL
npx prisma db seed        # catalogue (espèces, races, modèles de routines), idempotent
npm run start:dev         # http://localhost:3001, sonde : /health
```

`npm run seed:dev` ajoute un compte et un animal de démonstration (refusé en production).

## Organisation (`src/`)

| Dossier | Rôle |
|---|---|
| `auth/`, `account/` | inscription, connexion, refresh tokens, invité → compte, vérification d'e-mail ; export et suppression RGPD |
| `animals/`, `routines/`, `medications/`, `vaccinations/`, `vet-appointments/`, `animal-measurements/`, `breeding/` | animaux et carnet de santé |
| `notifications/` | scheduler des rappels, Web Push, push natif FCM / APNs, jetons d'appareil |
| `agenda/` | agenda des soins et flux ICS |
| `subscription/`, `entitlement/` | webhook RevenueCat, droit Premium (`docs/PAYMENTS.md`) |
| `community/` | profils, publications, modération DSA (`COMMUNITY_ENABLED`) |
| `species/`, `external/`, `gateway/`, `health-content/`, `legislation/`, `food/`, `equipment/`, `species-routines/` | catalogue et API externes (GBIF, Wikipédia, Wikidata, PubMed, Species+) |
| `maintenance/` | purges quotidiennes (rétention RGPD, `docs/RUNBOOK.md` § 6.5) |
| `config/` | validation des variables d'environnement (Joi) ; l'API refuse de démarrer en production sans les obligatoires |
| `common/`, `health/`, `mail/`, `cache/`, `prisma/` | gardes, rôles, sondes `/health`, e-mails, cache, client Prisma |
| `monitoring/`, `analytics/` | chargés seulement si `REDIS_ENABLED=true` (désactivé en production) |

Base de données : `prisma/schema.prisma`, migrations dans `prisma/migrations/`. Enrichissement
éditorial des fiches : `prisma/enrichment/` (contrat : `prisma/enrichment/CONTRACT.md`).

## Scripts utiles

```bash
npm test -- --runInBand   # unitaires + e2e (Postgres et JWT_SECRET requis)
npm run lint:check        # ESLint sans correction (bloquant en CI)
npm run build             # prisma generate + nest build
npm run operator:set -- <email>   # promouvoir un opérateur (e-mail vérifié requis)
npm run vapid:generate    # paire de clés Web Push
```
