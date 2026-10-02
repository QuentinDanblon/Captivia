# Captivia — Guide de déploiement (Netlify + Render + Neon)

Ce guide décrit la mise en ligne gratuite de Captivia avec **build automatique relié à GitHub** (tâches DEP-01 et DEP-08 du `docs/PLAN-PRODUCTION.md`, §5). Les incidents et la rotation des secrets seront traités dans `docs/RUNBOOK.md`.

## 1. Architecture

```
Navigateur / App ──HTTPS──► Netlify (Next.js 16, CDN, previews de PR)
        │
        └────HTTPS──► Render Free « captivia-api » (Docker NestJS, Francfort)
                              │  URL « pooled » + TLS
                              ▼
                       Neon Free « captivia » (PostgreSQL, Francfort)

GitHub ─ push sur main ─► CI (tests, build, migrate-production)
                              ├─ checks verts ─► Render : build Docker + déploiement automatiques
                              └──────────────► Netlify : build + publication automatiques
```

| Brique | Rôle | Déclencheur de déploiement |
|---|---|---|
| Netlify | Frontend `frontend/` (base du `netlify.toml`) | Push sur `main` (production), PR (deploy preview) |
| Render | API `backend/` (Blueprint `render.yaml`) | Push sur `main`, une fois **tous les checks GitHub verts** (`autoDeployTrigger: checksPass`) |
| Neon | PostgreSQL | Migrations par le job `migrate-production` de `.github/workflows/ci.yml` |

Ordre garanti sur `main` : la CI exécute `test-backend` et `build-frontend`, puis `migrate-production` applique `prisma migrate deploy` sur Neon. Comme `migrate-production` est un check du commit, Render ne déploie la nouvelle API **qu'après** la migration.

## 2. Prérequis

- Le dépôt GitHub de Captivia (droits administrateur : secrets, protection de branche, installation d'applications).
- Trois comptes gratuits : [Neon](https://neon.tech), [Render](https://render.com), [Netlify](https://netlify.com), tous connectés avec « Continue with GitHub ».
- Optionnel : Brevo (e-mails), Sentry (erreurs UE). Voir la matrice §5.

## 3. Mise en place pas à pas

### 3.1 Neon (base de données)
1. Créer un projet **`captivia`**, région **AWS Europe Central 1 (Francfort)**, base **`captivia`**.
2. Dans *Connect*, relever deux chaînes de connexion :
   - **Pooled** (hôte contenant `-pooler`) → pour l'API sur Render.
   - **Direct** (même hôte sans `-pooler`) → pour les migrations.
3. Ne jamais les committer. Elles vont uniquement dans le Dashboard Render et dans les secrets GitHub.

### 3.2 GitHub (secrets, variables, environnement)
Dépôt → *Settings → Secrets and variables → Actions* :

| Type | Nom | Valeur | Usage |
|---|---|---|---|
| Secret | `NEON_DATABASE_URL_DIRECT` | URL Neon **directe** | Jobs `migrate-production` et « Seed production » |
| Variable | `API_URL` | ex. `https://captivia-api.onrender.com` | `keep-warm.yml` (manuel) |

Puis *Settings → Environments → New environment* : **`production`** (les jobs de migration et de seed y sont rattachés). Option : ajouter des « Required reviewers » ; dans ce cas la migration attend une approbation manuelle, et Render attend donc aussi (le check reste « en attente »).

Si `NEON_DATABASE_URL_DIRECT` est absent, `migrate-production` et « Seed production » ne plantent pas : ils s'arrêtent avec un avertissement (`::warning::`) et ne font rien. Ne pas oublier ensuite d'ajouter le secret, sinon aucune migration ne sera appliquée automatiquement.

### 3.3 Render (API)
1. Dashboard → *New → Blueprint* → choisir le dépôt. Render lit `render.yaml` et propose le service `captivia-api` (Docker, plan Free, Francfort, `/health`).
2. Renseigner les variables marquées `sync: false` :
   - `DATABASE_URL` = URL Neon **pooled** + paramètres PgBouncer, par exemple :
     ```
     postgresql://USER:PASS@ep-xxxx-pooler.eu-central-1.aws.neon.tech/captivia?sslmode=require&pgbouncer=true&connect_timeout=15
     ```
     Le mode pooled est indispensable sur Render : Prisma ouvre plusieurs connexions et Neon limite les connexions directes. `pgbouncer=true` désactive les requêtes préparées incompatibles avec le mode transaction de PgBouncer.
   - Facultatifs : `SENTRY_DSN`, `MAIL_HOST` (+ autres `MAIL_*`).
3. Vérifier `CORS_ORIGIN`, `FRONTEND_URL` et `PUBLIC_WEB_URL` dans `render.yaml` : ils valent `https://captivia.netlify.app`. Si le nom du site Netlify est différent, corriger le fichier et committer.
4. Le déploiement est piloté par `autoDeployTrigger: checksPass` : aucun Deploy Hook n'est nécessaire. Dans *Settings* du service, vérifier que le déclencheur est bien « After CI checks pass ».
5. Noter l'URL du service (`https://captivia-api.onrender.com`) et la saisir dans la variable GitHub `API_URL` (§3.2).

### 3.4 Netlify (frontend)
1. *Add new project → Import an existing project → GitHub* → choisir le dépôt. Le `netlify.toml` est détecté (base `frontend`, commande `npm run build`, Node 22). Nom du site : `captivia` s'il est libre (supprimer l'ancien site homonyme sur l'ancien compte pour libérer le nom).
2. *Site configuration → Environment variables* : créer `NEXT_PUBLIC_API_URL` = URL de l'API Render, avec une valeur pour les contextes **Production** et **Deploy Previews**. Cette variable est lue **au build** : après modification, relancer un déploiement.
3. Activer les **Deploy Previews** (par défaut pour les PR). L'origine d'une preview (`https://deploy-preview-N--captivia.netlify.app`) n'est pas dans `CORS_ORIGIN` : les appels API des previews échoueront tant que l'API de staging (DEP-05) n'autorise pas ce motif, ou que l'origine n'est pas ajoutée à la main.
4. Les workflows GitHub ne déploient plus le front : `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID` ne sont plus nécessaires.

### 3.5 Protection de `main`
*Settings → Branches → Add rule* sur `main` : PR obligatoire, checks requis (`test-backend`, `build-frontend`, `docker-build`, `quality`), branche à jour. Ne pas exiger `migrate-production` (il ne tourne que sur `push`).

## 4. Migrations : URL pooled ou directe ?

| Usage | URL | Pourquoi |
|---|---|---|
| API Render (runtime) | **Pooled** `-pooler` + `&pgbouncer=true&connect_timeout=15` | Beaucoup de connexions courtes ; réveil du calcul Neon (~1 s) toléré par `connect_timeout` |
| `prisma migrate deploy`, seed (GitHub Actions) | **Directe** (sans `-pooler`) | Les migrations utilisent des verrous consultatifs et des transactions longues, incompatibles avec PgBouncer en mode transaction |

## 5. Matrice des variables d'environnement

| Variable | Où | Valeur en production | Obligatoire |
|---|---|---|---|
| `DATABASE_URL` | Render | Neon **pooled** + `pgbouncer=true&connect_timeout=15` | Oui |
| `JWT_SECRET` | Render | généré par Render (≥ 32 caractères) | Oui |
| `NODE_ENV` | Render | `production` | Oui |
| `CORS_ORIGIN` | Render | URL Netlify (+ `capacitor://localhost,https://localhost` en vague 6) | Oui (*) |
| `FRONTEND_URL` | Render | URL publique du site | Oui (*) |
| `PUBLIC_WEB_URL` | Render | URL publique du site (liens e-mails, pages publiques) | Oui (*) |
| `TRUST_PROXY` | Render | `true` | Oui |
| `HOST` | Render | `0.0.0.0` | Oui |
| `CACHE_TYPE`, `REDIS_ENABLED`, `LOG_LEVEL` | Render | `memory`, `false`, `info` | Défauts du Blueprint |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | Render | Brevo | Oui dès W3-01 |
| `SENTRY_DSN` | Render | projet Sentry UE | Recommandé |
| `OPERATOR_EMAILS` | Render | remplacé par `User.role` (W0-01) | — |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Render (`sync: false` ; clé publique servie par `GET /notifications/vapid-public-key`, rien côté Netlify) | `npm run vapid:generate` (backend/) | Dès W3-03 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Render | Stripe | Dès W3-04 |
| `NEXT_PUBLIC_API_URL` | Netlify | URL de l'API Render | Oui |
| `NEXT_PUBLIC_SENTRY_DSN` | Netlify | projet Sentry UE | Recommandé |
| `NEON_DATABASE_URL_DIRECT` | GitHub Secrets | Neon **directe** | Oui |
| `API_URL` | GitHub Variables | URL de l'API Render | Pour `keep-warm.yml` (diagnostic manuel) |

(*) D'autres tâches du plan (vague 0 et 1, durcissement de la configuration) rendent `CORS_ORIGIN` et `FRONTEND_URL` **obligatoires en production** : l'API pourra refuser de démarrer si elles sont absentes. Elles sont déjà fournies par `render.yaml` ; ne pas les supprimer du Blueprint ni du Dashboard.

## 6. Premier déploiement et seed

1. Fusionner la branche sur `main` (ou pousser). Observer *Actions → CI* : `test-backend`, `build-frontend`, `docker-build`, `quality`, puis `migrate-production`.
2. Une fois `migrate-production` vert, Render lance le build Docker (3 à 6 min) puis démarre l'API. Vérifier `https://<api>/health` (réponse 200). Le premier démarrage après une veille prend 30 à 60 s.
3. Netlify construit le site en parallèle. Ouvrir `https://captivia.netlify.app/fr`.
4. **Seed du catalogue** (une seule fois, idempotent) : *Actions → « Seed production » → Run workflow*. Il applique `prisma migrate deploy` puis `prisma db seed` (espèces, races, magasins affiliés).
5. Contrôles : recherche d'espèce, inscription d'un compte de test, ajout d'un animal. Vérifier dans les logs Render l'absence d'erreur CORS ou de connexion à la base.
6. Créer un monitor **UptimeRobot** gratuit (HTTP, toutes les 5 min) sur `<API_URL>/health` : il garde l'API Render éveillée et alerte par e-mail en cas de panne. Ne PAS planifier `keep-warm.yml` : le dépôt étant privé, un cron toutes les 10 min (~4 300 min/mois) épuiserait le quota gratuit de 2 000 min de GitHub Actions et bloquerait la CI.

## 7. Retour arrière (rollback)

Toujours commencer par **identifier si la base a changé** : un rollback de code ne défait pas les migrations.

**API (Render)** : service `captivia-api` → *Events / Deploys* → choisir le dernier déploiement sain → **Rollback**. Cela redémarre l'ancienne image sans rebuild et **désactive l'auto-déploiement** du service (comportement actuel de Render, à vérifier dans l'interface) : après correction sur `main`, réactiver l'auto-déploiement (*Settings → Auto-Deploy*) ou utiliser *Manual Deploy → Deploy latest commit*.

**Site (Netlify)** : *Deploys* → choisir le déploiement précédent → **Publish deploy**. Cela verrouille la production sur ce déploiement (les nouveaux pushs ne sont plus publiés) ; cliquer sur **Unlock publishing** / « Auto publishing » une fois le correctif prêt.

**Base de données** : les migrations Prisma ne se « dé-jouent » pas en production. Règle **expand / contract** : chaque migration doit rester compatible avec la version N-1 de l'API.
- *Expand* (déploiement N) : ajouter colonnes/tables nullables ou avec valeur par défaut, nouveaux index ; ne rien supprimer ni renommer ; l'API N écrit dans l'ancien et le nouveau schéma si nécessaire.
- *Contract* (déploiement N+1, après stabilisation) : supprimer les colonnes et tables devenues inutiles, durcir les contraintes (`NOT NULL`).
- Renommer = ajouter la nouvelle colonne, copier les données, basculer le code, supprimer l'ancienne dans une livraison ultérieure.
- Ainsi, le rollback Render vers N-1 reste sûr après une migration « expand ». En cas de migration destructive erronée : restaurer depuis la branche Neon / l'historique PITR (voir DEP-03 et le futur `docs/RUNBOOK.md`).

Un déploiement dont le check `migrate-production` échoue n'est **pas** déployé par Render (checks non verts) : corriger la migration et repousser.

## 8. Limites des offres gratuites

| Service | Limites à connaître |
|---|---|
| **Render Free** | Mise en veille après 15 min sans trafic (réveil 30–60 s) ; 750 h d'instance par mois (un ping UptimeRobot toutes les 5 min la garde éveillée ≈ 744 h) ; 512 Mo de RAM, 0,1 CPU ; pas de commande *pre-deploy* (d'où les migrations côté GitHub Actions) ; système de fichiers éphémère ; builds plus lents. |
| **Neon Free** | Stockage et heures de calcul plafonnés par projet ; calcul suspendu après quelques minutes d'inactivité (réveil ≈ 1 s) ; historique de restauration (PITR) très court ; nombre de connexions limité (d'où le pooler). |
| **Netlify** | Quotas mensuels de builds, de bande passante et de fonctions (modèle à crédits) ; les previews de PR consomment des builds. |
| **GitHub Actions** | 2 000 min/mois en dépôt privé : la CI complète en consomme ~10-15 par push ; aucun cron planifié (le ping est confié à UptimeRobot). |

Les chiffres exacts évoluent : les vérifier sur les pages de tarifs de chaque fournisseur.

## 9. Quand passer en payant

Passer en payant **dès qu'il y a des utilisateurs réels** ou que l'un de ces signaux apparaît :
- Render Free : latence de réveil visible, quota de 750 h dépassé, 512 Mo insuffisants (erreurs OOM) → **Render Starter** (pas de veille, commande *pre-deploy* `npx prisma migrate deploy` possible, ce qui permettra de supprimer `migrate-production`). Supprimer alors le monitor de réveil (garder la supervision).
- Neon Free : stockage ou heures de calcul proches du plafond, besoin d'un PITR plus long (RPO du plan : 24 h) → **Neon Launch**.
- Netlify : builds ou bande passante épuisés en cours de mois → plan Pro.
- Obligations légales et d'exploitation (sauvegardes, SLA, journaux) : voir DEP-03 (sauvegardes) et la checklist go-live du plan §7.
