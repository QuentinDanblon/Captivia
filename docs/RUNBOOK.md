# Captivia — Runbook de production

Procédures d'exploitation de Captivia : supervision, incidents, restauration, rotation des secrets. Ce document ne décrit que ce qui existe dans le dépôt (`render.yaml`, `netlify.toml`, `.github/workflows/`, `backend/`). La mise en place initiale est dans [`docs/DEPLOY.md`](DEPLOY.md), les paiements dans [`docs/PAYMENTS.md`](PAYMENTS.md).

## Architecture et adresses

| Brique | Rôle | Adresse |
|---|---|---|
| Netlify | Frontend Next.js (`frontend/`) | `https://captivia-app.netlify.app` (`NEXT_PUBLIC_SITE_URL` dans `netlify.toml`) |
| Render (offre Free, Francfort) | API NestJS, service `captivia-api` | `https://captivia-api.onrender.com` (nom du service dans `render.yaml` ; l'URL exacte est affichée dans le Dashboard Render) |
| Neon (offre Free) | PostgreSQL | URL pooled dans Render (`DATABASE_URL`), URL directe dans le secret GitHub `NEON_DATABASE_URL_DIRECT` |

Dans les commandes ci-dessous : `API=https://captivia-api.onrender.com`.

---

## 1. Supervision

### 1.1 Sondes de santé (backend)

Définies dans `backend/src/health/health.controller.ts` (pas de préfixe global d'URL, pas de limitation de débit) :

| Route | Réponse | Rôle |
|---|---|---|
| `GET /health` | `200` `{"status":"ok","version":"<SHA du déploiement ou dev>","timestamp":"…"}` | Liveness. N'interroge pas la base. C'est le `healthCheckPath` de `render.yaml`. |
| `GET /health/ready` | `200` `{"status":"ok","database":"up",…}` ou `503` `{"statusCode":503,"status":"unavailable","database":"down",…}` | Readiness : exécute `SELECT 1` avec un délai maximal de 2 s. Réveille Neon s'il dormait. |

Il n'existe pas d'autre route de santé (pas de `/health/live`).

### 1.2 Disponibilité

Le moniteur externe n'est pas défini dans le dépôt : à créer à la main (voir `docs/DEPLOY.md` §6, étape 6). Recommandation du guide de déploiement : un monitor **UptimeRobot** gratuit (HTTP, toutes les 5 min) sur `<API>/health`. Il alerte par e-mail et garde l'API Render éveillée (voir §1.5).

### 1.3 Erreurs (Sentry)

- **Backend** : actif seulement si `SENTRY_DSN` est défini (`backend/src/instrument.ts`). `SENTRY_TRACES_SAMPLE_RATE` : part des transactions tracées (0 à 1, 0,1 par défaut). La `release` Sentry est le SHA du commit (`RENDER_GIT_COMMIT`) ; l'environnement est `NODE_ENV`. Les e-mails, cookies et en-têtes sensibles sont retirés des événements avant envoi.
- **Frontend** : actif seulement si `NEXT_PUBLIC_SENTRY_DSN` est défini côté Netlify (variable lue **au build** : relancer un déploiement après modification).
- Les règles d'alerte se configurent dans l'interface Sentry (rien dans le dépôt).

### 1.4 Journaux

- **API** : Render → service `captivia-api` → *Logs*. En production, journaux JSON (pino) ; chaque réponse porte un en-tête `x-request-id` (repris de la requête ou généré), utile pour retrouver une requête dans les logs. Niveau réglé par `LOG_LEVEL` (`info` dans `render.yaml`).
- **Frontend** : Netlify → *Deploys* → journal de build du déploiement.

### 1.5 Offres gratuites : veille et quotas

- **Render Free** : le service s'endort après 15 min sans trafic ; la première requête suivante est lente (30 à 60 s). 750 h d'instance gratuites par mois et par workspace : un ping toutes les 5 min garde l'instance éveillée en permanence, soit environ 744 h/mois (`docs/DEPLOY.md` §8). Suivre la consommation dans le Dashboard Render.
- **Neon Free** : le calcul se met en veille (scale-to-zero) après 5 min sans connexion ; le réveil prend environ 1 s. Stockage et heures de calcul plafonnés : voir les limites actuelles dans la documentation Neon.
- **GitHub Actions** : quota mensuel de minutes en dépôt privé (`docs/DEPLOY.md` §8).

### 1.6 Tests manuels

```bash
API=https://captivia-api.onrender.com

# Liveness (le premier appel après une veille peut durer 30 à 60 s)
curl -sS -m 90 "$API/health"

# Readiness (base de données) : afficher aussi le code HTTP
curl -sS -m 90 -i "$API/health/ready"

# Site
curl -sS -o /dev/null -w '%{http_code}\n' https://captivia-app.netlify.app/fr
```

Le champ `version` de `/health` indique le SHA du commit déployé (`dev` si la variable n'est pas définie).

---

## 2. Incidents courants

### 2.1 API indisponible

**Symptômes** : timeout, 502/503, `/health` ou `/health/ready` en erreur.

1. Attendre 60 s et réessayer : après une veille, le premier appel est lent (voir §1.5).
2. Render → `captivia-api` → *Logs* : l'API valide ses variables d'environnement au démarrage (schéma Joi, `backend/src/config/env.validation.ts`). En production elle refuse de démarrer si : `JWT_SECRET` fait moins de 32 caractères ou ressemble à une valeur d'exemple, `CORS_ORIGIN` est absent, `FRONTEND_URL` est absent ou n'est pas en https, `DATABASE_URL` est absent, ou `IAP_ENABLED=true` sans `REVENUECAT_WEBHOOK_SECRET` d'au moins 32 caractères.
3. `/health` répond mais `/health/ready` renvoie 503 : problème de base de données (§2.2).
4. Panne apparue juste après un déploiement : rollback (§2.4).
5. Sinon : Render → *Manual Deploy* → *Deploy latest commit*.

### 2.2 Base de données lente ou inaccessible

**Symptômes** : `/health/ready` en 503 (la base ne répond pas en 2 s), erreurs Prisma dans les logs ou dans Sentry.

- Sur l'offre Free, un calcul Neon en veille se réveille à la première connexion (environ 1 s) : une erreur isolée juste après une période d'inactivité est normale.
- Vérifier le projet dans la console Neon (statut, quotas atteints sur l'offre Free, incident en cours : documentation et statut sur neon.tech/docs).
- Inspecter les connexions depuis un poste avec `psql` (URL **directe**) :

  ```bash
  psql "$NEON_DATABASE_URL_DIRECT" -c "SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state;"
  psql "$NEON_DATABASE_URL_DIRECT" -c "SELECT pid, state, wait_event_type, now() - query_start AS duree, left(query, 80) AS requete FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle' ORDER BY query_start;"
  ```

- Si une migration vient d'échouer : le job `migrate-production` de `.github/workflows/ci.yml` est en échec, donc Render n'a pas déployé la nouvelle version (`autoDeployTrigger: checksPass`). Corriger la migration et repousser sur `main`.
- Base corrompue ou données perdues : restauration (§3).

### 2.3 Erreurs fréquentes en frontend

**Symptômes** : page blanche, erreurs JS, appels API en échec.

- Netlify → *Deploys* : le dernier build est-il vert ? Consulter son journal.
- Sentry (si `NEXT_PUBLIC_SENTRY_DSN` est défini) : issues frontend récentes.
- Appels API vers la mauvaise URL : `NEXT_PUBLIC_API_URL` est intégrée au bundle **au build** ; après modification dans Netlify, relancer un déploiement.
- Erreurs CORS : l'origine du site doit figurer dans `CORS_ORIGIN` côté Render. Les origines des deploy previews (`https://deploy-preview-N--captivia-app.netlify.app`) n'y sont pas (voir `netlify.toml`).
- Redéployer : Netlify → *Deploys* → *Trigger deploy* → *Clear cache and deploy site*.

### 2.4 Rollback Render (API)

1. Render → service `captivia-api` → *Events* (ou *Deploys*) → choisir le dernier déploiement sain → bouton **Rollback**. L'ancienne image redémarre sans rebuild. Render désactive alors l'auto-déploiement du service (comportement à confirmer dans l'interface, voir `docs/DEPLOY.md` §7).
2. Vérifier `GET /health` et `GET /health/ready` (§1.6).
3. Corriger sur `main` (par exemple `git revert <commit>` puis push) : la CI exécute les tests puis `migrate-production`, et Render redéploie.
4. Réactiver l'auto-déploiement (*Settings* → *Auto-Deploy*) ou lancer *Manual Deploy* → *Deploy latest commit*.

Un rollback de code **ne défait pas les migrations** : les migrations doivent rester compatibles avec la version précédente de l'API (règle expand / contract, `docs/DEPLOY.md` §7).

### 2.5 Rollback Netlify (site)

1. Netlify → *Deploys* → ouvrir un déploiement antérieur sain → **Publish deploy**.
2. Cela verrouille la production sur ce déploiement : les nouveaux pushs ne sont plus publiés tant que la publication automatique n'est pas réactivée (*Unlock publishing* / *Auto publishing*), à faire une fois le correctif prêt.

---

## 3. Sauvegarde et restauration

### 3.1 Ce qui existe

- **Neon** : historique et restauration (PITR) selon l'offre ; sur l'offre Free l'historique est très court (`docs/DEPLOY.md` §8). Voir la documentation Neon.
- **Dump logique hebdomadaire** : workflow `Database Backup` (`.github/workflows/backup.yml`), chaque dimanche à 03:17 UTC, ou à la demande (*Actions* → *Database Backup* → *Run workflow*). Il exécute `scripts/backup-db.sh` (`pg_dump` au format custom), chiffre le dump avec **age**, puis dépose `captivia-AAAAMMJJ-HHMMSS.dump.age` dans un artefact `database-backup-<run_id>` conservé **30 jours**.
- Avec ce seul mécanisme, la perte de données maximale est celle écoulée depuis le dernier dimanche. Pour une fréquence plus élevée, modifier le `cron` de `backup.yml`.
- Si l'un des secrets `NEON_DATABASE_URL_DIRECT` ou `BACKUP_AGE_RECIPIENT` manque, l'exécution se termine **sans erreur mais sans sauvegarde** : un message « Sauvegarde ignorée » apparaît dans les annotations de l'exécution. Un dump non chiffré n'est jamais envoyé. Vérifier donc qu'un artefact existe après chaque exécution (§6.2).
- Le workflow installe `postgresql-client-17` (variable `PG_VERSION` de `backup.yml`) : le client doit être de version supérieure ou égale à celle du serveur Neon. En cas d'erreur « server version mismatch », augmenter `PG_VERSION`.

### 3.2 Mise en place (une fois)

1. **Créer la paire de clés age** sur un poste de confiance :

   ```bash
   age-keygen -o captivia-backup.key
   # affiche : Public key: age1…
   ```

2. Enregistrer la **clé publique** (`age1…`) dans le secret GitHub `BACKUP_AGE_RECIPIENT` (*Settings* → *Secrets and variables* → *Actions* → *New repository secret*).
3. Conserver la **clé privée** (`captivia-backup.key`) **hors du dépôt** et hors de GitHub : gestionnaire de mots de passe et copie de secours séparée. Sans elle, les sauvegardes sont illisibles ; avec elle, n'importe qui peut les lire.
4. Enregistrer dans le secret `NEON_DATABASE_URL_DIRECT` l'URL Neon **non poolée** (hôte sans `-pooler`). C'est le même secret que celui des migrations (`docs/DEPLOY.md` §3.2). Les scripts refusent une URL contenant `-pooler`.
5. Lancer une première exécution manuelle et vérifier que l'artefact apparaît.

### 3.3 Restaurer la production

⚠️ **Destructif** : la base de production est remplacée par le contenu du dump. Les données créées après la date du dump sont perdues. **Tester d'abord la procédure sur une branche jetable (§3.4).**

Prérequis sur le poste : dépôt cloné, `age`, `psql` et `pg_restore` de version **17 ou supérieure** (un `pg_restore` plus ancien ne lit pas une archive produite par `pg_dump` 17).

1. **Récupérer le dump** : GitHub → *Actions* → *Database Backup* → exécution voulue → *Artifacts* → `database-backup-<run_id>` (zip) → extraire `captivia-AAAAMMJJ-HHMMSS.dump.age`.
2. **Déchiffrer** avec la clé privée :

   ```bash
   age --decrypt -i captivia-backup.key -o captivia-restore.dump captivia-AAAAMMJJ-HHMMSS.dump.age
   pg_restore --list captivia-restore.dump | head
   ```

3. **Filet de sécurité (recommandé)** : dans la console Neon, créer une branche à partir de l'état actuel de la base, à supprimer une fois la restauration validée.
4. **Suspendre l'API** : Render → `captivia-api` → *Settings* → *Suspend Service*. L'API n'écrit plus pendant la restauration. Ne pas pousser sur `main` pendant l'opération : le job `migrate-production` de `ci.yml` se lance à chaque push sur `main` et il n'existe aucun mécanisme pour l'ignorer.
5. **Repartir d'un schéma vide.** `pg_restore --clean` ne supprime que les objets présents dans le dump : les tables ajoutées par des migrations postérieures resteraient en place et risqueraient de faire échouer `prisma migrate deploy` ensuite.

   ```bash
   export DATABASE_URL='<URL Neon directe>'
   psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   ```

6. **Restaurer** (le script affiche la cible sans identifiants, puis demande de taper `oui`) :

   ```bash
   bash scripts/restore-db.sh captivia-restore.dump
   ```

   Le script utilise `pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error` : tout ou rien, à la première erreur la transaction est annulée. Le paramètre `?schema=…` éventuel de l'URL est retiré, les autres paramètres (`sslmode`…) sont conservés.

7. **Vérifier les données** :

   ```bash
   psql "$DATABASE_URL" -c 'SELECT count(*) FROM "User";'
   psql "$DATABASE_URL" -c 'SELECT count(*) FROM "SpeciesProfile";'
   psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;'
   ```

8. **Réappliquer les migrations manquantes** si des migrations ont été déployées après la date du dump (la version de l'API en ligne attend le schéma le plus récent) :

   ```bash
   cd backend && npm ci && npx prisma migrate deploy
   ```

   Alternative sans outils locaux : *Actions* → *Seed production* → *Run workflow* (il exécute `prisma migrate deploy` puis le seed, idempotent).

9. **Reprendre l'API** : Render → *Settings* → *Resume Service*, puis vérifier `/health`, `/health/ready` (§1.6), une connexion et Sentry. Les comptes créés après la date du dump n'existent plus : leurs jetons sont refusés et ils doivent se réinscrire.
10. Supprimer le dump déchiffré (`rm captivia-restore.dump`) : il contient des données personnelles.

### 3.4 Test de restauration sur une branche Neon jetable

À faire régulièrement (le plan prévoit un test trimestriel, DEP-03 de `docs/PLAN-PRODUCTION.md`) et avant toute vraie restauration.

1. Console Neon : créer une branche jetable ; relever sa chaîne de connexion **directe** (sans pooler).
2. Récupérer et déchiffrer un dump (§3.3, étapes 1 et 2).
3. Restaurer sur cette branche, en vérifiant que la cible affichée est bien l'hôte de la branche jetable et **pas** celui de la production avant de taper `oui` :

   ```bash
   export DATABASE_URL='<URL directe de la branche jetable>'
   psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   bash scripts/restore-db.sh captivia-restore.dump
   ```

4. Contrôler les données avec les requêtes du §3.3, étape 7.
5. Supprimer la branche jetable et le dump déchiffré.

### 3.5 Renouveler la paire age

Générer une nouvelle paire (§3.2), remplacer le secret `BACKUP_AGE_RECIPIENT` par la nouvelle clé publique, et **conserver l'ancienne clé privée** tant qu'il existe des artefacts chiffrés avec elle (30 jours de rétention).

---

## 4. Rotation des secrets

### 4.1 `JWT_SECRET`

- Dans `render.yaml` : `generateValue: true` (Render génère la valeur à la création du service ; elle n'est pas dans le dépôt). En production, le schéma Joi exige au moins 32 caractères et refuse les valeurs d'exemple (préfixes `dev-only` et `change-me`).
- **Quand** : après une suspicion de compromission (et selon la politique de l'équipe).
- **Comment** :
  1. Générer une valeur : `openssl rand -base64 48`.
  2. Render → `captivia-api` → *Environment* → `JWT_SECRET` → remplacer la valeur → enregistrer, puis attendre la fin du redéploiement.
  3. Vérifier `/health/ready`.
- **Conséquence** : tous les jetons existants deviennent invalides, donc toutes les sessions sont fermées et les utilisateurs doivent se reconnecter. Les jetons durent 7 jours (`expiresIn` dans `backend/src/auth/auth.module.ts`).
- Pour fermer les sessions d'un seul compte, utiliser `tokenVersion` (§5.3).

### 4.2 `REVENUECAT_WEBHOOK_SECRET`

Obligatoire (au moins 32 caractères) seulement si `IAP_ENABLED=true`. C'est un secret que **nous** choisissons : l'API compare l'en-tête `Authorization: Bearer <secret>` reçu sur `POST /webhooks/revenuecat` et répond 401 sinon (`docs/PAYMENTS.md`).

1. Générer une valeur : `openssl rand -hex 32`.
2. Render → *Environment* → `REVENUECAT_WEBHOOK_SECRET` → nouvelle valeur → enregistrer, attendre la fin du redéploiement.
3. RevenueCat → *Integrations* → *Webhooks* → en-tête d'autorisation : `Bearer <nouveau secret>`.
4. Entre les étapes 2 et 3, les envois de RevenueCat sont refusés (401) : enchaîner les deux sans attendre. Envoyer ensuite un événement de test (réponse attendue : 200, `outcome: ignored_type`) et vérifier dans RevenueCat qu'aucun envoi n'est resté en échec.

### 4.3 Mot de passe de la base (Neon)

Après changement du mot de passe du rôle dans la console Neon, mettre à jour **les deux** chaînes de connexion :

- `DATABASE_URL` (URL pooled) dans Render → *Environment* ;
- `NEON_DATABASE_URL_DIRECT` (URL directe) dans les secrets GitHub.

Puis vérifier `/health/ready` et relancer *Database Backup* à la main.

### 4.4 Clés de sauvegarde

Voir §3.5.

### 4.5 Clés Web Push (VAPID)

1. Générer une nouvelle paire : `cd backend && npm run vapid:generate`.
2. Render → *Environment* : remplacer `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (et `VAPID_SUBJECT` si besoin), puis enregistrer (redéploiement).
3. Rien à changer côté Netlify : le navigateur lit la clé publique via `GET /notifications/vapid-public-key`.
4. Conséquence : les abonnements push existants deviennent invalides. Les envois vers ces abonnements échouent (404/410) et l'API les purge ; chaque utilisateur doit réactiver les notifications dans *Paramètres → Notifications*.

---

## 5. Opérateurs (rôle `OPERATOR`)

Le rôle est stocké en base (`User.role`, valeurs `USER` et `OPERATOR`). La variable `OPERATOR_EMAILS` est obsolète et n'accorde plus aucun droit. Aucun compte n'est opérateur par défaut ; le compte doit déjà exister (inscription préalable).

### 5.1 Promouvoir, rétrograder, lister

Depuis un poste de développement (l'image Render ne contient ni `ts-node` ni `scripts/`, donc pas depuis Render) :

```bash
cd backend
npm ci
export DATABASE_URL='<URL Neon directe>'

npm run operator:set -- --list                  # opérateurs actuels
npm run operator:set -- <email>                 # promouvoir en OPERATOR
npm run operator:set -- <email> --revoke        # rétrograder en USER
```

Le script (`backend/scripts/set-operator.ts`) normalise l'adresse (espaces retirés, minuscules) et **refuse de promouvoir un compte dont l'adresse e-mail n'est pas vérifiée** (W2-04) : l'intéressé doit d'abord cliquer sur le lien de vérification (renvoyable depuis le bandeau de vérification affiché aux utilisateurs connectés). Le rôle est relu en base à chaque requête authentifiée : l'effet est immédiat. Il n'existe pas de script `operator:remove` : la révocation passe par `--revoke`.

### 5.2 Révoquer par SQL (alternative)

Les adresses sont stockées en minuscules :

```sql
UPDATE "User" SET role = 'USER' WHERE email = lower('<email>');
```

### 5.3 Fermer les sessions d'un compte

L'utilisateur peut le faire lui-même (*Paramètres → Compte → Se déconnecter de tous les appareils*). En urgence, par SQL, il faut **à la fois** incrémenter `tokenVersion` (invalide les access tokens déjà émis, durée de vie 30 min) **et** révoquer les refresh tokens (sinon l'appareil obtiendrait un nouvel access token) :

```sql
BEGIN;
UPDATE "User" SET "tokenVersion" = "tokenVersion" + 1 WHERE email = lower('<email>');
UPDATE "RefreshToken" SET "revokedAt" = now()
 WHERE "revokedAt" IS NULL AND "userId" = (SELECT id FROM "User" WHERE email = lower('<email>'));
COMMIT;
```

---

## 6. Maintenance

### 6.1 Test de restauration

Voir §3.4.

### 6.2 Contrôle des sauvegardes

*Actions* → *Database Backup* : la dernière exécution doit être verte **et** avoir produit un artefact `database-backup-<run_id>`. Une exécution verte sans artefact signifie qu'un secret manque (§3.1).

### 6.3 Versions et changelogs (release-please)

- Le workflow `Release` (`.github/workflows/release.yml`) s'exécute à chaque push sur `main`. En mode manifeste (`release-please-config.json` et `.release-please-manifest.json`), il ouvre et met à jour une PR de release pour les paquets `backend` (version actuelle 0.0.1) et `frontend` (0.1.0). Les changelogs sont générés dans `backend/CHANGELOG.md` et `frontend/CHANGELOG.md`.
- **Réglage de dépôt obligatoire** : *Settings* → *Actions* → *General* → **Allow GitHub Actions to create and approve pull requests**. Sans lui, le workflow échoue à la création de la PR.
- release-please ne tient compte que des messages de commit au format Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, …). Les autres messages (par exemple `W5-02: …`) sont ignorés : sans commit conforme depuis la base, aucune PR n'est ouverte.
- Fusionner la PR de release crée le tag Git et la release GitHub et met à jour les `package.json`. Comme tout push sur `main`, cela déclenche la CI puis le déploiement.
- Limite générale de GitHub : une PR créée avec le `GITHUB_TOKEN` ne déclenche pas d'autres workflows, donc la CI ne se lance pas d'elle-même sur la PR de release.

### 6.4 Comptes inactifs

Aucune purge automatique des comptes inactifs n'existe dans le code. Une durée de conservation reste à décider (et à inscrire dans la politique de confidentialité). La suppression de compte est une action de l'utilisateur dans l'application.

---

## 7. Qui contacter

Pas de délai de réponse garanti connu pour les offres gratuites : voir les conditions de chaque fournisseur.

- Render (API) : <https://render.com/docs> — support accessible depuis le Dashboard.
- Neon (base de données) : <https://neon.tech/docs>
- Netlify (site) : <https://docs.netlify.com>
- Compromission d'un secret : rotation immédiate (§4), puis revue des journaux.
- Fuite possible de données personnelles : prévenir le propriétaire du projet, qui évalue les obligations légales.

---

## 8. Listes de contrôle

### Avant un déploiement

- [ ] CI verte sur la PR (`test-backend`, `build-frontend`, `docker-build`, `quality` dans `.github/workflows/ci.yml`)
- [ ] Aucun secret dans le code
- [ ] Migration compatible avec la version précédente de l'API (expand / contract, `docs/DEPLOY.md` §7)
- [ ] Variables d'environnement nouvelles ajoutées dans Render ou Netlify

### Après un déploiement

- [ ] Job `migrate-production` vert dans l'exécution CI de `main`
- [ ] `GET /health` répond 200 (champ `version` = SHA attendu)
- [ ] `GET /health/ready` répond 200
- [ ] Pas de nouvelle erreur dans Sentry
- [ ] Parcours critiques : inscription ou connexion, recherche d'espèce, ajout d'un animal

### Après un changement de secret

- [ ] Valeur mise à jour à tous les endroits concernés (§4)
- [ ] Service redéployé
- [ ] `/health/ready` vérifié
- [ ] Journaux vérifiés (erreurs d'authentification inattendues)

---

## Annexe : variables d'environnement

Aucune valeur secrète n'est notée ici. Sources : `render.yaml`, `netlify.toml` et le schéma Joi (`backend/src/config/env.validation.ts`).

### API (Render, `render.yaml`)

| Variable | Valeur ou origine | Remarque |
|---|---|---|
| `NODE_ENV` | `production` | Active les règles strictes du schéma Joi |
| `HOST` | `0.0.0.0` | |
| `DATABASE_URL` | à saisir dans le Dashboard (`sync: false`) | URL Neon **pooled** (`-pooler`, `sslmode=require&pgbouncer=true&connect_timeout=15`) ; obligatoire |
| `JWT_SECRET` | généré par Render (`generateValue: true`) | ≥ 32 caractères, valeurs d'exemple refusées |
| `CORS_ORIGIN` | `https://captivia-app.netlify.app` | Obligatoire en production |
| `FRONTEND_URL` | `https://captivia-app.netlify.app` | Obligatoire en production, https |
| `PUBLIC_WEB_URL` | `https://captivia-app.netlify.app` | Facultative, URL valide |
| `TRUST_PROXY` | `true` | |
| `CACHE_TYPE` | `memory` | `memory`, `redis` ou `memcached` |
| `REDIS_ENABLED` | `false` | |
| `LOG_LEVEL` | `info` | |
| `SENTRY_DSN` | Dashboard (`sync: false`) | Facultative |
| `SENTRY_TRACES_SAMPLE_RATE` | Dashboard (`sync: false`) | Facultative, 0,1 par défaut |
| `IAP_ENABLED` | Dashboard (`sync: false`) | `true` rend `REVENUECAT_WEBHOOK_SECRET` obligatoire |
| `REVENUECAT_WEBHOOK_SECRET` | Dashboard (`sync: false`) | ≥ 32 caractères si `IAP_ENABLED=true` |
| `REVENUECAT_ENTITLEMENT_ID` | Dashboard (`sync: false`) | Défaut `premium` |
| `GOOGLE_PLAY_PACKAGE_NAME` | Dashboard (`sync: false`) | Lien « Gérer mon abonnement » Google Play |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | Dashboard (`sync: false`) | SMTP ; sans `MAIL_HOST`, aucun e-mail n'est envoyé |
| `REMINDERS_ENABLED` | Dashboard (`sync: false`) | `false` désactive le scheduler de rappels |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Dashboard (`sync: false`) | Web Push ; sans elles, l'envoi push est désactivé (journalisé) |

Variables du schéma Joi absentes de `render.yaml` : `PORT` (défaut 3001), `REDIS_HOST` (défaut `localhost`), `REDIS_PORT` (défaut 6379).

### Frontend (Netlify)

| Variable | Origine | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `netlify.toml` (`https://captivia-app.netlify.app`) | |
| `NODE_VERSION`, `NEXT_TELEMETRY_DISABLED` | `netlify.toml` | |
| `NEXT_PUBLIC_API_URL` | Netlify → *Site configuration* → *Environment variables* | URL de l'API Render ; lue au build |
| `NEXT_PUBLIC_SENTRY_DSN` | Netlify → *Environment variables* | Facultative ; lue au build |

### GitHub (Actions)

| Nom | Type | Usage |
|---|---|---|
| `NEON_DATABASE_URL_DIRECT` | Secret | URL Neon directe : migrations, seed, sauvegarde |
| `BACKUP_AGE_RECIPIENT` | Secret | Clé publique age (`age1…`) : chiffrement des sauvegardes |
| `API_URL` | Variable | `keep-warm.yml` (déclenchement manuel) |

---

*Mis à jour : 2026-10-02*
