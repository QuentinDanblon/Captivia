# Captivia — Plan de mise en production « 10/10 » (web · Android · iOS)

> Établi le 2026-10-02 sur `claude/zen-mendel-xq6nkb` (HEAD `a850f15` + pipeline de déploiement). Avancement à jour ci-dessous (HEAD `d27ca0c`).
> Source : 6 audits parallèles réalisés le même jour (sécurité, backend/données, frontend, mobile, infra/légal, hygiène), qui **remplacent** `AUDIT-2026-08-09.md` et `RAPPORT-FINAL-2026-08-09.md`. Ces deux rapports affirmaient « 0 vulnérabilité » et « production ready » : c'est faux aujourd'hui (voir §2).

---

## 0. Résumé exécutif

**Verdict : l'application n'est pas prête pour la production.** Le socle est sain : architecture modulaire, BOLA correctement géré, migrations sans drift, 421/422 tests backend et 30/30 frontend, build OK. En revanche :

1. **Une faille critique** permet à n'importe qui de devenir opérateur (admin), via une variante de casse de l'e-mail opérateur.
2. **Le site déployé ne fonctionnerait pas** : le frontend appelle `http://<hôte>:3001` en dur.
3. **Le cœur de valeur est simulé** : aucun scheduler de rappels, push en `console.log`, aucun e-mail de rappel, paiement en 501.
4. **La conformité légale est absente** : pas de suppression ou d'export de compte, pas de pages légales.
5. **Il n'existe aucune application mobile** : pas de Capacitor, d'Expo, ni de manifest PWA.

| Domaine | Note actuelle (estimation) | Cible |
|---|---|---|
| Sécurité | 4/10 | 10 |
| Backend (fiabilité, fonctionnalités réelles) | 5/10 | 10 |
| Frontend web (UX, i18n, a11y, SEO) | 5/10 | 10 |
| Mobile (Android/iOS) | 0/10 | 10 |
| Infra / déploiement / observabilité | 3/10 | 10 |
| Légal / RGPD | 1/10 | 10 |
| Contenu éditorial | 4/10 (51/296 fiches complètes) | 10 |
| Tests / CI | 5/10 | 10 |

**Deux jalons :**
- **Jalon 1 : Web public v1.0.** Vagues 0 à 5 et 7. Environ 30 à 40 j-h, soit 2 à 3 semaines calendaires avec des agents en parallèle.
- **Jalon 2 : Stores v1.1 (Android + iOS).** Vague 6. Environ 4 à 6 semaines de développement, plus 2 semaines de tests et relecture des stores. Les comptes développeurs (délais administratifs) sont à lancer **dès J1**.

---

## Avancement — vague « produit et design » (nuit du 2-3 octobre 2026, agents par paires)

**Fusionné sur `claude/zen-mendel-xq6nkb`** (PR #1 mergée dans `main` ; la suite est sur la PR #16, CI GitHub bloquée par le quota Actions du dépôt privé, toutes les vérifications faites localement) :
- Backend : **1 093/1 093 tests**, migrations + seed + `migrate diff` OK, `npm audit` 0.
- Frontend : **480/480 tests jest**, ESLint 0 erreur / 0 avertissement, builds web + mobile OK, **E2E smoke 172/172** sans retry, axe bloquant (0 violation sérieuse), garde-fou CI des motifs de style interdits.

| Tâche | Livré |
|---|---|
| Revues Opus | Revue backend (12 constats, dont une course refresh/révocation : 0 session survivante après correctif) et frontend (15 constats) : tous corrigés. |
| Produit | `docs/PRODUCT.md` (vision, offre, D-16 validée, règle d'écriture), `docs/MESSAGING.md`. |
| Mode invité ✅ | App sans compte (1 animal, carnet complet), conversion en compte sans perte, purge 90 j. |
| Refonte design ✅ | Direction « carnet de terrain », `frontend/docs/DESIGN.md`, AppShell (onglets mobile / barre latérale PC), tableau de bord « Aujourd'hui », fiches, outils, landing en entonnoir avec 15 photos Commons créditées, passe de finition globale. |
| W1-04 ✅ | Client HTTP unique, retry/jitter, disjoncteur, replis locaux. |
| W1-09 ✅ | CHECK, 7 FK, index trigram (migration testée sur base « sale »). |
| W2-08 ✅ | Purge quotidienne, `docs/legal/registre-traitements.md`, analytics sans `userId` en query. |
| W3-05 ✅ | Amazon retiré, Species+ (jeton optionnel), PubMed branché. |
| W4-03 ✅ | i18n unifiée (formes d'adresse), plus de prix inventés. |
| W4-08 ✅ | CSP sans `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, HSTS ; hachages SHA-256 en export mobile. |
| W5-04 ✅ | `lastReviewedAt` (« Fiche vérifiée le… »). |
| W6-05/06/09 ✅ | Liens externes natifs, caméra, rappels en notifications locales hors ligne, deep links + fichiers `.well-known`. |
| W5-02 | Lots H001-H003 : 307 citations vérifiées ; 1 358 fiches complètes sur 1 510. |

**Restent** : W1-07 (dette lint backend), W6-07 (code livré le 2026-10-03 ; configuration Firebase / Apple et test sur appareil à faire, `docs/MOBILE.md` § 7.3), W6-10 à W6-14 (assets, déclarations, CI mobile, soumission), DEP-02/04/05/09, volet réseau social, textes légaux `[À COMPLÉTER]`, comptes stores, déblocage du quota GitHub Actions.

## Avancement — vague « niveau complet » (soir du 2026-10-02, 9 agents fonctionnels + 17 lots de contenu)

**Fusionné sur `claude/zen-mendel-xq6nkb` et vérifié sur base vierge** (HEAD `d27ca0c`) :
- Backend : migrations + seed OK, `migrate diff` sans drift, `tsc`/build OK, **777/777 tests (56 suites)**, `npm audit` 0 vulnérabilité.
- Frontend : `tsc` OK, ESLint 0 erreur, **167/167 tests jest (17 suites)**, build web OK, `build:mobile` OK, **E2E smoke 94/94 sans retry** (chromium + Mobile Chrome, API mockée), `npm audit` 0.

| Tâche | Livré |
|---|---|
| W1-01 ✅ | Refresh tokens opaques rotatifs (familles, détection de réutilisation), access token 30 min, `logout` / `logout-all`, refresh automatique côté client (`src/lib/session.ts`). |
| W2-04 ✅ | Vérification d'e-mail (jeton haché, renvoi limité), bandeau, page `verifier-email` ; rôle opérateur et lien public réservés aux comptes vérifiés. |
| W3-03 ✅ | Web Push réel (VAPID, `web-push`, purge 404/410, clé publique servie par l'API, `sw.js`). |
| W4-05 ✅ | Modales `ui/Modal` (Radix) : focus, Échap, retour du focus ; contrastes `--captivia-muted` ≥ 4,5:1. |
| W4-07 ✅ | Page animal découpée (4 699 → 719 lignes, sections chargées à la demande, −16 % de JS initial), compression des photos. |
| W4-09 ✅ | E2E Playwright déterministes (API mockée, axe), job smoke bloquant en CI ; correctif du retour EN → FR du sélecteur de langue. |
| W6-02/03/04 ✅ (socle) | Export statique `build:mobile`, Capacitor 7, routes à query, stockage des jetons via Preferences, `openExternal`, workflow `mobile.yml` (manuel). Projets natifs non générés (`cap add` à faire). |
| Nouveau ✅ | **Agenda des soins** multi-animaux + abonnement calendrier **ICS** par jeton révocable. **Carnet de santé imprimable** (web) / accessible dans l'app. |
| DEP-03 ✅ | Sauvegarde hebdomadaire chiffrée (`age`, pg_dump 17, artefact 30 j), scripts de sauvegarde/restauration, `docs/RUNBOOK.md`. |
| DEP-07 ✅ | release-please (manifeste backend/frontend). |
| W1-04 ✅ | Client HTTP sortant unique (`backend/src/external/http/`) : timeout 5 s, 3 redirections max (https, hôtes publics, secrets retirés), réponse ≤ 5 Mo, User-Agent explicite ; GBIF 3 tentatives (réseau/5xx/429, backoff + jitter, budget 7,5 s) ; **disjoncteur par fournisseur** (implémentation interne, sans cockatiel) avec repli sur les `SpeciesProfile` / le cache périmé (`CacheService.getStale`, 7 j) ; aucun 500 sur une recherche, aucun échec mis en cache ; DTO `barcode ^\d{8,14}$`, `qid`, longueurs ; `/gateway/health` corrigé (statut `degraded`). e2e déterministes : transport HTTP simulé (`test/utils/fake-external-adapter.ts`). |
| W3-05 ✅ | Amazon : **retiré** (route `/amazon/*` → 404, `AmazonPAService` supprimé ; la PA-API 5 est remplacée par la Creators API, D-09). Species+ : intégration réelle, **désactivée sans `SPECIESPLUS_API_TOKEN`** (503 `INTEGRATION_DISABLED`, `speciesPlus.status`). PubMed : intégration réelle (clé `NCBI_API_KEY` optionnelle), références branchées sur la fiche santé. Variables documentées (`.env.example`, Joi, `render.yaml`, `docs/DEPLOY.md`). |
| W5-02 ✅ | Lots G (Sonnet) avec preuve par citation, **672 citations contrôlées mécaniquement** contre les pages sources (`enrichment/check_quotes.py`) ; base : 1 340 fiches complètes sur 1 510. Lots H (120 fiches) préparés. |

**Restent ouverts** : W1-07 (lint backend), W1-09, W2-02 (textes légaux `[À COMPLÉTER]` + juriste), W2-08, W4-03, W4-08, W5-03, W5-04, W6-05 à W6-14, DEP-02, DEP-04 à DEP-06, DEP-09/10 ; relecture humaine législation/santé ; mise en ligne sur les nouveaux comptes Neon/Render/Netlify.

## Avancement — sprint du 2026-10-02 (3 vagues, 20 agents + 1 revue Opus, tout fusionné sur `claude/zen-mendel-xq6nkb`)

**Vérifications d'intégration finales** (toutes les branches fusionnées, PostgreSQL vierge) :
- `prisma migrate deploy` : 10 migrations OK, `migrate diff` : aucun drift ; seed de production idempotent → **1 595 profils** (299 espèces + 1 296 races), 0 magasin factice.
- Backend : `tsc` et build OK, **699/699 tests (48 suites)**.
- Frontend : `tsc` OK, **ESLint 0 erreur**, **87/87 tests (9 suites)** dont parité i18n, build de production OK.
- `npm audit --omit=dev` : **0 vulnérabilité** (racine, backend, frontend). `docker compose config` et workflows YAML valides.
- Revue de code Opus (effort élevé) sur le diff cumulé : 11 constats, **tous corrigés** (migration CI après tous les checks, anti-antidatage des points, token après changement de mot de passe, scrub Sentry du token de reset, export RGPD complet, statut premium opérateur, chemins `breeding`, dédup de migration sans perte, ping hors GitHub Actions car dépôt privé).

| Statut | Tâches |
|---|---|
| ✅ Fait | **V0** : W0-01, W0-02, W0-03, W0-05, W0-06, W0-07, W0-08 · **V1** : W1-03 (pino JSON expurgé, request-id, Sentry `instrument.ts` + release, `/health/ready`, version), W1-05, W1-06, W1-08 · **V2** : W2-01, W2-03, W2-05, W2-06, W2-07 · **V3** : W3-01 (MailService fr/en), W3-02 (cron 5 min, verrou transactionnel, `notifiedAt`, `User.timezone`) · **V4** : W4-01, W4-02, W4-04, W4-06 · **V5** : W5-01 · **V7** : DEP-01, DEP-08 · **WH** : 01, 02, 03, 04, 05 |
| 🟡 Partiel | W0-04 (rendre `MAIL_HOST` obligatoire en prod dès le choix du prestataire), W1-01 (`tokenVersion` sans refresh token), W1-02 (`login`/`register` hors `request()`), W1-04 (circuit breaker, retry GBIF), W1-07 (backend : ~2 000 erreurs de lint historiques, job non bloquant), W2-02 (pages FR/EN rédigées — **marqueurs `[À COMPLÉTER]` dans `frontend/src/lib/legal.ts`** + relecture juriste), W4-03 (restes mineurs listés dans le commit), W4-05 (modales manuelles à migrer vers Radix, contrastes `--captivia-muted`) |
| ⏳ À faire | W1-09, W2-04 (vérification d'e-mail), W2-08, W3-03 (Web Push : brancher `PushSender`), W3-04 (Stripe — ou laisser l'offre masquée, D-04), W3-05, W4-07, W4-08, W4-09, W5-02 à W5-04, **Vague 6 (mobile)**, DEP-02 à DEP-07, DEP-09/10, WH-06, WH-07 |

**Enrichissement de la base (W5-02, soirée du 2026-10-02)** : ~70 agents Haiku ont rédigé les sections manquantes de 216 espèces et les descriptions de 376 races (`backend/prisma/enrichment/`). **Contre-vérification obligatoire par des agents Sonnet** (VERIFY.md) : chaque lot est relu contre les sources (WebFetch), les erreurs corrigées, les faits non confirmés supprimés. Les vérificateurs ont trouvé de nombreuses hallucinations (statuts légaux et annexes UE inventés, espèces protégées ou envahissantes présentées comme « sans restriction », chiffres de reproduction faux, maladies inexistantes, sources génériques) — tout cela est corrigé ou retiré. **Garde-fous** : seuls les lots ayant un rapport `verify/<LOT>.json` sont importés ; sources https obligatoires ; 8 liens morts écartés ; législation marquée `needsReview: true`. 85 entrées non animales (outils, objets, Q-ids Wikidata) du catalogue de races sont exclues. **À faire** : relecture humaine (vétérinaire / juriste) des sections législation et santé avant mise en avant, et compléter les sections remises à `null`.

**Points d'attention relevés pendant le sprint (à traiter) :**
- `grade.service` : heures des événements posées en UTC sans fuseau, et `every_2_days`/`every_3_days` encore calculés sur la parité epoch (lié à W3-02).
- Listes API bornées à 100 éléments par défaut (W1-05) : le frontend ne pagine pas encore → au-delà de 100 animaux/entrées, prévoir la pagination UI.
- `SpeciesProfile.sourceUrl` pointe vers Wikidata (CC0) : le bloc d'attribution Wikipédia ne s'affiche que pour une URL wikipedia.org ; vérifier l'origine réelle des extraits (W2-06).
- Logo et icônes **provisoires** (`frontend/public/brand/`, décision D-15) ; pas encore d'image OpenGraph.

**Changements de contrat à connaître avant le premier déploiement :**
- Après la migration `20261002100000_auth_roles_sessions`, **aucun compte n'est opérateur** : `cd backend && DATABASE_URL=<URL Neon directe> npm run operator:set -- <email>` (depuis un poste de dev ; l'image runtime n'a pas les scripts).
- `/auth/register` exige `acceptTerms: true` et `ageConfirmed: true` ; mots de passe de 10 à 128 caractères ; `change-password` renvoie un nouvel `accessToken`.
- En production, l'API **refuse de démarrer** sans `JWT_SECRET` (≥ 32 caractères, non-exemple), `CORS_ORIGIN` et `FRONTEND_URL` (https). Variables nouvelles : `PUBLIC_WEB_URL`, `MAIL_*`, `REMINDERS_ENABLED`, `SENTRY_TRACES_SAMPLE_RATE` (backend) ; `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SENTRY_DSN` (frontend). Voir `docs/DEPLOY.md`.
- Le lien public d'un animal est en opt-in (les liens existants restent actifs, sans données de santé).
- Maintien en éveil de l'API Render : monitor **UptimeRobot** (le dépôt étant privé, pas de cron GitHub Actions).

## 1. Conventions d'exécution

### 1.1 Priorités et efforts
- **P0** : bloquant pour toute mise en ligne publique.
- **P1** : requis pour le « 10/10 » au lancement.
- **P2** : amélioration post-lancement.
- **Effort** : S < 2 h · M < 1 j · L 1 à 3 j · XL > 1 semaine.

### 1.2 Choix du modèle et de l'effort des agents

| Modèle | Effort | Pour quoi |
|---|---|---|
| **haiku 4.5** | low | Mécanique et déterministe : docs, renommages, suppression de code mort, bumps de config, `prettier --write`, ajout de `.nvmrc`, mentions statiques |
| **sonnet 5.5** | medium | Implémentation standard bien spécifiée : endpoints CRUD, DTO, pages, i18n, a11y, CI, tests |
| **sonnet 5.5** | high | Implémentation délicate : refactor d'un fichier de 4 500 lignes, SEO serveur, scheduler, résilience réseau |
| **opus 5.5** | high | Conception et sécurité : auth/sessions, rôles, paiements (Stripe/IAP), export statique + Capacitor, CSP à nonce, textes juridiques, revue finale de chaque vague |

### 1.3 Règles pour les agents d'exécution
1. **Une tâche = une branche = une PR**, avec la référence de la tâche (ex. `W0-01`) dans le titre.
2. **Toute tâche livre ses tests.** La CI doit être verte (backend `npm test`, frontend `npm test` + `npm run build`, `tsc --noEmit`, lint sur les fichiers touchés).
3. **Verrou Prisma.** Une seule tâche à la fois modifie `backend/prisma/schema.prisma` et crée une migration. Les tâches marquées 🔒 sont sérialisées.
4. **Aucun secret dans le code**, les logs ou les PR. Les secrets passent par Render, Netlify ou GitHub Secrets.
5. **Revue opus high** à la fin de chaque vague, sur le diff cumulé (`/code-review high`).
6. **Pas de régression i18n.** Tout texte UI passe par `messages/*.json`, dans les 6 locales.

### 1.4 Couloirs de parallélisation (propriété des fichiers)

| Couloir | Périmètre exclusif |
|---|---|
| **A** Backend auth & comptes | `backend/src/auth/**`, `common/operators.ts`, `common/guards/operator.guard.ts`, `subscription/**`, futur `users/**` |
| **B** Backend domaine | `animals/**`, `grade/**`, `notifications/**`, `routines/**`, `medications/**`, `vaccinations/**`, `vet-appointments/**` |
| **C** Backend plateforme | `main.ts`, `app.module.ts`, `config/**`, `health/**`, `common/filters|interceptors/**`, `cache/**`, `external/**`, `gateway/**`, `food/**`, `legislation/**`, `health-content/**` |
| **D** Frontend socle | `frontend/src/lib/**`, `contexts/**`, `proxy.ts`, `next.config.ts`, `app/[locale]/layout.tsx`, `instrumentation*.ts` |
| **E** Frontend pages | `frontend/src/app/[locale]/**/page.tsx`, `components/**`, `messages/**` |
| **F** Infra, CI, docs | `.github/**`, `docker-compose*.yml`, `Dockerfile`, `render.yaml`, `netlify.toml`, `scripts/**`, `docs/**`, `README.md` |
| **G** Données | `backend/prisma/seed*.ts`, `*.json` de données, scripts d'import (avec le verrou Prisma si le schéma change) |

---

## 2. État des lieux consolidé (2026-10-02)

### 2.1 Résultats mesurés

| Contrôle | Résultat |
|---|---|
| Backend `prisma migrate deploy` + seed | 7/7 migrations OK. Seed : 296 espèces, 811 modèles de routines, 3 espèces rejetées (`semi-solitaire`) |
| Backend tests | 421/422. Échec instable `performance.e2e` (ECONNRESET), parfois aussi `security.e2e` |
| Backend couverture | 56 % lignes / 30 % branches. Scheduler 12 %, API externes 9 à 18 % |
| Backend ESLint | **2 083 erreurs** (788 prettier, ~1 160 `no-unsafe-*`). Non bloquant en CI (`|| true`) |
| Backend `npm audit --omit=dev` | **10 high + 1 moderate** (axios, nodemailer, multer, joi, prisma, js-yaml…) |
| Frontend build / tsc / jest | OK / 0 erreur / 30/30 (3 fichiers de tests seulement) |
| Frontend ESLint | 76 erreurs, 29 warnings |
| Frontend `npm audit --omit=dev` | **1 critical (next 16.3.0, RCE)** + 4 high |
| Frontend a11y (axe) | `select` sans label (critique), double `<main>`, contrastes |
| `prisma migrate diff` | Aucun drift ✅ |

### 2.2 Ce qui est déjà solide (à conserver)
- Contrôle d'appartenance systématique (`ensureAnimalOwnership`) : aucun BOLA trouvé.
- ValidationPipe global (whitelist + forbidNonWhitelisted). Aucune requête SQL brute.
- Helmet, CORS strict sans credentials, `trust proxy` explicite.
- Rate-limit sur l'auth (10/60 s), réponses 429 + Retry-After.
- Paywall verrouillé (501). Le premium ne s'active que par un opérateur.
- Dockerfiles multi-stage non-root, job `migrate`, arrêt gracieux.
- Seed de production idempotent, sans compte utilisateur.
- 6 locales avec les mêmes clés, aucun débordement horizontal à 390 px.

### 2.3 Écarts majeurs par domaine (détail dans les vagues)
- **Sécurité** : élévation en opérateur (SEC-01), URL d'API HTTP (SEC-02), dépendances vulnérables, DoS via les préférences de notification et farming de points (SEC-04), JWT 7 jours non révocable, page QR qui expose notes et carnet de santé, lien de reset loggé, défauts compose dangereux, `/gateway/search` amplifiable (×200 appels sortants), cache mémoire non borné.
- **Backend** : aucun scheduler, push simulé, pas d'e-mail de rappel, magasins factices `example-*.fr` dans le seed prod, appels externes sans timeout, listes non paginées, erreurs 500 non loggées, `/health` superficiel.
- **Frontend** : app cassée hors localhost, impossible de revenir au français depuis `/en`, aucun SEO (titre unique, ni sitemap ni robots), soft-404 (`/robots.txt` renvoie la home en 200), pas de `error.tsx`/`not-found.tsx`, 66 clés FR dans `en.json` et environ 70 textes en dur, message dev « npm run start:dev » visible des utilisateurs, page `mes-animaux/[id]` monolithique (4 521 lignes), neuf dépendances inutilisées.
- **Mobile** : rien n'existe. `README.md` renvoie vers un `CAPACITOR_SETUP.md` absent, le `sw.js` n'est jamais enregistré, il n'y a ni manifest ni icônes.
- **Infra** : aucune cible d'hébergement ni CD (pipeline ajouté sur cette branche, voir §5), Sentry quasi inactif, `LOG_FORMAT=json` sans effet, sauvegardes locales uniquement.
- **Légal** : ni confidentialité, ni mentions légales, ni CGU/CGV. Pas de suppression ni d'export de compte, alors que la page transparence l'affirme. Attributions Wikipedia (CC BY-SA), GBIF et OPFF absentes. Mention « Partenaire Amazon » absente.

---

## 3. Décisions du propriétaire (à trancher avant ou pendant la vague 0)

| ID | Décision | Recommandation par défaut | Bloque |
|---|---|---|---|
| D-01 | Structure juridique : raison sociale, SIREN, directeur de publication, TVA | — (à fournir) | W2-02 |
| D-02 | Hébergement | **Netlify (front) + Render Free Frankfurt (API) + Neon Free Frankfurt (DB)**. Passer Render en Starter dès que le trafic le justifie (fin de la mise en veille) | §5 |
| D-03 | Nom de domaine | `captivia.<tld>` (front) + `api.captivia.<tld>` | DEP-02 |
| D-04 | Monétisation au lancement web | **Lancer v1.0 sans premium payant** (page abonnement en « bientôt »), puis Stripe en v1.0.x. Évite CGV, rétractation et TVA au J0 | W3-04 |
| D-05 | Prestataire de paiement | Stripe Billing (web) + RevenueCat (stores), ou Paddle / Lemon Squeezy comme *merchant of record* pour la TVA UE | W3-04, W6-08 |
| D-06 | Prestataire e-mail | Brevo (UE, offre gratuite de 300 mails/jour) avec SPF, DKIM et DMARC | W3-01 |
| D-07 | Âge minimum | 15 ans (consentement numérique en France) | W2-03 |
| D-08 | Partage public des animaux (QR) | Garder, en **opt-in** avec champs choisis et lien révocable | W0-06 |
| D-09 | Affiliation | Amazon.fr seul au lancement. Vérifier la migration PA-API 5 vers Creators API | W2-05, W3-05 |
| D-10 | Textes Wikipédia | Garder avec attribution CC BY-SA visible (ou réécrire à terme) | W2-06 |
| D-11 | Stratégie mobile | **PWA + Capacitor 7** (export statique embarqué, sans `server.url`). Expo est écarté (coût ×4) | Vague 6 |
| D-12 | Comptes stores | Apple Developer (99 $/an) et Google Play (25 $) en **Organisation** (D-U-N-S) pour éviter la règle des 12 testeurs pendant 14 jours | W6-01 |
| D-13 | Licence du code | Propriétaire (`UNLICENSED`) : ajouter un fichier `LICENSE` explicite | WH-06 |
| D-14 | Staging | Oui : branche Neon `staging` + previews Netlify | DEP-05 |
| D-15 | Logo maître 1024×1024 et charte | À fournir (designer) | W4-06, W6-10 |

---

## 4. Feuille de route par vagues

Format des tâches : **ID · Tâche** — fichiers — action et critères d'acceptation — Prio · Effort · Modèle/effort · Dépendances. Les identifiants entre crochets renvoient aux constats d'audit.

### Vague 0 — Urgences sécurité et déblocage du déploiement (P0, ~3 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W0-01** 🔒 | Rôles et e-mails normalisés [SEC-01, BE-07, M4] | `@Transform(trim+lowercase)` sur les DTO register, login, forgot et reset. Migration : détecter les collisions de casse, puis `lower(email)` et index unique sur `lower(email)` (ou citext). Remplacer la liste `OPERATOR_EMAILS` par un champ `User.role` (`USER`/`OPERATOR`) attribué par seed ou CLI. `effectivePremium` utilisé partout (`animals.service.ts:33`). **Test e2e** : inscription `OP1@EXAMPLE.COM` → 409 ; `/admin/users` → 403 pour un non-opérateur. | P0 · M · **opus high** | — |
| **W0-02** | URL d'API unique [SEC-02, FE-01, MOB-10, MOB-11, MOB-19] | Créer `frontend/src/lib/config.ts` (`API_URL` = `NEXT_PUBLIC_API_URL`, obligatoire en prod ; fallback LAN **seulement** si `NODE_ENV==='development'`). L'utiliser dans `api.ts`, `AuthContext.tsx:30`, `parametres/notifications/page.tsx:59`. Remplacer le message « npm run start:dev » par un message i18n avec bouton Réessayer. `/api/mobile-link` limité au dev. Test jest : hôte non local + env définie → l'URL d'env est utilisée. | P0 · S · sonnet medium | — |
| **W0-03** | Dépendances vulnérables [SEC-03, FE-02, BE-13] | Front : `next ≥ 16.3.6`, `axios` à jour (ou supprimer axios avec `api-client.ts`, code mort). Back : `nodemailer ≥ 10.0.6`, `axios ≥ 1.19.1`, joi, prisma, `@nestjs/*`. Retirer `memcached` et les dépendances front inutilisées (`leaflet`, `react-leaflet`, `qrcode`, `framer-motion`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-query`, `@radix-ui/react-select`) après vérification. `images.unoptimized: true` (aucun `next/image` utilisé). **Acceptation** : `npm audit --omit=dev --audit-level=high` = 0 des deux côtés, build et tests verts. | P0 · M · sonnet medium | — |
| **W0-04** | Secrets et valeurs par défaut de prod [SEC-11, SEC-12, OPS-02, OPS-03, OPS-14, BE-03, BE-05, BE-16] | Joi conditionnel `NODE_ENV=production` : `JWT_SECRET` ≥ 32 caractères avec liste noire des valeurs d'exemple ; `CORS_ORIGIN`, `FRONTEND_URL` (https), `PUBLIC_WEB_URL` obligatoires ; `MAIL_HOST` obligatoire dès W3-01. Ne **jamais** logger le lien de reset en prod ; `sendMail` dans un try/catch avec réponse générique ; stocker `sha256(token)` de reset et purger les expirés. Remplacer `console.error(AxiosError)` par message + statut (fuite du token Species+). Défaut `FRONTEND_URL` → `:3000`. Corriger `api.config.ts:35` (WIKIPEDIA_RATE_WINDOW). Compose : `${JWT_SECRET:?}`, `${POSTGRES_PASSWORD:?}`, Postgres sur `127.0.0.1`. Défaut `HOST` à `0.0.0.0` [BE-19]. `.env.example` racine et backend complets et cohérents. | P0 · M · sonnet medium | — |
| **W0-05** | Seed de prod et identifiants propres [BE-02, BE-21, HYG-03, HYG-04] | Supprimer les 9 magasins `example-*.fr` de `seed-prod.ts:774-850` (et prévoir la requête SQL de purge). Garde `NODE_ENV==='production' → throw` dans `seed-dev.ts` et `scripts/reset-dev-password.ts`. Retirer l'e-mail réel et `Captivia2025` de ce script. Expurger `test@captivia.local / Test1234!` des docs. | P0 · S · haiku low | — |
| **W0-06** 🔒 | Page QR publique sûre [SEC-10, BE-08, LEG-07, MOB-20, MOB-22, SEC-21] | `Animal.publicEnabled` (opt-in) + `publicFields`. Liste blanche par défaut : nom, espèce, sexe, photo, contact volontaire. Jamais `notes`, `details` ni l'`id` interne. Endpoints révoquer / regénérer. URL du QR construite **côté backend** depuis `PUBLIC_WEB_URL` + locale (ignorer `baseUrl`). RateLimitGuard, `X-Robots-Tag: noindex`, lien « Signaler ». Désactivation à l'expiration du premium. | P0 · M · sonnet medium | W0-01 (verrou Prisma) |
| **W0-07** | DoS des notifications et farming de points [SEC-04, BE-06] | DTO imbriqués : `time` `^([01]\d|2[0-3]):[0-5]\d$`, `intervalHours` entre 1 et 24, `types` limité aux clés connues, `date` bornée. Plafond de 200 événements par jour avec `createMany`. `refresh` ne supprime que les `pending`. Crédit de points atomique (`updateMany where status=pending` + `increment` en transaction). Contrainte unique `userId+routineId+scheduledAt`. DTO pour `grade.controller.ts:46`. | P0 · M · sonnet high | 🔒 après W0-06 |
| **W0-08** | Amplification, rate limiting et cache [SEC-07, SEC-08, SEC-09, SEC-18] | `/gateway/search` : `limit` entre 1 et 20, enrichissement de 5 résultats maximum avec concurrence 3, `query` ≤ 100 caractères, 10 requêtes/min. `@nestjs/throttler` global à 60/min. Auth : 5/min par IP **et** par e-mail, avec backoff ; reset-password 10/h ; endpoints qui appellent des API externes 20/min. Préfixe Redis distinct par guard. Cache : `lru-cache` (max + ttl), clés hachées, TTL en secondes respecté [BE-18]. `POST /gateway/clear-cache` réservé aux opérateurs. | P0 · M · sonnet medium | — |

### Vague 1 — Fondations de production (P1, ~5 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W1-01** 🔒 | Sessions robustes [SEC-05, BE-12, MOB-13] | `User.tokenVersion` dans le payload, vérifié dans `validate()`, incrémenté au reset, au changement de mot de passe et sur « déconnecter tous les appareils ». Access token de 30 min + refresh token rotatif haché en base (`/auth/refresh`, `/auth/logout`). `algorithms: ['HS256']`. Garder le Bearer (compatible natif). | P1 · L · **opus high** | W0-01 |
| **W1-02** | Client API frontend unique [FE-08, FE-22, FE-24, SEC-21] | `request<T>()` unique : vérification de `ok`, `AbortSignal.timeout(15s)`, `ApiError{status, code}`, refresh automatique sur 401 puis `auth:logout`. **Ne pas** déconnecter sur 403 « premium requis ». `JSON.parse` du localStorage dans un try/catch. Décodage de `exp` au démarrage. Hook `useRequireAuth` avec `?next=`. Supprimer `api-client.ts`. Remplacer les détections `msg.includes('401')` des pages. | P1 · L · sonnet high | W0-02, W1-01 |
| **W1-03** | Observabilité [OPS-07, OPS-08, OPS-09, BE-11, BE-23, SEC-20, FE-14] | Backend : `instrument.ts` importé en premier, Sentry avec `release` (SHA) et `environment`, région UE, scrub des données personnelles. Le filtre d'exceptions logge les 5xx avec stack et requestId. `nestjs-pino` en JSON avec redaction (authorization, e-mails, tokens) et request-id. `/health/live` + `/health/ready` (`SELECT 1`, timeout 2 s), `HEALTHCHECK` Dockerfile, `GIT_SHA` exposé. Frontend : `instrumentation-client.ts`, `onRequestError`, `withSentryConfig` (tunnel), `captureException` dans ErrorBoundary et `error.tsx`. Remplacer les 13 `console.*` backend par Logger. | P1 · L · sonnet medium | — |
| **W1-04** | Résilience des API externes [BE-09, SEC-17] | Instance axios commune : timeout 5 s, `maxRedirects: 0`, `maxContentLength`. GBIF : 2 à 3 tentatives avec jitter, budget total < 8 s. Circuit breaker par fournisseur (cockatiel) avec repli sur les profils locaux ou le cache périmé. Validation `barcode ^\d{8,14}$` et `qid ^Q\d+$`. Corriger `/gateway/health` (Wikipedia toujours « unhealthy »). | P1 · M · sonnet medium | W0-08 |
| **W1-05** | Pagination et tri stable [BE-15, SEC-16] | `PaginationQueryDto` (`limit` ≤ 100) + `orderBy` stable sur les 14 listes identifiées. `species-profile.service.ts:57` avec `orderBy`. `advanced-search` : `@Query() any` remplacé par un DTO. `MaxLength` sur tous les DTO texte. `photos` : `@IsUrl` https. Adapter le frontend (W1-02). | P1 · M · sonnet medium | W1-02 |
| **W1-06** | Tests stables et CI bloquante [BE-10, OPS-04, FE-15] | e2e : `app.listen(0)` + `getUrl()`, fabrique `createApp()` alignée sur `main.ts`, nettoyage de la base, séparation `test:unit` / `test:e2e`. CI : `permissions: contents: read`, `timeout-minutes`, `tsc --noEmit` (deux côtés), `npm test` frontend, build Docker backend, audit `--audit-level=high` bloquant, Dependabot + CodeQL, correction du job e2e (`workflow_dispatch`), smoke Playwright avec API mockée + axe. Protection de la branche `main`. `modulePathIgnorePatterns: ['<rootDir>/.next/']` [FE-30]. | P1 · M · sonnet medium | — |
| **W1-07** | Dette lint et code mort [BE-22, FE-21, FE-24] | (a) `prettier --write` + `no-unused-vars` (**haiku low**). (b) Suppression du code mort : `src/gbif/*`, `common/interceptors/*` non enregistrés, mocks `database-optimization` (`Math.random`), `components/ui/{Button,Spinner,Toast}` inutilisés, `src/i18n.ts` obsolète, 81 clés i18n mortes (**haiku low**). (c) Typage des ~1 160 `no-unsafe-*` (réponses axios typées) et des 45 `no-explicit-any` front (**sonnet medium**, par lots de fichiers). Puis lint bloquant en CI. | P1 · L · haiku low + sonnet medium | W1-06 |
| **W1-08** | Corrections backend diverses [SEC-14, SEC-15, SEC-19, BE-24] | Limite « 1 animal gratuit » sans course (Serializable avec retry ou `FOR UPDATE`). Upsert de `PushSubscription` qui vérifie `userId`, endpoint en https avec allowlist des services push. Anti-énumération (hash factice, réponse uniforme au register) ; mot de passe de 10 à 128 caractères. DTO notifications typés. `checkIfShouldNotify` robuste si `schedule` est nul. | P1 · M · sonnet medium | W0-07 |
| **W1-09** 🔒 | Durcissement du schéma [BE-20] | CHECK sur `Animal.sex`, `Medication.frequency`, `VetAppointment.status`, `SpeciesLegislation.status`, `AnimalHealthRecord.type`. FK `Species*.speciesId` → `SpeciesProfile`. Unicité `NotificationEvent`. Index pg_trgm sur `commonNameFr` / `scientificName`. Suppression de l'index btree redondant. Migration vers `prisma.config.ts`. **Ne pas renommer** la migration `20260809_000000_initial`. | P1 · M · sonnet medium | 🔒 |

### Vague 2 — Conformité légale et compte utilisateur (P0/P1, ~3 j + relecture juridique)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W2-01** | Suppression et export de compte [LEG-02, SEC-13, MOB-31] | `DELETE /users/me` (re-saisie du mot de passe, transaction, cascade vérifiée sur les 21 `onDelete`, `tokenVersion++`). `GET /users/me/export` **gratuit** (JSON complet, art. 20). Boutons dans `parametres/compte`. Page web publique « demander la suppression » (exigée par Google Play). Purge des sauvegardes sous 14 j documentée. | **P0** · M · sonnet medium | W1-01 |
| **W2-02** | Pages légales et footer global [LEG-01, LEG-03, LEG-06, LEG-09, LEG-11, FE-09] | Routes `/mentions-legales`, `/confidentialite` (finalités, bases légales, sous-traitants Netlify/Render/Neon/Sentry/Brevo, transferts hors UE, durées, droits, CNIL ; localStorage décrit comme traceur strictement nécessaire), `/cgu` (âge minimum, pas de substitution à un vétérinaire, responsabilité santé et réglementation), `/cgv` (si D-04 payant), `/sources-et-licences`. Footer global dans le layout, réutilisant les clés `footer.*` existantes. Vrai contact (remplacer « (exemple) »). FR + EN au minimum, les 6 langues à terme. **Relecture par un juriste.** | **P0** · M · **opus high** (rédaction) + sonnet low (pages) | D-01 |
| **W2-03** 🔒 | Consentement à l'inscription [LEG-04] | `User.termsAcceptedAt`, `termsVersion`, `birthYear` ou case « j'ai 15 ans ou plus ». Cases obligatoires sur `register`. Re-consentement si la version change. | P1 · S · sonnet low | W2-02 |
| **W2-04** 🔒 | Vérification d'e-mail [SEC-01 (suite), M4] | `User.emailVerifiedAt`, token haché envoyé à l'inscription, renvoi limité. Rôle opérateur et fonctions sensibles réservés aux comptes vérifiés. | P1 · M · sonnet medium | W3-01 |
| **W2-05** | Affiliation conforme [LEG-08, MOB-36] | Mention « En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises » (footer + `/magasin` + fiches). `rel="sponsored noopener noreferrer"` (`magasin/page.tsx:141`, `species/[id]/page.tsx:158,843,882`). Place de marché selon la locale (défaut `amazon.fr`). Internationaliser `species/[id]/page.tsx:1189`. | P1 · S · haiku low | — |
| **W2-06** | Attributions et licences des données [LEG-10] | Afficher « Source : Wikipédia — CC BY-SA 4.0 » + lien sur chaque fiche concernée. Citation GBIF. Mention ODbL pour OPFF. Audit des licences GBIF à l'import (exclure CC BY-NC, incompatible avec un service monétisé). Persister `sourceUrl` et `sources` (voir W5-01). | P1 · M · sonnet medium | W5-01 |
| **W2-07** | Page transparence véridique et traduite [LEG-02, FE-11] | Aligner les promesses (suppression, export gratuit, partage d'animaux en opt-in), traduire la page (aujourd'hui 100 % FR en dur). | P1 · S · haiku low | W2-01 |
| **W2-08** | Registre, rétention et purge [LEG-09] | `docs/legal/registre-traitements.md`, liste des DPA à signer. Job de purge : tokens expirés, `NotificationEvent` de plus de 90 j, comptes inactifs de plus de 36 mois après préavis. `POST /analytics/track` : retirer `userId` de la query [LEG-06]. | P1 · M · opus medium (doc) + sonnet medium (job) | W3-02 |

### Vague 3 — Fonctionnalités cœur réelles (P0/P1, ~8 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W3-01** | E-mails transactionnels [OPS-12] | `MailService` partagé (Brevo SMTP ou API), gabarits i18n selon `user.locale` (reset, vérification, rappels, suppression de compte), file avec retry, SPF/DKIM/DMARC sur le domaine. | **P0** · M · sonnet medium | D-03, D-06 |
| **W3-02** 🔒 | Scheduler de rappels [BE-01] | `@nestjs/schedule` avec cron toutes les 5 min. Job unifié routines + médicaments + vaccins + RDV vétérinaires. `User.timezone`. Contrainte d'unicité anti-doublon. Verrou consultatif Postgres (multi-instance). Respect de `deliveryChannel` (e-mail / push / les deux). Fréquences `every_2_days` / `every_3_days` calculées depuis la date de départ (et non la parité epoch). Tests unitaires ≥ 90 %. | **P0** · L · **opus high** (conception) → sonnet high (impl.) | W3-01, W0-07 |
| **W3-03** | Web Push réel [BE-01, FE-13, LEG-14] | `web-push` + VAPID (variables lues), suppression des abonnements en 404/410. Côté front : enregistrement du SW (web uniquement), permission demandée sur action utilisateur, `pushManager.subscribe`, désinscription. `notificationclick` avec préfixe de locale. Retirer « bientôt disponible ». | P1 · L · sonnet medium | W3-02 |
| **W3-04** 🔒 | Paiement web Stripe [BE-04, LEG-05, FE-03] | Modèle `Subscription` (`status`, `currentPeriodEnd`, `source: stripe|apple|google|manual`). Checkout + Customer Portal. Webhook signé et idempotent. `isPremium` dérivé de `currentPeriodEnd`. Politique de rétrogradation (au-delà de 1 animal : lecture seule). Paywall conforme : prix TTC, renouvellement, rétractation de 14 j avec renonciation expresse, résiliation en 2 clics. **Si D-04 = lancement gratuit** : masquer l'achat (P1 post-lancement). | P1 · XL · **opus high** | D-04, D-05, W2-02 |
| **W3-05** | Stubs externes [BE-17, HYG-11] | Amazon PA / Creators API, Species+ et PubMed : implémenter (avec clés) **ou** retirer routes, modules et UI. Ne plus mettre en cache des résultats vides. `/amazon/*` désactivé tant qu'il n'est pas configuré. | P1 · M · sonnet medium | D-09 |

### Vague 4 — Frontend web « 10/10 » (P1, ~8 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W4-01** | Navigation i18n [FE-04] | `createNavigation(routing)` (next-intl) pour les 28 `Link` / `useRouter`. `router.replace(pathname, {locale})` dans `LanguageSelector` et `parametres/compte`. Test e2e : `/en` → Français → `/` en FR. | P1 · M · sonnet medium | — |
| **W4-02** | Erreurs, 404 et rendu statique [FE-07, FE-10, FE-17] | `hasLocale` puis `notFound()` dans le layout, `generateStaticParams` + `setRequestLocale`. `[locale]/error.tsx`, `global-error.tsx`, `[locale]/not-found.tsx` (traduits, stylés), `loading.tsx`. ErrorBoundary traduit. **Acceptation** : `/robots.txt` sans route → 404, `/fr/nope` → 404 Captivia. | P1 · M · sonnet medium | W1-03 |
| **W4-03** | i18n complète [FE-11] | Traduire les 66 clés restées en français dans en/es/de/it/pt. Extraire les ~70 textes en dur (home, transparence, notifications, compte, magasin, AppHeader, WeightChart, Modal, abonnement…). Dates via `useFormatter`. Test jest de parité (aucune valeur identique au FR hors liste blanche). Un agent par locale possible pour la traduction. | P1 · L · sonnet medium | W2-07 |
| **W4-04** | SEO [FE-05, FE-18 en partie] | `generateMetadata` (titre et description traduits, `metadataBase`, `alternates` hreflang, canonical, OpenGraph/Twitter). Wrappers serveur pour les pages publiques ; `species/[id]` rendu côté serveur avec métadonnées et JSON-LD. `app/sitemap.ts` (6 locales × fiches) et `app/robots.ts` (disallow `/mes-animaux`, `/parametres`, `/animal-public`). `noindex` sur les pages privées. Image OG. | P1 · L · sonnet high | W4-02 |
| **W4-05** | Accessibilité (WCAG 2.2 AA / RGAA) [FE-12, LEG-12] | Label du `<select>` de `/magasin`, un seul `<main>`, contrastes (`emerald-600` → `700`, `gray-400/500` → `600`), `<h1>` dans les états chargement et erreur. Migrer les 36 modales écrites à la main vers `ui/Modal` (Radix : focus trap, Escape). Menu mobile `aria-modal` + Escape, lien d'évitement, focus visible (66 `outline-none` à revoir). axe = 0 violation en CI. Déclaration d'accessibilité si aucune exemption. | P1 · L · sonnet medium | W1-06 |
| **W4-06** | PWA et ergonomie mobile [FE-06, FE-25, MOB-01 à MOB-07] | `app/manifest.ts`, icônes 192/512/maskable, `apple-icon`, `badge.png`, `viewport.themeColor` + `viewportFit: 'cover'`, `env(safe-area-inset-*)`. Exclure `.well-known` du matcher de `proxy.ts`. `w-screen` → `w-full`, `100vh` → `dvh`. Actions visibles sans survol sur écran tactile. Page hors ligne + cache du shell (Serwist). | P1 · M · sonnet low | D-15 |
| **W4-07** | Performance [FE-18, FE-19, MOB-08] | Découper `mes-animaux/[id]/page.tsx` (4 521 lignes, 155 `useState`) en onglets chargés via `dynamic()`. `NextIntlClientProvider` limité aux namespaces utiles. Photos : compression et redimensionnement côté client, limite de taille côté API, erreurs visibles. Nettoyer `public/` (symlinks `themes/*.png`, assets du template). Budget : JS gzip ≤ 170 Ko par page, Lighthouse mobile ≥ 90. | P1 · L · sonnet high | W1-02 |
| **W4-08** | CSP stricte [FE-16, SEC-06, OPS-15] | CSP à nonce via `proxy.ts`, sans `unsafe-eval`. `connect-src` limité à l'API + Sentry. `object-src 'none'`, HSTS. Supprimer `vercel.json` (legacy). `turbopack.root` / `outputFileTracingRoot`. | P1 · M · **opus medium** | W1-03 |
| **W4-09** | E2E Playwright fiables [FE-26] | Remplacer les 42 `waitForTimeout` et assertions conditionnelles. Nettoyer les utilisateurs créés. Projets chromium + Mobile Chrome en CI. `webServer` sur `next start`. Déplacer ou supprimer `frontend/e2e-*.js`. Parcours clés : inscription, ajout d'animal, rappel, export, suppression de compte. | P1 · M · sonnet medium | W1-06 |

### Vague 5 — Contenu éditorial (P1, ~5 j d'agents)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W5-01** | Seed complet et vérifiable [BE-14] | Intégrer l'import des 1 379 races (`import-breeds.ts`) dans le seed, ou ajouter `seed:breeds` au déploiement. Corriger `semi-solitaire` → valeur valide. Persister `sourceUrl` et `sources`. Test de seed avec comptages minimaux (≥ 296 espèces, ≥ 1 379 races, 0 magasin factice). | P1 · M · sonnet medium | W0-05 |
| **W5-02** | Curation des 245 espèces incomplètes | Alimentation, habitat, comportement, santé et législation, tous **sourcés**. Vagues de 25 espèces par agent sonnet medium, relecture par échantillon (opus high). Format conforme à `prisma/templates-contract.md`. | P1 · L · sonnet medium + opus high (revue) | W5-01 |
| **W5-03** | Reproduction par espèce (`SpeciesReproduction`, 0 ligne aujourd'hui) | Contenu sourcé pour les espèces prioritaires (top 100 recherchées), ensuite le reste. | P2 · L · sonnet medium | W5-01 |
| **W5-04** | Date de vérification et avertissements [LEG-11] | `lastReviewedAt` par fiche, affiché ; avertissement santé et législation homogène. | P1 · S · haiku low | 🔒 |

### Vague 6 — Applications Android et iOS (Capacitor 7) (Jalon 2, ~4 à 6 semaines)

> **Stratégie retenue (D-11)** : PWA pour le web, Capacitor 7 pour iOS et Android, avec un bundle statique **embarqué** (jamais `server.url`, sinon rejet Apple 4.2). Les 16 pages sont déjà `'use client'` et n'ont aucun SSR réel : l'export statique est faisable. Fonctions natives exigées pour passer la règle 4.2 : rappels locaux, appareil photo, partage du carnet, Universal Links, achats intégrés.

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W6-01** | Comptes développeurs [MOB-39] | Apple Developer + Google Play en **Organisation** (D-U-N-S). Bundle id `app.captivia`, contrats Paid Apps, fiscalité. **À lancer dès J1** (chemin critique). | P0 · S + délais · propriétaire | D-12 |
| **W6-02** | Cible `MOBILE_BUILD` en export statique [T6] | `output: 'export'`, `images.unoptimized`, `trailingSlash`. `localePrefix: 'always'` + redirection client de `/`. Routes `mes-animaux/detail?id=`, `species?id=` (ou pré-rendu). Exclusion de `api/` et du middleware. CSP en `<meta>` [MOB-16]. Le build web ne change pas. | P0 · L · **opus high** | Vague 4 |
| **W6-03** | Initialisation de Capacitor [MOB-15, MOB-40] | `capacitor.config.ts` (`webDir: out`). Ajouter `capacitor://localhost` et `https://localhost` à `CORS_ORIGIN`. Android `targetSdk 36`, iOS SDK 26 (Xcode 26). iPhone seulement en v1. | P0 · M · sonnet medium | W6-02 |
| **W6-04** | Stockage sécurisé des tokens [MOB-12] | Abstraction `tokenStorage` : Preferences/Keychain sur natif, localStorage sur le web. | P1 · M · sonnet medium | W6-03, W1-01 |
| **W6-05** | Couche plateforme [MOB-17, MOB-18, MOB-36] | `openExternal` (liens Amazon dans le navigateur système, **jamais** dans une WebView). `@capacitor/camera` avec compression. Export du carnet via Filesystem + Share. Chaînes `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`. | P1 · M · sonnet medium | W6-03 |
| **W6-06** | Rappels en notifications locales [MOB-35 (1)] | `@capacitor/local-notifications`, synchronisés avec les routines, médicaments, vaccins et RDV. Fonctionne hors ligne. | P1 · L · sonnet high | W6-03, W3-02 |
| **W6-07** ✅ (code) | Push distant FCM / APNs [MOB-35 (2)] | **Livré (2026-10-03)** : modèle `DeviceToken` (migration `20261003120000_device_tokens`), `POST/DELETE /users/me/device-tokens` (JWT, 30/min/IP, validation stricte, 10 installations par compte), FCM HTTP v1 **sans SDK** (assertion JWT RS256 ; iOS par le relais APNs de FCM avec la clé `.p8`), `FCM_SERVICE_ACCOUNT_JSON` (base64) / `FCM_PROJECT_ID`, canal désactivé sans configuration ; `PushDispatcher` (Web Push + natif) branché sur le scheduler W3-02 et la notification de test, anti-doublon avec les rappels locaux (`localRemindersUntil`) ; purge `UNREGISTERED` / jeton invalide, déconnexion, logout-all, suppression du compte, purge des invités, 270 jours d’inactivité ; export RGPD (section `appInstallations`, sans le jeton). App : `@capacitor/push-notifications` 7.0.7, explication préalable (`NotificationPrimer`) au premier soin créé, rafraîchissement du jeton, deep link au toucher. Doc : `docs/MOBILE.md` § 7.3, `docs/DEPLOY.md`, `docs/RUNBOOK.md` § 4.7, registre T4. **Reste au propriétaire** : projet Firebase, `google-services.json` / `GoogleService-Info.plist`, clé APNs, capacités Xcode et `AppDelegate`, variable Render `FCM_SERVICE_ACCOUNT_JSON`, puis interrupteur de build `NEXT_PUBLIC_NATIVE_PUSH=1` (variable GitHub `NATIVE_PUSH`), test sur appareil (§ 7.3.4). | P1 · L · opus medium → sonnet medium | W3-02 |
| **W6-08** 🔒 | Achats intégrés [MOB-30] | RevenueCat (produits mensuel et annuel), webhook vers `Subscription` (source apple/google), paywall conforme (prix, durée, renouvellement auto, Restaurer, liens CGU et Confidentialité). Sandbox testée. Option MVP : masquer l'offre sur natif. | P0 (si premium) · XL · **opus high** | W3-04, W6-01 |
| **W6-09** | Universal Links / App Links [MOB-04, MOB-21, MOB-23] | `/.well-known/apple-app-site-association` + `assetlinks.json` (empreintes upload + Play App Signing). Associated Domains, intent-filter `autoVerify`, `appUrlOpen` vers le routeur (QR, reset-password). | P1 · M · sonnet medium | W4-06, W6-03 |
| **W6-10** | Icônes, splash et fiches store [MOB-02, MOB-38] | `@capacitor/assets` depuis le logo maître. Captures 6,9" / 6,5" et Play via Playwright. Fiches FR et EN. | P0 · M · sonnet medium | D-15 |
| **W6-11** | Déclarations de confidentialité et d'âge [MOB-33, MOB-37] | App Privacy, Data Safety, `PrivacyInfo.xcprivacy`, nouveau questionnaire d'âge Apple, IARC, déclaration de l'app dans Amazon Associates Central. | P0 · M · sonnet medium | W6-05 à W6-08 |
| **W6-12** | CI mobile et crash reporting [MOB-41, MOB-43] | `.github/workflows/mobile.yml` : export → `cap sync` → `bundleRelease` / fastlane `beta`. Keystore et certificats en secrets (fastlane match). `@sentry/capacitor` avec source maps. | P1 · L · sonnet medium | W6-03 |
| **W6-13** | Préparation de la relecture [MOB-42] | Compte de démo rempli, sandbox IAP, aucun « bientôt disponible ». TestFlight + test fermé Play (≥ 14 j si compte personnel). | P0 · S + 2 sem. · haiku low | W6-08, W6-10, W6-11 |
| **W6-14** | Soumission aux stores | Réponses aux relecteurs, suivi des rejets. | P0 · M · sonnet medium | W6-13 |

### Vague 7 — Infrastructure, déploiement et mise en ligne (P0/P1, ~3 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **DEP-01** | Pipeline à build automatique (voir §5) | Adapter `render.yaml` (`autoDeployTrigger: checksPass`), le job `migrate` dans le CI de `main`, Netlify relié à GitHub (previews de PR), `deploy.yml` réduit au seed manuel. | P0 · S · sonnet medium | Comptes créés |
| **DEP-02** | Domaine et HTTPS | DNS du domaine (D-03) vers Netlify et Render, TLS automatique. Mise à jour de `CORS_ORIGIN`, `FRONTEND_URL`, `PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL`. | P1 · S · haiku low | D-03 |
| **DEP-03** | Sauvegardes et PRA [OPS-06] | Neon : historique et restauration PITR selon l'offre. Dump logique hebdomadaire chiffré (age) par GitHub Actions vers un stockage UE (Cloudflare R2 gratuit). Corriger `backup-db.sh` (`?schema=` retiré, `gzip -t`, `--clean --if-exists --no-owner`), `backups/` dans `.gitignore`. RPO ≤ 24 h, RTO ≤ 4 h, test de restauration trimestriel documenté. | P1 · M · sonnet medium | DEP-01 |
| **DEP-04** | Supervision | UptimeRobot ou Better Stack (gratuit) sur `/health/ready` et la home. Alertes Sentry (e-mail). Supervision du quota Render (750 h) et Neon. | P1 · S · haiku low | W1-03 |
| **DEP-05** | Staging | Branche Neon `staging`, previews Netlify pointant vers l'API de staging, données de démo isolées. | P1 · M · sonnet low | DEP-01 |
| **DEP-06** | Docker et compose [OPS-16, OPS-19] | Versions épinglées, `HEALTHCHECK`, `.env*` dans `frontend/.dockerignore` (déjà présent : vérifier), Redis retiré ou utilisé, `docker-compose.prod.yml` avec Caddy. | P2 · S · haiku low | — |
| **DEP-07** | Versionnage [OPS-17] | SemVer, tags, release-please, `CHANGELOG.md`, `release` Sentry = SHA. | P1 · S · haiku low | W1-03 |
| **DEP-08** | Runbooks | `docs/DEPLOY.md` (mise en place des comptes, variables, rollback Render et Netlify, migrations expand/contract), `docs/RUNBOOK.md` (incidents, rotation de `JWT_SECRET`, restauration). | P1 · M · sonnet low | DEP-01 |
| **DEP-09** | Test de charge | k6 sur staging : 50 utilisateurs virtuels sur les parcours clés, mémoire < 450 Mo (instance Render 512 Mo), p95 < 500 ms hors démarrage à froid. | P1 · M · sonnet medium | DEP-05 |
| **DEP-10** | Scalabilité (après lancement) [OPS-10] | Documenter le mono-instance. Si plusieurs instances : Redis (Upstash gratuit) pour le cache et le rate-limit, verrou du scheduler déjà prévu (W3-02). | P2 · M · sonnet medium | — |

### Vague H — Hygiène du dépôt (en parallèle, à tout moment, haiku low)

| ID | Tâche | Prio · Effort |
|---|---|---|
| WH-01 | Réécrire `README.md` : retirer les liens morts (`FIXES_APPLIED.md`, `DEPLOYMENT.md`, `TESTING_CHECKLIST.md`, `CAPACITOR_SETUP.md`), la date du 1er février et la mention « Production Ready », renvoyer vers ce plan et `docs/DEPLOY.md` | P1 · S |
| WH-02 | Archiver `AUDIT-2026-08-09.md`, `FONCTIONNEL-AUDIT-2026-08-09.md`, `RAPPORT-FINAL-2026-08-09.md` et `audit-details/` dans `docs/archive/` (avec la mention « périmé ») ; renommer `Plan de lAPI` en `docs/plan-api.md` | P2 · S |
| WH-03 | `frontend/README.md` (aujourd'hui modèle create-next-app) : architecture, scripts, conventions | P2 · S (sonnet low) |
| WH-04 | Supprimer ou documenter `start.bat`, `.cursorindexingignore`, `scripts/vercel-open.js` ; aligner les ports de `scripts/start.js` (inversés) [OPS-18] | P2 · S |
| WH-05 | `.nvmrc` (22) + `"engines": {"node": ">=22"}` dans les 3 `package.json` | P2 · S |
| WH-06 | Fichier `LICENSE` (D-13) | P2 · S |
| WH-07 | Créer les issues GitHub pour les TODO restants et le backlog P2 | P2 · S |

---

## 5. Déploiement : Neon + Render + Netlify (gratuit, build automatique)

### 5.1 Architecture cible

```
Navigateur / App ──HTTPS──► Netlify (Next.js 16, CDN, previews de PR)
        │
        └────HTTPS──► Render Free « captivia-api » (Docker NestJS, Francfort)
                              │  pooled + TLS
                              ▼
                       Neon Free « captivia » (PostgreSQL 16, Francfort)
GitHub ─ push main ─► CI (tests + migrate) ─ checks verts ─► Render autodeploy
                                           └──────────────► Netlify autobuild
```

**Limites de l'offre gratuite (à accepter) :**
- Render Free met l'API en veille après 15 min sans trafic. Un monitor UptimeRobot gratuit (toutes les 5 min) la garde éveillée (≈ 744 h, sous le quota de 750 h/mois) ; pas de cron GitHub Actions (dépôt privé : quota de 2 000 min/mois). Instance de 512 Mo, pas de commande pre-deploy.
- Neon Free : stockage et heures de calcul limités, le calcul se met en veille (réveil ≈ 1 s), historique PITR court.
- Netlify Starter : quotas de builds et de bande passante mensuels.

**Passage en payant recommandé** dès qu'il y a des utilisateurs réels : Render Starter (pas de veille, commande pre-deploy) et Neon Launch (PITR plus long).

### 5.2 Déjà en place sur la branche
- `render.yaml` : Blueprint du service `captivia-api` (Docker, Francfort, `/health`, `JWT_SECRET` généré, variables listées).
- `netlify.toml` : base `frontend/`, Node 22, runtime Next.js détecté automatiquement.
- `.github/workflows/deploy.yml` : après un CI vert sur `main`, enchaîne migrations Neon, deploy hook Render, `netlify deploy --prod`, puis un smoke test. Seed manuel en option.
- `.github/workflows/keep-warm.yml` : ping manuel de `/health` (diagnostic) ; le maintien en éveil passe par UptimeRobot.

### 5.3 Adaptation au « build automatique relié à GitHub » (DEP-01)
1. **Netlify** relié au dépôt : base `frontend`, commande `npm run build`, previews de PR activées. `NEXT_PUBLIC_API_URL` dans Site configuration → Environment variables (contextes production et deploy-preview).
2. **Render** relié au dépôt via le Blueprint. Dans `render.yaml`, remplacer `autoDeploy: false` par `autoDeployTrigger: checksPass` : Render attend que les checks GitHub soient verts.
3. **Migrations avant déploiement** : ajouter dans `ci.yml` un job `migrate-production` (uniquement sur `push` vers `main`, `needs: [test-backend, build-frontend]`, `environment: production`) qui lance `prisma migrate deploy` avec `NEON_DATABASE_URL_DIRECT`. Comme c'est un check, Render ne déploie qu'une fois la migration appliquée. Garder des migrations **expand/contract**, compatibles avec la version N-1.
4. Réduire `deploy.yml` à un `workflow_dispatch` « seed production » (premier chargement du catalogue et des races).
5. Activer la protection de `main` (PR obligatoires, checks requis).

### 5.4 Mise en place des comptes (propriétaire)
1. **Neon** : projet `captivia`, région *AWS Europe Central 1 (Frankfurt)*, base `captivia`. Récupérer l'URL **pooled** (`…-pooler…`) et l'URL **direct**.
2. **Render** (connexion GitHub) : New → Blueprint → dépôt. `DATABASE_URL` = URL pooled + `&pgbouncer=true&connect_timeout=15`.
3. **Netlify** (connexion GitHub) : Add new project → dépôt (le `netlify.toml` est détecté). Nom : `captivia` s'il est libre. Le site `captivia` créé sur l'ancien compte doit être supprimé pour libérer le nom.
4. **GitHub** → Settings → Secrets and variables → Actions :
   - Secrets : `NEON_DATABASE_URL_DIRECT` (et `RENDER_DEPLOY_HOOK_URL`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` si on conserve `deploy.yml`).
   - Variables : `API_URL`, `WEB_URL`.
   - Créer l'environnement `production` (relecteur requis, facultatif).
5. Premier déploiement : merge sur `main`, puis Actions → seed production.

### 5.5 Matrice des variables d'environnement

| Variable | Où | Valeur prod | Obligatoire |
|---|---|---|---|
| `DATABASE_URL` | Render | Neon pooled + `pgbouncer=true` | Oui |
| `JWT_SECRET` | Render | généré (≥ 32 caractères) | Oui |
| `NODE_ENV` | Render | `production` | Oui |
| `CORS_ORIGIN` | Render | URL Netlify (+ `capacitor://localhost,https://localhost` en vague 6) | Oui |
| `FRONTEND_URL` / `PUBLIC_WEB_URL` | Render | URL publique du site | Oui |
| `TRUST_PROXY` | Render | `true` | Oui |
| `HOST` | Render | `0.0.0.0` | Oui |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | Render | Brevo | Oui dès W3-01 |
| `SENTRY_DSN` | Render | projet Sentry UE | Recommandé |
| `OPERATOR_EMAILS` → remplacé par `User.role` (W0-01) | — | — | — |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Render (+ clé publique côté Netlify) | générées | Dès W3-03 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Render | Stripe | Dès W3-04 |
| `NEXT_PUBLIC_API_URL` | Netlify | URL de l'API Render | Oui |
| `NEXT_PUBLIC_SENTRY_DSN` | Netlify | projet Sentry UE | Recommandé |
| `NEON_DATABASE_URL_DIRECT` | GitHub Secrets | Neon direct | Oui |

---

## 6. Ordonnancement et parallélisation

```
J1 ──────────────────────────────────────────────────────────────────────────►
Propriétaire : D-01…D-15, comptes Neon/Render/Netlify, comptes stores (W6-01)
Couloir A : W0-01 ─► W1-01 ─► W2-01 ─► W2-04 ─► W3-04
Couloir B : W0-06 ─► W0-07 ─► W1-08 ─► W3-02 ─► W3-03
Couloir C : W0-04 ─► W0-08 ─► W1-03 ─► W1-04 ─► W3-01 ─► W3-05
Couloir D : W0-02 ─► W1-02 ─► W1-05(front) ─► W4-02 ─► W4-08
Couloir E : W2-05 ─► W2-07 ─► W4-01 ─► W4-03 ─► W4-05 ─► W4-04 ─► W4-07 ─► W4-06
Couloir F : W0-03 ─► W1-06 ─► DEP-01 ─► DEP-03..09 ─► WH-*
Couloir G : W0-05 ─► W5-01 ─► W2-06 ─► W5-02 ─► W5-04
Verrou Prisma (ordre) : W0-01 → W0-06 → W0-07 → W1-01 → W1-09 → W2-03 → W2-04 → W3-02 → W3-04 → W5-04 → W6-07 → W6-08
Revue opus high : fin de V0, V1+V2, V3, V4+V5, V7 (go-live), V6 (soumission)
```

**Estimation (j-h, à diviser selon le nombre d'agents en parallèle) :**

| Vague | Charge |
|---|---|
| V0 | ~4 j-h |
| V1 | ~9 j-h |
| V2 | ~5 j-h + juriste |
| V3 | ~10 j-h (dont Stripe ~5) |
| V4 | ~10 j-h |
| V5 | ~6 j-h |
| V7 | ~4 j-h |
| **Jalon 1** | **≈ 48 j-h**, soit 2 à 3 semaines calendaires avec 4 à 6 agents en parallèle et des revues. Sans Stripe au lancement (D-04) : −5 j-h |
| V6 (Jalon 2) | ≈ 25 à 30 j-h + délais des stores |

### Modèle de prompt pour un agent d'exécution
```
Tâche <ID> du plan docs/PLAN-PRODUCTION.md (lis la ligne correspondante et les constats cités).
Couloir <X> : ne modifie que les fichiers de ce périmètre. Verrou Prisma : <oui/non>.
Livre : code + tests + mise à jour i18n (6 locales) si UI. Vérifie : npm test, tsc --noEmit,
npm run build (front), lint sur les fichiers touchés. Commit « <ID>: <résumé> » sur la branche <ID>-slug,
puis PR. Ne touche à aucun secret. Effort : <low|medium|high>.
```

---

## 7. Définition de « prêt pour la production 10/10 » (checklist go-live)

**Sécurité**
- [ ] 0 vulnérabilité high/critical (`npm audit --omit=dev`), Dependabot actif.
- [ ] Aucune élévation possible (tests e2e rôles et casse des e-mails), sessions révocables, refresh tokens.
- [ ] Rate limiting global et par endpoint sensible, cache borné, appels externes avec timeout et circuit breaker.
- [ ] CSP à nonce, HSTS, aucun secret dans les logs (vérifié par grep des logs de staging).
- [ ] Valeurs par défaut dangereuses refusées au démarrage en production.

**Fonctionnel**
- [ ] Rappels envoyés réellement (e-mail + push web ; local et push natif sur mobile), sans doublon, au bon fuseau horaire.
- [ ] Paiement opérationnel **ou** offre premium masquée (D-04).
- [ ] Aucun stub visible (« bientôt disponible », magasins factices, endpoints vides).
- [ ] Catalogue : 296 espèces + 1 379 races, 100 % des fiches avec alimentation, habitat et comportement sourcés.

**Qualité**
- [ ] CI bloquante : lint 0 erreur, `tsc` 0, tests backend et frontend verts et stables (3 runs consécutifs), e2e Playwright (desktop + mobile), axe 0 violation, build Docker.
- [ ] Couverture backend ≥ 75 % lignes, ≥ 60 % branches ; scheduler, auth et paiement ≥ 90 %.
- [ ] Lighthouse mobile ≥ 90 (Performance, Accessibilité, Bonnes pratiques, SEO) sur home, fiche espèce et connexion.
- [ ] i18n : 6 locales complètes, aucun texte en dur, test de parité.

**Exploitation**
- [ ] Déploiement automatique depuis `main`, migrations avant déploiement, rollback documenté et testé.
- [ ] `/health/ready` supervisé, Sentry front et back avec releases, logs JSON expurgés.
- [ ] Sauvegarde hebdomadaire hors site chiffrée + restauration testée.
- [ ] Staging opérationnel, test de charge passé.

**Légal**
- [ ] Mentions légales, confidentialité, CGU (et CGV si payant), sources et licences, footer global.
- [ ] Suppression et export de compte gratuits, consentement et âge à l'inscription, vérification d'e-mail.
- [ ] Mentions affiliation Amazon et `rel="sponsored"`, attributions CC BY-SA / ODbL / GBIF affichées.
- [ ] Registre des traitements, DPA signés, durées de conservation appliquées par un job.

**Mobile (Jalon 2)**
- [ ] Builds signés iOS et Android en CI, Universal Links / App Links vérifiés.
- [ ] IAP (ou offre masquée), suppression de compte dans l'app, déclarations de confidentialité et d'âge remplies.
- [ ] TestFlight + test fermé Play validés, compte de démo fourni, soumission acceptée.

---

## 8. Backlog P2 (après lancement)

| Thème | Tâches |
|---|---|
| Sécurité | SEC-21 (404 vs 403 d'ownership) ; cookie httpOnly via BFF (alternative à W1-01) ; rotation planifiée des secrets |
| Backend | Compression et cache-control du contenu éditorial ; politique de dégradation premium affinée ; `/database/*` reconstruit ou supprimé |
| Frontend | Server Components pour les pages publiques restantes ; `next/image` + CDN images ; modération et signalement des photos publiques [LEG-13] |
| Mobile | iPad, widgets de rappels, mode hors ligne complet du carnet |
| Données | Index de recherche plein texte (pg_trgm et unaccent) ; reproduction pour toutes les espèces (W5-03) |
| Infra | Redis managé, multi-instance, CDN des assets ; `docker-compose.prod.yml` avec Caddy |
| Hygiène | `breeds-data.json` (7 Mo) déplacé hors du dépôt ou compressé |

---

## Annexe A — Correspondance entre constats d'audit et tâches

| Constat | Tâche | Constat | Tâche | Constat | Tâche |
|---|---|---|---|---|---|
| SEC-01 | W0-01, W2-04 | BE-01 | W3-02, W3-03 | FE-01 | W0-02 |
| SEC-02 | W0-02 | BE-02 | W0-05 | FE-02 | W0-03 |
| SEC-03 | W0-03 | BE-03 | W0-04 | FE-03 | W3-04 |
| SEC-04 | W0-07 | BE-04 | W3-04 | FE-04 | W4-01 |
| SEC-05 | W1-01 | BE-05 | W0-04 | FE-05 | W4-04 |
| SEC-06 | W4-08 | BE-06 | W0-07 | FE-06 | W4-06 |
| SEC-07/08/09 | W0-08 | BE-07 | W0-01 | FE-07 | W4-02 |
| SEC-10 | W0-06 | BE-08 | W0-06 | FE-08 | W1-02 |
| SEC-11/12 | W0-04 | BE-09 | W1-04 | FE-09 | W2-02 |
| SEC-13 | W2-01 | BE-10 | W1-06 | FE-10 | W4-02 |
| SEC-14/15/19 | W1-08 | BE-11 | W1-03 | FE-11 | W4-03 |
| SEC-16 | W1-05 | BE-12 | W1-01 | FE-12 | W4-05 |
| SEC-17 | W1-04 | BE-13 | W0-03 | FE-13 | W3-03, W4-06 |
| SEC-18 | W0-08 | BE-14 | W5-01 | FE-14 | W1-03 |
| SEC-20 | W1-03 | BE-15 | W1-05 | FE-15 | W1-06 |
| SEC-21 | W0-06, W1-02 | BE-16 | W0-04 | FE-16 | W4-08 |
| OPS-01 | §5, DEP-01 | BE-17 | W3-05 | FE-17 | W4-02 |
| OPS-02/03 | W0-04 | BE-18 | W0-08 | FE-18/19 | W4-07 |
| OPS-04 | W1-06 | BE-19 | W0-04 | FE-20 | W0-03 |
| OPS-05 | DEP-01, DEP-08 | BE-20 | W1-09 | FE-21/24 | W1-07 |
| OPS-06 | DEP-03 | BE-21 | W0-05 | FE-22 | W1-02 |
| OPS-07/08/09 | W1-03 | BE-22 | W1-07 | FE-23/30 | W4-08, W1-06 |
| OPS-10 | DEP-10 | BE-23 | W1-03 | FE-25 | W4-06 |
| OPS-11 | §5.5 (TRUST_PROXY) | BE-24 | W1-08 | FE-26 | W4-09 |
| OPS-12 | W3-01 | LEG-01/03 | W2-02 | MOB-01…07 | W4-06 |
| OPS-13 | DEP-05, DEP-08 | LEG-02 | W2-01, W2-07 | MOB-10/11/19 | W0-02 |
| OPS-14 | W0-04 | LEG-04 | W2-03 | MOB-12/13 | W6-04, W1-01 |
| OPS-15 | W4-08 | LEG-05 | W3-04 | MOB-15/40 | W6-03 |
| OPS-16/19 | DEP-06 | LEG-06 | W2-08 | MOB-17/18/36 | W6-05 |
| OPS-17 | DEP-07 | LEG-07 | W0-06, W1-01 | MOB-20/22 | W0-06 |
| OPS-18 | WH-04 | LEG-08 | W2-05 | MOB-21/23 | W6-09 |
| HYG-01/02 | WH-01 | LEG-09 | W2-08 | MOB-30 | W6-08 |
| HYG-03/04 | W0-05 | LEG-10 | W2-06 | MOB-31 | W2-01 |
| HYG-05 | WH-03 | LEG-11 | W2-02, W5-04 | MOB-32/33/37 | W2-02, W6-11 |
| HYG-06/12 | WH-02 | LEG-12 | W4-05 | MOB-35 | W3-03, W6-06, W6-07 |
| HYG-07/14 | WH-04 | LEG-13 | §8 | MOB-38/02 | W6-10 |
| HYG-08/09 | WH-05/06 | LEG-14 | W3-03 | MOB-39 | W6-01 |
| HYG-10 | W1-03 | — | — | MOB-41/43 | W6-12 |
| HYG-11 | W3-05, WH-07 | — | — | MOB-42 | W6-13 |
| HYG-13 | §8 | — | — | MOB-08/09 | W4-07, W0-03 |
