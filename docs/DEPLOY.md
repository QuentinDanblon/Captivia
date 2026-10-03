# Captivia — Guide de déploiement (Netlify + Render + Neon)

Ce guide décrit la mise en ligne gratuite de Captivia avec **build automatique relié à GitHub** (tâches DEP-01 et DEP-08 du `docs/PLAN-PRODUCTION.md`, §5). Les incidents, la rotation des secrets et la restauration des sauvegardes sont traités dans `docs/RUNBOOK.md`.

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
| Secret | `NEON_DATABASE_URL_DIRECT` | URL Neon **directe** | Jobs `migrate-production`, « Seed production » et « Database Backup » |
| Secret | `BACKUP_AGE_RECIPIENT` | clé **publique** age (`age1…`) | Chiffrement des sauvegardes (workflow « Database Backup », voir `docs/RUNBOOK.md` §3) |
| Variable | `API_URL` | ex. `https://captiviacaptivia-api.onrender.com` | `keep-warm.yml` (manuel) |

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
3. Vérifier `CORS_ORIGIN`, `FRONTEND_URL` et `PUBLIC_WEB_URL` dans `render.yaml` : ils valent `https://captivia-app.netlify.app`. Si le nom du site Netlify est différent, corriger le fichier et committer.
4. Le déploiement est piloté par `autoDeployTrigger: checksPass` : aucun Deploy Hook n'est nécessaire. Dans *Settings* du service, vérifier que le déclencheur est bien « After CI checks pass ».
5. Noter l'URL du service (`https://captiviacaptivia-api.onrender.com`) et la saisir dans la variable GitHub `API_URL` (§3.2).

### 3.4 Netlify (frontend)
1. *Add new project → Import an existing project → GitHub* → choisir le dépôt. Le `netlify.toml` est détecté (base `frontend`, commande `npm run build`, Node 22). Nom du site : `captivia` s'il est libre (supprimer l'ancien site homonyme sur l'ancien compte pour libérer le nom).
2. *Site configuration → Environment variables* : créer `NEXT_PUBLIC_API_URL` = URL de l'API Render, avec une valeur pour les contextes **Production** et **Deploy Previews**. Cette variable est lue **au build** : après modification, relancer un déploiement.
3. Activer les **Deploy Previews** (par défaut pour les PR). L'origine d'une preview (`https://deploy-preview-N--captivia-app.netlify.app`) n'est pas dans `CORS_ORIGIN` : les appels API des previews échoueront tant que l'API de staging (DEP-05) n'autorise pas ce motif, ou que l'origine n'est pas ajoutée à la main.
4. Les workflows GitHub ne déploient plus le front : `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID` ne sont plus nécessaires.
5. **Apps mobiles (W6-09)** : créer aussi `APPLE_TEAM_ID` et `ANDROID_SHA256_CERT_FINGERPRINTS` (contexte **Production** ; `IOS_BUNDLE_ID` et `ANDROID_PACKAGE_NAME` seulement si l'identifiant diffère de `app.captivia`). Ces variables sont lues **au build** pour générer `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json` ; une valeur absente ou mal formée donne une 404 (jamais de fichier invalide). Après modification, relancer un déploiement, puis vérifier :

   ```bash
   curl -sI https://captivia-app.netlify.app/.well-known/apple-app-site-association   # 200, content-type: application/json, sans redirection
   curl -s  https://captivia-app.netlify.app/.well-known/assetlinks.json
   ```

   Le domaine des liens est celui de `NEXT_PUBLIC_SITE_URL` : en cas de domaine définitif, le reporter aussi dans *Associated Domains* (iOS) et l'`intent-filter` (Android), voir `docs/MOBILE.md` § 8.

### 3.5 Protection de `main`
*Settings → Branches → Add rule* sur `main` : PR obligatoire, checks requis (`test-backend`, `build-frontend`, `docker-build`, `quality`), branche à jour. Ne pas exiger `migrate-production` (il ne tourne que sur `push`). Un job ignoré (PR en brouillon, ou partie non modifiée : job `changes` de `ci.yml`) compte comme réussi pour GitHub ; la CI tourne au passage de la PR à « prête ».

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
| `CORS_ORIGIN` | Render | URL Netlify + `capacitor://localhost,https://localhost` (app mobile, déjà dans `render.yaml`) | Oui (*) |
| `FRONTEND_URL` | Render | URL publique du site | Oui (*) |
| `PUBLIC_WEB_URL` | Render | URL publique du site (liens e-mails, pages publiques) | Oui (*) |
| `TRUST_PROXY` | Render | `true` | Oui |
| `HOST` | Render | `0.0.0.0` | Oui |
| `CACHE_TYPE`, `REDIS_ENABLED`, `LOG_LEVEL` | Render | `memory`, `false`, `info` | Défauts du Blueprint |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | Render | Brevo | Oui dès W3-01 |
| `SENTRY_DSN` | Render | projet Sentry UE | Recommandé |
| `OPERATOR_EMAILS` | Render | remplacé par `User.role` (W0-01) | — |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Render (`sync: false` ; clé publique servie par `GET /notifications/vapid-public-key`, rien côté Netlify) | `npm run vapid:generate` (backend/) | Dès W3-03 |
| `FCM_SERVICE_ACCOUNT_JSON` | Render (`sync: false`, secret) | clé JSON du compte de service Firebase **encodée en base64** (`base64 -w0 captivia-firebase-adminsdk-xxxx.json` ; Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée). Push natif de l'app (W6-07) : Android via FCM, iOS via le relais APNs de FCM | Non : sans elle, push natif désactivé (journal info au démarrage), rappels locaux et Web Push inchangés. Dès la publication des apps |
| `FCM_PROJECT_ID` | Render (`sync: false`) | identifiant du projet Firebase (ex. `captivia-app`) | Non : `project_id` du JSON par défaut |
| `IAP_ENABLED`, `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_ENTITLEMENT_ID`, `GOOGLE_PLAY_PACKAGE_NAME` | Render (`sync: false`) | RevenueCat (achats in-app, pas de Stripe — voir `docs/PAYMENTS.md`) | Dès la publication sur les stores |
| `SPECIESPLUS_API_TOKEN` | Render (`sync: false`) | jeton Species+ (api.speciesplus.net) | Non : sans jeton, `/speciesplus/*` → 503 `INTEGRATION_DISABLED` et `speciesPlus.status = "disabled"` sur la fiche législation |
| `NCBI_API_KEY`, `NCBI_EMAIL` | Render (`sync: false`) | clé NCBI et e-mail de contact | Non : PubMed est public (3 req/s), la clé porte le quota à 10 req/s |
| `COMMUNITY_ENABLED` | Render (`sync: false`) | `false` tant que la communauté n'est pas ouverte | Non (défaut `false` : routes `/community/*` en 404) |
| `COMMUNITY_CONTACT_EMAIL` | Render (`sync: false`) | adresse du point de contact DSA (modération) | Recommandé dès `COMMUNITY_ENABLED=true` |
| `COMMUNITY_HIDE_THRESHOLD`, `COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS`, `COMMUNITY_POSTS_PER_HOUR`, `COMMUNITY_COMMENTS_PER_MINUTE`, `COMMUNITY_UPLOADS_PER_HOUR` | Render (`sync: false`) | défauts 3, 7, 5, 5, 30 | Non |
| `MEDIA_DRIVER` | Render (`sync: false`) | `s3` | Oui si `COMMUNITY_ENABLED=true` (refusé au démarrage sinon : disque éphémère) |
| `MEDIA_BUCKET`, `MEDIA_PUBLIC_BASE_URL` | Render (`sync: false`) | bucket R2 et son domaine public (`https://media.<domaine>` ou `https://pub-….r2.dev`) | Oui si `MEDIA_DRIVER=s3` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | Render (`sync: false`) | R2 : `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `auto`, jeton API R2 (lecture/écriture limité au bucket), `false` | Clés : oui si `MEDIA_DRIVER=s3` |
| `MEDIA_MAX_BYTES` | Render (`sync: false`) | défaut 8 Mo (plafond 20 Mo) | Non |
| `NEXT_PUBLIC_API_URL` | Netlify | URL de l'API Render | Oui |
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` | Build mobile (GitHub Variables `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY` → `mobile.yml`) ; inutiles sur Netlify | clés **publiques** RevenueCat (`appl_…`, `goog_…`) | Pour l'achat in-app : sans clé, l'app affiche « Abonnement indisponible » sur la plateforme concernée (voir `docs/PAYMENTS.md`) |
| `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Build mobile | `premium` (défaut) : identique à `REVENUECAT_ENTITLEMENT_ID` | Non |
| `NEXT_PUBLIC_NATIVE_PUSH` | Build mobile (GitHub Variable `NATIVE_PUSH` → `mobile.yml`) ; inutile sur Netlify | `1` quand les projets natifs ont la configuration Firebase (secret `GOOGLE_SERVICES_JSON_BASE64`, `GoogleService-Info.plist`) | Non : sans elle, l'app n'enregistre aucun jeton push (rappels locaux seulement) ; ne **jamais** la poser sans Firebase (plantage Android, `docs/MOBILE.md` § 7.3) |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | Netlify | `[À COMPLÉTER]` : URL https des fiches App Store et Google Play | À la publication (sinon la page abonnement du web affiche le marqueur) |
| `NEXT_PUBLIC_SENTRY_DSN` | Netlify | projet Sentry UE | Recommandé |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` | Netlify (et build mobile) | `false` tant que la communauté est fermée (aucune requête de détection) ; `true` à l'ouverture (lien depuis la landing) | Non : absent, l'app interroge `GET /community/rules` et n'affiche la communauté que si l'API répond (404 = fermée) ; une ouverture est gardée 12 h, une fermeture 1 minute. L'app visible recontrôle automatiquement une fermeture expirée, ainsi qu'au retour dans l'onglet (le navigateur journalise ce 404 dans la console : le fixer à `false` supprime la sonde) |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Netlify (et build mobile) | même valeur que `MEDIA_PUBLIC_BASE_URL` côté API (`https://media.<domaine>`) | Oui dès `COMMUNITY_ENABLED=true` avec `MEDIA_DRIVER=s3` : origine ajoutée à la CSP `img-src` ; absente, seule l'API (pilote local) est autorisée |
| `APPLE_TEAM_ID` | Netlify | Team ID Apple (10 caractères, developer.apple.com → Membership) | Pour les Universal Links iOS (W6-09) : sans elle, `/.well-known/apple-app-site-association` → 404 |
| `IOS_BUNDLE_ID` | Netlify | `app.captivia` (défaut, = `appId` de `capacitor.config.ts`) | Non |
| `ANDROID_PACKAGE_NAME` | Netlify | `app.captivia` (défaut) | Non |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Netlify | empreintes SHA-256 de la clé **Play App Signing** et de la clé d'**upload**, séparées par des virgules (`AA:BB:…`, voir `docs/MOBILE.md` § 8.4) | Pour les App Links Android (W6-09) : sans elle, `/.well-known/assetlinks.json` → 404 |
| `NEON_DATABASE_URL_DIRECT` | GitHub Secrets | Neon **directe** | Oui |
| `BACKUP_AGE_RECIPIENT` | GitHub Secrets | clé publique age (`age1…`) | Pour « Database Backup » (sans lui, aucune sauvegarde) |
| `API_URL` | GitHub Variables | URL de l'API Render | Pour `keep-warm.yml` (diagnostic manuel) |

### API externes : résilience et intégrations (W1-04, W3-05)

- **Client HTTP unique** (`backend/src/external/http/`) : timeout 5 s, 3 redirections max (https, hôtes publics), réponse ≤ 5 Mo, User-Agent `Captivia/1.0`. GBIF : 3 tentatives max (erreur réseau, 5xx ou 429) avec backoff + jitter, budget total 7,5 s.
- **Disjoncteur par fournisseur** (GBIF, Wikipedia, Wikidata, Open Pet Food Facts, PubMed, Species+, iNaturalist, EOL) : 5 échecs consécutifs ouvrent le circuit 30 s ; les appels échouent alors sans toucher le réseau et l'API se replie sur les `SpeciesProfile` locaux ou le cache périmé (conservé 7 jours). Une recherche ne renvoie jamais 500 ; un échec n'est jamais mis en cache. L'état des disjoncteurs de GBIF / Wikipedia / Wikidata est visible dans `GET /gateway/health` (`status: "degraded"` si un fournisseur est en panne).
- **Species+** : intégration réelle, active uniquement si `SPECIESPLUS_API_TOKEN` est défini.
- **PubMed** : intégration réelle, sans clé obligatoire (références affichées sur la fiche santé d'une espèce).
- **Amazon** : aucune intégration (décision D-09 : la PA-API 5 est remplacée par la Creators API, qui exige un compte Associates actif). La route `/amazon/*` est retirée (404) ; les liens d'affiliation viennent de la table `AffiliateStore`. À rouvrir quand le compte Associates est validé.

(*) D'autres tâches du plan (vague 0 et 1, durcissement de la configuration) rendent `CORS_ORIGIN` et `FRONTEND_URL` **obligatoires en production** : l'API pourra refuser de démarrer si elles sont absentes. Elles sont déjà fournies par `render.yaml` ; ne pas les supprimer du Blueprint ni du Dashboard.

### Communauté : stockage des médias (Cloudflare R2)

Le volet communauté reste **désactivé** (`COMMUNITY_ENABLED=false`) tant que la modération n'est pas prête (`docs/RUNBOOK.md`, « Modération de la communauté »). Pour l'ouvrir :

1. **Cloudflare → R2** : créer le bucket `captivia-media` (juridiction **UE** si proposée). Offre gratuite : 10 Go de stockage, sortie gratuite.
2. **Accès public en lecture** : *Settings → Public access* : brancher un domaine personnalisé (`media.<domaine>`, recommandé) ou activer l'URL `r2.dev` (limitée en débit, pour essai). Cette URL devient `MEDIA_PUBLIC_BASE_URL`. Les clés sont aléatoires (`<uuid>.webp`), les objets servis avec `Cache-Control: public, max-age=31536000, immutable`.
3. **Jeton API** : *R2 → Manage API tokens → Create* : permission *Object Read & Write*, restreinte au bucket. Reporter l'Access Key ID et le Secret dans Render (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`), l'endpoint S3 du compte dans `S3_ENDPOINT`, `S3_REGION=auto`.
4. Render : `MEDIA_DRIVER=s3`, `MEDIA_BUCKET=captivia-media`, `COMMUNITY_CONTACT_EMAIL`, puis `COMMUNITY_ENABLED=true`. L'API refuse de démarrer si une variable du pilote manque.
5. Contrôle : publier une photo depuis un compte de test vérifié, ouvrir l'URL de l'image (format WebP, aucune métadonnée), la supprimer et vérifier qu'elle disparaît du bucket.

Tout stockage compatible S3 convient (AWS S3 : `S3_ENDPOINT` vide et région réelle ; MinIO : `S3_FORCE_PATH_STYLE=true`). Le pilote `local` (`MEDIA_LOCAL_DIR`, défaut `var/media`, images servies par `GET /community/media/:key`) est réservé au développement et aux tests. Le site affiche les images d'un autre domaine : penser à l'autoriser dans la CSP (`img-src`) côté frontend lors de la phase 2.

## 6. Premier déploiement et seed

1. Fusionner la branche sur `main` (ou pousser). Observer *Actions → CI* : `test-backend`, `build-frontend`, `docker-build`, `quality`, puis `migrate-production`.
2. Une fois `migrate-production` vert, Render lance le build Docker (3 à 6 min) puis démarre l'API. Vérifier `https://<api>/health` (réponse 200). Le premier démarrage après une veille prend 30 à 60 s.
3. Netlify construit le site en parallèle. Ouvrir `https://captivia-app.netlify.app/fr`.
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
- Ainsi, le rollback Render vers N-1 reste sûr après une migration « expand ». En cas de migration destructive erronée : restaurer depuis la branche Neon / l'historique PITR (voir DEP-03 et `docs/RUNBOOK.md` §3).

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

## 10. Sécurité : CSP et en-têtes HTTP (W4-08)

Source unique : `frontend/src/lib/csp.ts` (module pur, testé dans `src/lib/__tests__/csp.test.ts`), utilisé par `frontend/next.config.ts` (en-têtes du site, toutes les routes) et par `frontend/scripts/build-mobile.mjs` (balise `<meta>` de l'app Capacitor). Les valeurs dépendent de `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_SENTRY_DSN`, **lues au build** : un changement de ces variables impose un nouveau build Netlify.

**CSP de production du site** (exemple avec l'API Render et Sentry UE) :

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://upload.wikimedia.org https://inaturalist-open-data.s3.amazonaws.com https://static.inaturalist.org https://api.gbif.org;
font-src 'self'; connect-src 'self' https://captiviacaptivia-api.onrender.com https://o….ingest.de.sentry.io;
worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests
```

- `connect-src` : le site, l'origine de l'API et, seulement si un DSN est défini, l'origine d'ingestion Sentry. Le backend local (`localhost:3001`) n'y figure qu'en développement.
- `img-src` : photos locales (`/images`), `data:` (photo compressée, QR code), `blob:` (aperçus) et les seuls hôtes de photos d'espèces (`SPECIES_IMAGE_HOSTS`). `pickSpeciesPhoto` ignore les médias GBIF servis ailleurs (la fiche prend la photo suivante ou la silhouette), donc la CSP ne bloque jamais une photo affichée. Ajouter un hébergeur = l'ajouter à `SPECIES_IMAGE_HOSTS`. Une URL de photo saisie à la main par un utilisateur et hébergée ailleurs n'est pas affichée (silhouette).
- Polices : auto-hébergées par `next/font` (`font-src 'self'`). Service worker Web Push : `worker-src 'self'` (la souscription push ne passe pas par `connect-src`). `/.well-known/*` et le manifeste sont servis par le site.
- `img-src` (communauté) : l'origine de `NEXT_PUBLIC_MEDIA_BASE_URL` (bucket public des images des membres), sinon celle de l'API (pilote `local`, `GET /community/media/:key`). `isAllowedMediaUrl` (`src/lib/community.ts`) n'affiche que ces images ; toute autre adresse est remplacée par une silhouette.
- `upgrade-insecure-requests` est omis en développement et face à une API en `http` (smoke E2E local).
- `'unsafe-eval'` n'est présent qu'en `next dev` (React s'en sert pour les piles d'erreur) ; jamais en production.

**Autres en-têtes** : `Strict-Transport-Security: max-age=63072000; includeSubDomains` (production ; **sans** `preload`, inscription difficilement réversible à décider une fois le domaine définitif en place), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (doublon de `frame-ancestors`), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` (le site n'utilise pas la caméra : l'import de photo passe par un sélecteur de fichier ; dans l'app native, la caméra passe par le plugin Capacitor).

**Pourquoi `'unsafe-inline'` reste dans `script-src` du site (compromis nonce / hachages)** — mesure sur le build Next 16.3 : chaque page HTML contient plusieurs scripts inline (4 sur l'accueil `/fr`), dont les charges RSC propres à la page (`self.__next_f.push([1,"…"])`, jusqu'à ~100 Ko) ; le contenu varie selon la page et la locale.
- *Nonce* (`proxy.ts`) : Next ne pose le nonce qu'au rendu serveur, ce qui impose le rendu **dynamique** de toutes les pages (149 pages aujourd'hui pré-rendues). Plus de cache CDN Netlify, une exécution de fonction par vue, réveils plus lents : trop coûteux sur l'offre gratuite, pour un site sans contenu tiers ni script externe.
- *Hachages* : ils devraient figurer dans l'en-tête, or `headers()` est figé avant le build et commun à toutes les pages. L'option expérimentale `experimental.sri` n'ajoute que des attributs `integrity` aux fichiers `/_next/static` (même origine) et ne couvre pas les scripts inline.
- Retenu : pages statiques, `script-src 'self' 'unsafe-inline'` **sans** `'unsafe-eval'`, sans aucune origine de script externe ; le reste de la politique (`object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors`, `connect-src` minimal) limite l'exploitation d'une éventuelle injection. Le rendu de React échappe le contenu, et aucun `dangerouslySetInnerHTML` ne sert hors JSON-LD (échappé). À réévaluer si Next sait un jour poser des hachages sur les pages statiques.

**App mobile** : l'export statique est entièrement connu après le build, donc `build-mobile.mjs` calcule les hachages SHA-256 des scripts inline de **chaque** page et les place dans sa `<meta>` : `script-src` sans `'unsafe-inline'` ni `'unsafe-eval'`. Mêmes directives que le site, plus les origines de la WebView (`capacitor://localhost`, `https://localhost`), sans `frame-ancestors` (ignorée en `<meta>`). Le pont natif de Capacitor est injecté hors CSP (script de démarrage de document, ou inséré avant la balise `<meta>`).

**Vérifier en production** : `curl -sI https://<site>/ | grep -iE 'content-security|strict-transport|permissions-policy'`. Les tests E2E smoke échouent sur toute violation CSP (console ou événement `securitypolicyviolation`, voir `frontend/e2e/support/test.ts`).

**API (NestJS)** : `helmet()` pose ses propres en-têtes (CSP par défaut `default-src 'self'`…, HSTS un an) sur des réponses JSON ; ils n'interviennent pas dans le chargement du site et ne sont pas modifiés.
