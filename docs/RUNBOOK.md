# Captivia — Runbook de production

Ce document décrit les procédures opérationnelles pour maintenir Captivia en production.

---

## 1. Supervision

### 1.1 Monitoring de la disponibilité

**UptimeRobot** (ou Better Stack gratuit) sur :
- **Endpoint API** : `https://api.captivia.<tld>/health/ready`
- **Home page** : `https://captivia.<tld>/`

**Configuration recommandée** :
- Fréquence : 5 minutes
- Timeout : 30 secondes
- Alertes : e-mail immédiat en cas d'indisponibilité persistante

### 1.2 Alertes d'erreurs

**Sentry** (URL UE) collecte les exceptions backend et frontend.

- Accès : Projects → Captivia
- Filtres recommandés : issues non résolues, statut `Unresolved`
- Alertes e-mail par la GUI Sentry

### 1.3 Supervision des quotas

**Render** : vérifier le quota horaire (gratuit : 750 h/mois, ≈ 22,5 h/jour en moyenne).
- Tableau de bord Render → Billing
- Alerte manuelle : quotas atteints → passer à Starter

**Neon** : vérifier les heures de calcul et le stockage.
- Tableau de bord Neon → Usage
- Mise en veille après 5 min d'inactivité (réveil ≈ 1 s)

### 1.4 Health checks manuels

```bash
# Vérifier l'API
curl -sS https://api.captivia.<tld>/health/ready | jq .

# Vérifier la base de données (depuis le serveur API)
curl -sS https://api.captivia.<tld>/health/live | jq .

# Vérifier la couverture Sentry
curl -sS https://captivia.<tld>/ | grep -i "sentry\|__sentry__"
```

---

## 2. Incidents courants

### 2.1 API indisponible

**Symptômes** : `/health/ready` → 503 ou timeout.

**Diagnostic** :

```bash
# Vérifier les logs Render
# → Render Dashboard → captivia-api → Logs

# Vérifier l'état de la base de données
# → Neon Dashboard → Connexions actives, requêtes lentes

# Vérifier les variables d'environnement
# → Render → Environment → tous les secrets présents ?
```

**Actions** :

1. **Redémarrage** : Render Dashboard → Manual Deploy (redéploie le dernier commit OK)
2. **Si persiste** : basculer sur un commit antérieur (voir § 2.4 Rollback)
3. **Base de données** : si Neon ne répond pas, contacter le support (gratuit : SLA 24 h)

### 2.2 Base de données lente ou inaccessible

**Symptômes** : requêtes timeout (5 s), erreurs 500 dans Sentry.

**Diagnostic** :

```bash
# Vérifier les connexions actives
# → Neon Dashboard → Monitoring → Active connections

# Vérifier les requêtes lentes
# → Neon Dashboard → Slow queries
```

**Actions** :

1. **Terminer les connexions idle** :
   ```bash
   psql "$NEON_DATABASE_URL_DIRECT" -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
      WHERE state = 'idle' AND query_start < now() - interval '5 minutes';"
   ```

2. **Redémarrer le compute** : Neon Dashboard → Computes → Restart

3. **Vérifier les migrations bloquées** : `SELECT * FROM pg_locks;`

### 2.3 Erreurs fréquentes en frontend

**Symptômes** : page blanche, console JS pleine d'erreurs.

**Diagnostic** :

```bash
# Vérifier les builds Netlify
# → Netlify Dashboard → Deploys

# Vérifier les erreurs Sentry
# → Sentry → Issues (filtre: frontend, dernières 24 h)
```

**Actions** :

1. Redéployer depuis un PR : `Netlify → Deploys → Trigger deploy`
2. Si écran blanc persiste : invalider le cache CDN (Netlify → Site settings → Clear cache)

### 2.4 Rollback Render

```bash
# 1. Identifier le commit précédent qui fonctionnait
git log --oneline -10 | head -5

# 2. Forcer Render à redéployer cet ancrage
# → Render Dashboard → Environment → Git Branch/Commit
#   (remplacer le SHA actuel par le SHA précédent et sauvegarder)

# 3. Attendre le redéploiement (vérifier les logs)

# 4. Vérifier /health/ready
curl -sS https://api.captivia.<tld>/health/ready

# 5. Une fois stable, faire un commit de correction et re-pusher le main
git revert <commit-cassé>
git push origin main
```

### 2.5 Rollback Netlify

```bash
# 1. Netlify Dashboard → Deploys → Sitemap des anciens déploiements
# 2. Cliquer sur un déploiement antérieur stable
# 3. Publier (Publish deploy)
# 4. Attendre ≈ 30 secondes pour la propagation CDN
```

---

## 3. Restauration de sauvegarde

### 3.1 Vérifier les sauvegardes disponibles

```bash
# Sauvegardes dans GitHub Actions artifacts (30 j)
# → GitHub → Actions → Database Backup → (dernière exécution) → download

# Ou restaurer localement depuis un artefact téléchargé :
ls -lh backups/captivia-*.dump.age
```

### 3.2 Restauration pas à pas

**⚠️ DESTRUCTIF : écrase la base de production.**

1. **Déployer un redéploiement sans migration** (éviter de déployer un nouveau schéma pendant la restauration) :
   ```bash
   git tag -a skip-migrate-<date> -m "No migration during restore"
   git push origin skip-migrate-<date>
   # Ou contacter un opérateur pour déployer manuellement sans migrate job
   ```

2. **Déchiffrer la sauvegarde** (age nécessaire) :
   ```bash
   age --decrypt -i ~/.age/key.txt backups/captivia-YYYYMMDD-HHMMSS.dump.age \
     > /tmp/captivia-restore.dump
   ```

3. **Restaurer vers la base** (via `DATABASE_URL` Neon direct) :
   ```bash
   export DATABASE_URL="<NEON_DATABASE_URL_DIRECT>"
   ./scripts/restore-db.sh /tmp/captivia-restore.dump
   # → Taper 'oui' pour confirmer
   ```

4. **Vérifier l'intégrité** :
   ```bash
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"SpeciesProfile\";"
   ```

5. **Redéployer avec les migrations** :
   ```bash
   git push origin main  # Redéploiement automatique via CI
   ```

6. **Vérifier /health/ready** :
   ```bash
   curl -sS https://api.captivia.<tld>/health/ready | jq .
   ```

---

## 4. Rotation des secrets

### 4.1 Rotation du JWT_SECRET

**Fréquence recommandée** : trimestrielle ou après suspicion de compromission.

1. **Générer un nouveau secret** (≥ 32 caractères, aléatoire) :
   ```bash
   openssl rand -base64 32
   ```

2. **Mettre à jour dans Render** :
   - Render Dashboard → Environment → `JWT_SECRET` (remplacer la valeur)
   - Sauvegarder
   - Redéploiement automatique

3. **Conséquence** : tous les tokens JWT actifs deviennent invalides.
   - Les utilisateurs doivent se reconnecter.
   - Sessions web fermées après le redéploiement.

### 4.2 Rotation du REVENUECAT_WEBHOOK_SECRET

**Fréquence recommandée** : annuelle ou après incident de sécurité.

1. **Générer un nouveau secret dans RevenueCat** :
   - RevenueCat Dashboard → Project Settings → Webhooks → Regenerate Secret

2. **Mettre à jour dans Render** :
   - Render Dashboard → Environment → `REVENUECAT_WEBHOOK_SECRET` (nouvelle valeur)
   - Sauvegarder

3. **Conséquence** : les webhooks utilisant l'ancien secret sont rejetés (status 401).
   - Verifier dans Sentry si des erreurs de webhooks apparaissent.

### 4.3 Rotation de VAPID (Web Push)

**Fréquence recommandée** : annuelle.

1. **Générer une nouvelle paire VAPID** :
   ```bash
   npm install -g web-push
   web-push generate-vapid-keys
   ```

2. **Mettre à jour en deux endroits** :
   - **Render** (backend) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - **Netlify** (frontend) : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

3. **Conséquence** : tous les abonnements push en base deviennent invalides.
   - Les navigateurs qui se reconnectent au push créent de nouveaux abonnements.

### 4.4 Clés Stripe et RevenueCat

**Fréquence recommandée** : annuelle.

1. Stripe Dashboard → Developers → API Keys → Rotate
2. RevenueCat Dashboard → App Settings → API Keys → Rotate
3. Mettre à jour dans Render (secrets).

---

## 5. Promotion d'un opérateur

Après migration `20261002100000_auth_roles_sessions`, **aucun compte n'est opérateur par défaut**.

### 5.1 Promouvoir un utilisateur en opérateur

```bash
# Depuis un poste avec accès au code et aux secrets

# 1. Exporter la variable de base de données directe (Neon)
export DATABASE_URL="<NEON_DATABASE_URL_DIRECT>"

# 2. Exécuter le script CLI (depuis le répertoire backend)
cd backend
npm run operator:set -- <email@example.com>

# Exemple :
# npm run operator:set -- admin@captivia.local

# 3. Vérifier
psql "$DATABASE_URL" -c 'SELECT email, role FROM "User" WHERE role = '\''OPERATOR'\'';'
```

### 5.2 Révoquer un opérateur

```bash
# Depuis le backend
export DATABASE_URL="<NEON_DATABASE_URL_DIRECT>"
cd backend

# Utiliser le script operator:remove (à implémenter si absent)
npm run operator:remove -- <email@example.com>

# Ou SQL direct
psql "$DATABASE_URL" \
  -c "UPDATE \"User\" SET role = 'USER' WHERE email = '<email@example.com>';"
```

---

## 6. Maintenance et tâches planifiées

### 6.1 Nettoyage des logs

```bash
# Sentry
# → Sentry Dashboard → Projects → Settings → Data Retention
# Configurer à 90 jours minimum

# Render
# → Render Dashboard → Logs → les historiques restent 14 jours par défaut
```

### 6.2 Audit des sauvegardes

```bash
# Vérifier que les backups s'exécutent régulièrement
# GitHub → Actions → Database Backup → lister les 4-5 dernières exécutions

# Tester une restauration sur un environnement de test (trimestriel)
# 1. Télécharger un dump chiffré
# 2. Déchiffrer
# 3. Restaurer sur une BD de test Neon
# 4. Vérifier l'intégrité
```

### 6.3 Gestion des utilisateurs inactifs

**Job automatique** (si activé) : purge des comptes inactifs > 36 mois.

```bash
# Vérifier l'exécution
psql "$DATABASE_URL" -c \
  "SELECT email, updated_at FROM \"User\" 
   WHERE updated_at < now() - interval '36 months';"
```

---

## 7. Escalade et contacts

| Situation | Contact | Délai |
|---|---|---|
| Erreur applicative (500 en Sentry) | On-call dev (ou Slack #incidents) | ≤ 1 h |
| API indisponible (timeout) | Render support + on-call | ≤ 30 min |
| Base de données inaccessible | Neon support (gratuit : 24 h) | ≤ 4 h |
| Compromission de secret | Révolution immédiate + audit | ≤ 15 min |
| DPA/légal | Juriste du projet | — |

---

## 8. Checklisttes de changement

### Avant tout déploiement

- [ ] Tests backend verts (`npm test`)
- [ ] Tests frontend verts (`npm test` + `npm run build`)
- [ ] Pas de secrets en dur dans le code
- [ ] Migration idempotente et expand/contract
- [ ] Sentry release tag mis à jour
- [ ] CHANGELOG.md mis à jour

### Après déploiement

- [ ] `/health/ready` répond 200
- [ ] `/health/live` répond 200
- [ ] Pas d'erreurs nouvelles dans Sentry
- [ ] UptimeRobot monitor OK
- [ ] Fonctionnalités critiques testées (login, ajout animal, rappel)

### Après changement de secret

- [ ] Valeur mise à jour en tous les emplacements
- [ ] Service redéployé
- [ ] Moniteurs de santé vérifiés
- [ ] Logs vérifiés pour déterminer les erreurs d'authentification

---

## Annexe : Variables d'environnement de production

```env
# Obligatoire
NODE_ENV=production
JWT_SECRET=<≥32 caractères aléatoires>
CORS_ORIGIN=https://captivia.<tld>
FRONTEND_URL=https://captivia.<tld>
PUBLIC_WEB_URL=https://captivia.<tld>
TRUST_PROXY=true
HOST=0.0.0.0
DATABASE_URL=<Neon pooled + pgbouncer>

# Email (Brevo)
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USER=<user@brevo>
MAIL_PASS=<clé SMTP Brevo>
MAIL_FROM=noreply@captivia.<tld>

# Observabilité
SENTRY_DSN=<URL projet Sentry UE>
SENTRY_TRACES_SAMPLE_RATE=0.1
LOG_FORMAT=json

# Web Push (optionnel, dès W3-03)
VAPID_PUBLIC_KEY=<clé publique>
VAPID_PRIVATE_KEY=<clé privée>
VAPID_SUBJECT=mailto:admin@captivia.<tld>

# Paiement (optionnel, dès W3-04)
STRIPE_SECRET_KEY=<clé secrète Stripe>
STRIPE_WEBHOOK_SECRET=<secret webhook Stripe>

# RevenueCat (optionnel, dès W6-08)
REVENUECAT_API_KEY=<clé API RevenueCat>
REVENUECAT_WEBHOOK_SECRET=<secret webhook RevenueCat>
```

---

*Mis à jour : 2026-10-02*
*Prochaine révision : après déploiement de production*
