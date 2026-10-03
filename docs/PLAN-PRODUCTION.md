# Captivia — Plan de mise en production « 10/10 » (web · Android · iOS)

> Plan établi le 2026-10-02 à partir de 6 audits parallèles (sécurité, backend/données, frontend, mobile, infra/légal, hygiène), qui **remplacent** `docs/archive/AUDIT-2026-08-09.md` et `docs/archive/RAPPORT-FINAL-2026-08-09.md` (ces deux rapports affirmaient « 0 vulnérabilité » et « production ready » : c'était faux).
> **État réel relevé le 2026-10-03 sur `claude/zen-mendel-xq6nkb` (HEAD `898cf26`), à partir du code et de l'historique, pas des déclarations.** Le tableau du [§0.2](#02-état-davancement-source-unique) est la **seule** source de vérité sur l'avancement ; le reste du document décrit les tâches (§4), les décisions (§3) et le déploiement (§5).

---

## 0. Situation au 2026-10-03

### 0.1 Résumé

Les cinq constats bloquants de l'audit initial sont traités dans le code : l'élévation en opérateur est corrigée, l'URL d'API est unique, les rappels (scheduler, e-mail, Web Push, push natif, notifications locales) existent réellement, la conformité RGPD est en place (export, suppression, registre, purge, consentement) et l'application mobile existe sous forme de socle Capacitor 7 (projets natifs à générer). S'y ajoutent des chantiers hors plan initial : mode invité, refonte du design, agenda et abonnement calendrier, achats intégrés RevenueCat, communauté (fermée par défaut) et enrichissement de ≈ 1 500 fiches.

**Ce qui sépare l'application d'une mise en ligne publique n'est plus du code mais des actions du propriétaire** ([§0.3](#03-actions-du-propriétaire)) : la CI GitHub ne démarre plus (quota Actions du dépôt privé), le secret de migration Neon, les services Render et Netlify, un prestataire d'e-mail, les textes légaux (`[À COMPLÉTER]`, relecture juridique) et, pour les stores, les comptes développeurs, les produits RevenueCat, Firebase et APNs.

Dernier relevé des contrôles (exécutés localement, la CI étant bloquée ; non rejoués pour cette mise à jour documentaire) : backend 1 093/1 093 tests (commit `93e5bc9`), lint backend à 0 erreur sur `src/` **et** `test/` (bloquant en CI), lint frontend à 0 erreur, 480/480 tests jest frontend, smoke Playwright 172/172 avec axe bloquant, `npm audit` à 0 vulnérabilité, migrations sans drift.

Notes de l'audit initial, conservées comme historique (elles ne sont plus à jour) :

| Domaine | Note à l'audit du 2026-10-02 | Cible |
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
- **Jalon 1 : Web public v1.0.** Vagues 0 à 5 et 7 (code essentiellement livré ; reste la mise en ligne et le légal).
- **Jalon 2 : Stores v1.1 (Android + iOS).** Vague 6. Les comptes développeurs (délais administratifs) sont sur le chemin critique.

### 0.2 État d'avancement (source unique)

Légende : ✅ fait (code présent, vérifié dans le dépôt) · 🟡 partiel (le manque est indiqué) · ⏳ à faire · ✖ abandonné (raison indiquée) · 👤 action du propriétaire requise (voir §0.3). Un ✅ ne dit rien de la mise en service : tout ce qui touche Render, Netlify, Neon, les stores et les prestataires est à vérifier côté propriétaire. Aucun test sur appareil n'a eu lieu : les projets natifs n'existent pas encore.

| ID | Item | État | Détail, ce qui manque |
|---|---|---|---|
| **Vague 0 — Urgences sécurité** | | | |
| W0-01 | Rôles et e-mails normalisés | ✅ | `User.role`, e-mails en minuscules, index unique, CLI `operator:set`. Après la migration, **aucun compte n'est opérateur** (§0.5). |
| W0-02 | URL d'API unique | ✅ | `frontend/src/lib/config.ts`, plus de branche LAN dans le bundle de production. |
| W0-03 | Dépendances vulnérables | ✅ | `npm audit` à 0 au dernier relevé ; Dependabot : correctifs de sécurité seulement (mises à jour de version désactivées pour économiser les minutes Actions ; à faire à la main, regroupées). À rejouer avant la mise en ligne. |
| W0-04 | Secrets et valeurs par défaut de prod | 🟡 | Joi de production (`JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`), jeton de reset haché, compose durci : fait. **`MAIL_HOST` n'est pas obligatoire en production** : sans SMTP, aucun e-mail ne part (reset, vérification, rappels par e-mail). À rendre obligatoire une fois le prestataire choisi (D-06). |
| W0-05 | Seed de prod propre | ✅ | Magasins factices retirés, gardes `NODE_ENV=production` sur les scripts de dev. Base déjà seedée avec les anciens magasins : requête de purge dans [RUNBOOK.md § 6.6](RUNBOOK.md#66-seed-du-catalogue--idempotence-et-nettoyage-dune-base-ancienne). |
| W0-06 | Page QR publique sûre | ✅ | Opt-in (`publicEnabled`, `publicFields`), lien révocable, URL construite côté backend. |
| W0-07 | DoS des notifications, farming de points | ✅ | DTO bornés, plafond d'événements, crédit atomique. |
| W0-08 | Amplification, rate limiting, cache | ✅ | Throttler global (300 req/min/IP depuis le 2026-10-03 : une fiche animal fait ~17 requêtes et l'IP est souvent partagée ; l'auth garde 10/min), API externes 20/min, onglet Alimentation (`/food/species/:name`) 120/min, catalogue `/species/*` 300/min, limites `/gateway/search`, cache LRU borné. |
| **Vague 1 — Fondations** | | | |
| W1-01 | Sessions robustes | ✅ | Refresh tokens opaques rotatifs (familles, détection de réutilisation), access token de 30 min, `logout` / `logout-all`, `tokenVersion`. |
| W1-02 | Client API frontend unique | 🟡 | `request<T>()` avec timeout, `ApiError`, refresh automatique : fait. `login` et `register` passent encore par `safeFetch`, hors de `request()`. |
| W1-03 | Observabilité | ✅ | Logs pino JSON expurgés, `x-request-id`, Sentry (backend et navigateur, release, scrub), `/health` + `/health/ready`, `HEALTHCHECK` Docker. Pas de tunnel Sentry (`withSentryConfig` non utilisé). DSN à fournir : 👤. |
| W1-04 | Résilience des API externes | ✅ | Client HTTP unique, retry GBIF, disjoncteur par fournisseur (implémentation interne), replis locaux. |
| W1-05 | Pagination et tri stable | 🟡 | Backend : `limit` ≤ 100 et tri stable. **Le frontend ne pagine pas** : au-delà de 100 éléments d'une liste, les suivants ne s'affichent pas. |
| W1-06 | Tests stables et CI bloquante | ✅ | `ci.yml` : tests backend (e2e inclus), `tsc`, build, Docker, ESLint frontend, garde-fou des styles, smoke Playwright, audit ; CodeQL (`codeql.yml`) et Dependabot. CI ciblée depuis le 2026-10-03 (job `changes` : jobs backend ou frontend seulement si concernés, rien sur une PR en brouillon) pour économiser les minutes Actions. Protection de la branche `main` : à activer (non vérifiable depuis le dépôt) : 👤. |
| W1-07 | Dette lint et code mort | ✅ | Lint backend (`src/` + `test/`, `npm run lint:check`) à 0 erreur, **bloquant en CI** (`lint-backend`) ; lint frontend bloquant. Code mort retiré le 2026-10-03 : `frontend/src/i18n.ts` et `frontend/src/i18n/request.ts` (réexports dépréciés, aucun import), module backend `database-optimization` (statistiques jamais alimentées, chargé seulement avec Redis), dépendance frontend `axios` (aucun import). |
| W1-08 | Corrections backend diverses | ✅ | Limite d'animaux sans course, abonnement push sûr, anti-énumération. |
| W1-09 | Durcissement du schéma | 🟡 | CHECK, FK, index trigram (migration `20261003010000_schema_hardening`). La migration vers `prisma.config.ts` n'est pas faite (le bloc `prisma` de `backend/package.json` subsiste). |
| **Vague 2 — Légal et compte** | | | |
| W2-01 | Suppression et export de compte | ✅ | `DELETE /users/me`, `GET /users/me/export`, boutons dans les paramètres, page publique `/suppression-compte`. |
| W2-02 | Pages légales et footer | 🟡 | Mentions, confidentialité, CGU, sources et licences, transparence, footer global : faits en **FR et EN** ; les quatre autres langues reçoivent la version anglaise. **9 champs `[À COMPLÉTER]`** dans `frontend/src/lib/legal.ts`, relecture juridique à faire : 👤. La politique et les CGU ne mentionnent pas encore les achats intégrés (RevenueCat), le push natif (Firebase) ni la communauté. CGV : sans objet (pas de vente sur le web). |
| W2-03 | Consentement à l'inscription | 🟡 | Cases CGU et âge ≥ 15 ans, `termsAcceptedAt` et `termsVersion` enregistrés. Pas de re-consentement quand la version change. |
| W2-04 | Vérification d'e-mail | ✅ | Jeton haché, renvoi limité, bandeau, page `verifier-email` ; opérateur, lien public et modération réservés aux comptes vérifiés. L'envoi dépend d'un SMTP configuré (W0-04). |
| W2-05 | Affiliation conforme | ✅ | `rel="sponsored"` sur les liens des magasins. La mention « Partenaire Amazon » est sans objet : Amazon est retiré (W3-05). |
| W2-06 | Attributions et licences | 🟡 | Attribution Wikipédia (CC BY-SA 4.0), GBIF, ODbL (Open Food Facts) affichées. Le bloc Wikipédia ne s'affiche que si `sourceUrl` pointe vers wikipedia.org (Wikidata pour une part des fiches) : origine réelle des extraits à vérifier ; audit des licences GBIF à l'import non retrouvé. |
| W2-07 | Page transparence véridique | ✅ | Alignée sur les fonctions réelles, traduite. |
| W2-08 | Registre, rétention, purge | 🟡 | `docs/legal/registre-traitements.md` (T1 à T13), purge quotidienne (jetons, événements de rappel, invités, jetons d'appareil, journal de modération), analytics sans `userId` en query. Comptes inactifs de plus de 36 mois : procédure **manuelle** (`docs/RUNBOOK.md` §6.4). DPA non signés, durée de `PaymentEvent` non fixée : 👤. |
| **Vague 3 — Fonctions cœur** | | | |
| W3-01 | E-mails transactionnels | 🟡 | `MailService` (nodemailer, retry en ligne), gabarits **fr/en** seulement (les autres langues reçoivent l'anglais), pas de file. Aucun prestataire configuré, SPF/DKIM/DMARC à poser : 👤. |
| W3-02 | Scheduler de rappels | ✅ | Cron 5 min, verrou consultatif Postgres, `User.timezone`, anti-doublon, `deliveryChannel`, fréquences ancrées sur la date de départ. |
| W3-03 | Web Push réel | ✅ | `web-push` + VAPID, purge 404/410, clé publique servie par l'API, `sw.js`. Sans clés VAPID, le push est désactivé : 👤. |
| W3-04 | Paiement web Stripe | ✖ | Abandonné : le premium est vendu **uniquement par achats intégrés** (RevenueCat, voir W6-08 et `docs/PAYMENTS.md`). `POST /users/me/subscription` répond 501 ; aucune CGV. Décisions D-04 et D-05 révisées. |
| W3-05 | Stubs externes | ✅ | Amazon retiré (route `/amazon/*` en 404) ; Species+ réel mais désactivé sans `SPECIESPLUS_API_TOKEN` ; PubMed réel. |
| **Vague 4 — Frontend** | | | |
| W4-01 | Navigation i18n | ✅ | Navigation `next-intl`, sélecteur de langue (retour EN → FR corrigé). |
| W4-02 | Erreurs, 404, rendu statique | ✅ | `error.tsx`, `global-error.tsx`, `not-found.tsx`, rendu statique par locale. |
| W4-03 | i18n complète | ✅ | 6 langues, test de parité (`i18n-parity.test.ts`) ; **pt = portugais européen (pt-PT, AO90)**. Hors documents légaux (voir W2-02). |
| W4-04 | SEO | 🟡 | Métadonnées traduites, hreflang, canonical, image OpenGraph par langue, JSON-LD, `sitemap.ts`, `robots.ts`. **Le sitemap ne liste pas les fiches espèces** (TODO dans `sitemap.ts`, endpoint d'identifiants à créer). |
| W4-05 | Accessibilité | 🟡 | Modales Radix (`ui/Modal`, plus de modale écrite à la main), lien d'évitement, contrastes, axe bloquant (« serious ») en CI. Déclaration d'accessibilité non rédigée. |
| W4-06 | PWA et ergonomie mobile | 🟡 | Manifeste, icônes 192/512/maskable, `viewport`, safe-area, `dvh`. Page hors ligne et cache du shell (Serwist) non faits ; logo et icônes **provisoires** (D-15). |
| W4-07 | Performance | 🟡 | Page animal découpée (4 699 → 719 lignes, sections chargées à la demande), compression des photos ; `public/` nettoyé (`themes/`, `badges/` et images du gabarit Next, sans référence, retirés le 2026-10-03). Budget JS ≤ 170 Ko et Lighthouse mobile ≥ 90 **non mesurés**. |
| W4-08 | CSP stricte | ✅ | Sans `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, HSTS ; hachages SHA-256 par page en export mobile ; `vercel.json` supprimé. Écart assumé et documenté : pas de nonce, `'unsafe-inline'` reste dans `script-src` du web (`docs/DEPLOY.md` §10). |
| W4-09 | E2E Playwright fiables | 🟡 | Smoke déterministe (API mockée, axe), projets bureau et mobile, bloquant en CI. Scripts `frontend/e2e-*.js` supprimés (2026-10-03). Reste : suites héritées `e2e/integration/` (20 `waitForTimeout`, projets `chromium` / `Mobile Chrome` de `playwright.config.ts`, hors CI, backend réel) et `e2e/manual-modals-flow.spec.ts` (`npm run test:modals`) : à réécrire sur le modèle du smoke ou à supprimer. |
| **Vague 5 — Contenu** | | | |
| W5-01 | Seed complet et vérifiable | ✅ | Races dans le seed, `seed:breeds`, test de comptages, `semi-solitaire` corrigé. 2026-10-03 (B1) : les sections des races, recopiées d'un modèle générique parfois d'un autre animal (chats « herbivores » au modèle lapin), sont retirées de `breeds-data.json` et de la base (migration `20261003200000_breeds_template_sections_cleanup`) ; l'API sert à une race les sections de son espèce parente (même nom scientifique) ; l'import refuse une section non sourcée, générique ou incompatible avec l'espèce (`prisma/validation.ts`). |
| W5-02 | Curation des fiches | 🟡 | Enrichissement sourcé, contre-vérifié (`VERIFY.md`) et contrôlé mécaniquement (`backend/prisma/enrichment/check_quotes.py` : citations retrouvées dans les pages sources). Dernier relevé (commit `93e5bc9`) : **1 401 fiches complètes sur 1 510**, soit ≈ 109 incomplètes. Sections législation marquées `needsReview` : relecture humaine (vétérinaire / juriste) à faire : 👤. |
| W5-03 | Reproduction par espèce | 🟡 | L'import de la reproduction existe (`import-enrichment.ts`) ; couverture non mesurée, nombreuses fiches sans (`enrichment/gaps.json`). P2. |
| W5-04 | Date de vérification | ✅ | `lastReviewedAt` posé à l'import, « Fiche vérifiée le… » affiché. |
| **Vague 6 — Mobile (Capacitor 7)** | | | |
| W6-01 | Comptes développeurs | 👤 | Apple Developer + Google Play en organisation (D-U-N-S), contrats et fiscalité. Chemin critique. |
| W6-02 | Export statique `MOBILE_BUILD` | ✅ | `npm run build:mobile`, routes à query, `localePrefix: 'always'`, CSP en `<meta>`. |
| W6-03 | Initialisation de Capacitor | 🟡 | Capacitor 7, `capacitor.config.ts`, plugins installés. **Projets natifs non générés** (`npx cap add android` / `ios` à faire, puis à versionner) . Origines `capacitor://localhost` et `https://localhost` ajoutées à `CORS_ORIGIN` dans `render.yaml` (à reporter à la main si le service Render n'a pas été créé par le Blueprint). |
| W6-04 | Stockage sécurisé des jetons | ✅ | `tokenStorage` : Preferences sur natif, `localStorage` sur le web. |
| W6-05 | Couche plateforme | 🟡 | `openExternal`, caméra / galerie, partage du carnet : code et tests jest. Non testé sur appareil ([MOBILE.md § 9](MOBILE.md#9-checklist-stores)). |
| W6-06 | Rappels en notifications locales | 🟡 | `local-reminders.ts`, explication préalable, hors ligne. Non testé sur appareil ; `appRestoredResult` Android non géré (photo perdue si l'app est tuée pendant la prise de vue). |
| W6-07 | Push distant FCM / APNs | 🟡 | **Code livré le 2026-10-03** : `DeviceToken` (migration `20261003120000_device_tokens`), `POST/DELETE /users/me/device-tokens`, FCM HTTP v1 sans SDK, `PushDispatcher` (Web Push + natif) branché sur le scheduler avec anti-doublon des rappels locaux, purges (jeton invalide, déconnexion, suppression de compte, 270 jours), export RGPD, app (`native-push.ts`, `NotificationPrimer`, deep link). **Reste au propriétaire** : projet Firebase, `google-services.json`, `GoogleService-Info.plist`, clé APNs, capacités Xcode et `AppDelegate`, `FCM_SERVICE_ACCOUNT_JSON` sur Render, puis `NATIVE_PUSH=1` ; test sur appareil ([MOBILE.md § 7.3](MOBILE.md#73-push-natif-fcm--apns-w6-07)) : 👤. |
| W6-08 | Achats intégrés (RevenueCat) | 🟡 | Backend : webhook idempotent `/webhooks/revenuecat`, `Subscription` / `PaymentEvent`, `EntitlementService` ; app : paywall conforme (restauration, prix lus dans le store), activation confirmée par le backend ; page abonnement web sans achat. **À faire** : produits et prix dans les stores et RevenueCat, clés, `IAP_ENABLED`, test Sandbox : 👤 ([PAYMENTS.md](PAYMENTS.md)). |
| W6-09 | Universal Links / App Links | 🟡 | Routes `/.well-known/apple-app-site-association` et `assetlinks.json`, `deep-links.ts`. **À faire** : `APPLE_TEAM_ID` et `ANDROID_SHA256_CERT_FINGERPRINTS` sur Netlify, Associated Domains, `intent-filter` : 👤 ([MOBILE.md § 8](MOBILE.md#8-universal-links--app-links-w6-09)). |
| W6-10 | Icônes, splash, fiches store | 🟡 | Sources d'icônes et de splash, fiches FR/EN, script de captures (`docs/store/`). Logo définitif (D-15) et graphique Play 1 024 × 500 manquants ; `npm run assets:mobile` à lancer après `cap add`. |
| W6-11 | Déclarations de confidentialité et d'âge | 🟡 | Réponses rédigées (App Privacy, Data Safety, classification d'âge, `PrivacyInfo.xcprivacy`) dans `docs/store/`. Saisie dans les consoles : 👤. |
| W6-12 | CI mobile et crash reporting | 🟡 | `mobile.yml` (manuel) : export, APK de debug, AAB signé optionnel, iOS limité à `cap sync`. fastlane et `@sentry/capacitor` **non installés** ([MOBILE.md § 13](MOBILE.md#13-à-venir-non-installé--fastlane-et-sentrycapacitor)). |
| W6-13 | Préparation de la relecture | ⏳ | Compte de démo, sandbox IAP, TestFlight, test fermé Play. |
| W6-14 | Soumission aux stores | ⏳ | Dépend de W6-01, W6-08, W6-10, W6-11, W6-13. |
| **Vague 7 — Infra et mise en ligne** | | | |
| DEP-01 | Pipeline à build automatique | 🟡 | Dépôt prêt : `render.yaml` (`autoDeployTrigger: checksPass`), job `migrate-production` dans `ci.yml` (garde sur le secret), `deploy.yml` réduit au seed manuel, `netlify.toml`. **Liaison Render / Netlify, secret `NEON_DATABASE_URL_DIRECT` et CI : 👤** (non vérifiables depuis le dépôt). |
| DEP-02 | Domaine et HTTPS | 👤 | Domaine non choisi (D-03) ; le site est prévu sur `https://captivia-app.netlify.app`. |
| DEP-03 | Sauvegardes et PRA | 🟡 | `backup.yml` hebdomadaire (pg_dump chiffré `age`, artefact GitHub de 30 jours), scripts, `docs/RUNBOOK.md` §3. Pas de stockage externe (R2) ; secret `BACKUP_AGE_RECIPIENT` à créer ; test de restauration jamais fait : 👤. |
| DEP-04 | Supervision | 👤 | `/health/ready` existe. Monitor UptimeRobot et alertes Sentry à créer à la main (`docs/RUNBOOK.md` §1.2). |
| DEP-05 | Staging | ⏳ | Aucune branche Neon `staging` ni API de staging. |
| DEP-06 | Docker et compose | 🟡 | `HEALTHCHECK` backend, compose durci. Pas de `docker-compose.prod.yml` (P2). |
| DEP-07 | Versionnage | ✅ | `release-please` (`release.yml`, manifeste), lancé **à la main** depuis le 2026-10-03 (Actions → Release) pour ne plus relancer la CI à chaque fusion. Réglage « Allow GitHub Actions to create and approve pull requests » : 👤. |
| DEP-08 | Runbooks | ✅ | `docs/DEPLOY.md`, `docs/RUNBOOK.md`. |
| DEP-09 | Test de charge | ⏳ | Dépend du staging. |
| DEP-10 | Scalabilité | ⏳ | P2, après le lancement. |
| **Vague H — Hygiène** | | | |
| WH-01 | README et guide des agents | ✅ | `README.md` réécrit (produit, démarrage local, liens, statut) ; `AGENTS.md` (guide canonique : règles, carte, commandes de vérification) et `CLAUDE.md` (renvoi) ajoutés le 2026-10-03 ; `backend/README.md` et `frontend/README.md` remis à jour. |
| WH-02 | Archivage des audits | ✅ | `docs/archive/` : audits du 2026-08-09, `plan-api.md` et `DEPLOY-NOTES-seed.md` (archivés le 2026-10-03, contenu utile repris dans `docs/RUNBOOK.md` § 6.6). |
| WH-03 | README frontend | ✅ | `frontend/README.md` réécrit. |
| WH-04 | Fichiers inutiles, ports | ✅ | `start.bat` et `.cursorindexingignore` supprimés, ports alignés. Le 2026-10-03 : `scripts/vercel-open.js` (et le script `vercel:open`), `scripts/start.js`, `start-db.sh`, `stop-db.sh`, `verify-implementation.js`, `api-functional-test.py`, `i18n_propagate.py`, `frontend/scripts/i18n_module_{a,c}.py` et `frontend/e2e-*.js` supprimés (aucune référence, obsolètes). |
| WH-05 | `.nvmrc` et `engines` | ✅ | Node 22 ; `engines` dans les trois `package.json`. |
| WH-06 | Fichier `LICENSE` | ⏳ | Absent (D-13) ; `backend/package.json` déclare `UNLICENSED`. À trancher avant tout passage du dépôt en public. |
| WH-07 | Issues du backlog | ⏳ | Aucune issue ouverte dans le dépôt GitHub. |
| **Hors plan initial** | | | |
| PRD-01 | Vision produit et message | ✅ | `docs/PRODUCT.md`, `docs/MESSAGING.md` ; **D-16 validée** (carnet complet pour l'animal unique de l'invité et du compte gratuit). |
| GST-01 | Mode invité | ✅ | `POST /auth/guest`, `POST /auth/upgrade` (conversion sans perte), 1 animal, bandeau, emplacement verrouillé, purge à 90 jours. |
| DES-01 | Refonte du design | ✅ | Direction « carnet de terrain » (`frontend/docs/DESIGN.md`), `AppShell` (onglets mobile / barre latérale PC), tableau de bord « Aujourd'hui », fiches « planche », landing en entonnoir avec 15 photos Commons créditées, garde-fou CI des motifs de style interdits. |
| DES-02 | Fin de `SiteChrome` | ✅ | Composant supprimé ; un cadre par groupe de routes : `(app)`, `(marketing)`, `(auth)`. |
| AGD-01 | Agenda des soins et carnet | ✅ | Agenda multi-animaux, abonnement calendrier ICS (jeton révocable), carnet de santé imprimable / partageable. |
| COM-01 | Communauté (volet social) | 👤 | **Code livré, fermée par défaut** (`COMMUNITY_ENABLED=false`, routes en 404) : profils, publications, commentaires, réactions, signalements, modération DSA (seuil de masquage réservé aux membres établis, signalants informés, recours atomique), médias WebP sans EXIF sur stockage S3 / R2, RGPD, correctifs issus de la revue de sécurité ; interface du fil, de la modération et des recours ; règles de communauté dans l'app. **À faire avant ouverture** : §0.3, bloc E. |
| CNT-01 | Contenu des espèces | 🟡 | Voir W5-02 et W5-03. |

### 0.3 Actions du propriétaire

Dans l'ordre. Les blocs A à C conditionnent la mise en ligne du web ; D conditionne les stores ; E l'ouverture de la communauté.

**A. Débloquer la CI (bloquant)**
1. **Quota ou facturation GitHub Actions** : la CI ne démarre plus (quota des 2 000 min/mois du dépôt privé). Soit régler la facturation ou relever le quota, soit passer le dépôt en **public** (minutes gratuites). Avant un passage en public : trancher la licence (D-13, `LICENSE` absent) et relire le dépôt (secrets, documents internes).
2. Activer la **protection de `main`** (PR obligatoire, checks requis : [DEPLOY.md § 3.5](DEPLOY.md#35-protection-de-main)) et le réglage « Allow GitHub Actions to create and approve pull requests » (release-please).

**B. Mise en ligne (Neon, Render, Netlify)** — pas à pas dans [DEPLOY.md § 3](DEPLOY.md#3-mise-en-place-pas-à-pas)
3. Secret GitHub **`NEON_DATABASE_URL_DIRECT`** : l'URL **directe, non poolée** (hôte sans `-pooler`), valeur seule sans `psql` ni guillemets. Sans lui, `migrate-production` s'arrête avec un avertissement et **aucune migration n'est appliquée**. Créer aussi l'environnement GitHub `production`.
4. **Render** : Blueprint `render.yaml`, `DATABASE_URL` = URL Neon **poolée** + `pgbouncer=true`, déclencheur « After CI checks pass ». **Netlify** : projet relié au dépôt (site `https://captivia-app.netlify.app`), variable `NEXT_PUBLIC_API_URL` = URL de l'API Render pour les contextes Production et Deploy Previews. Puis lancer « Seed production » (Actions) et promouvoir le premier opérateur (§0.5).
5. **E-mail** (aujourd'hui aucun e-mail ne part) : choisir et configurer le prestataire (D-06, Brevo recommandé), variables `MAIL_*` sur Render, SPF / DKIM / DMARC sur le domaine d'envoi.
6. **Web Push** : `npm run vapid:generate` (dossier `backend/`), puis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` sur Render.
7. **Observabilité et supervision (DEP-04)** : projets Sentry en région UE (`SENTRY_DSN` sur Render, `NEXT_PUBLIC_SENTRY_DSN` sur Netlify) et règles d'alerte ; monitor **UptimeRobot** sur `<API>/health` toutes les 5 minutes (alerte et maintien en éveil de Render Free) ; suivi des quotas Render, Neon et Netlify.
8. **Sauvegardes** : générer la paire de clés `age`, secret `BACKUP_AGE_RECIPIENT`, conserver la clé privée hors du dépôt, puis faire un test de restauration ([RUNBOOK.md § 3.4](RUNBOOK.md#34-test-de-restauration-sur-une-branche-neon-jetable)).
9. **Domaine (D-03)** : à choisir ; mettre à jour `CORS_ORIGIN`, `FRONTEND_URL`, `PUBLIC_WEB_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.

**C. Légal et données**
10. **Identité de l'éditeur (D-01)** : renseigner les 9 champs `[À COMPLÉTER]` de `frontend/src/lib/legal.ts` (raison sociale, forme et capital, SIREN, TVA, adresse, téléphone, directeur de publication, e-mail de contact, prestataire e-mail).
11. **Relecture par un juriste** des pages légales (FR et EN ; les quatre autres langues affichent l'anglais) ; compléter la politique de confidentialité (achats intégrés RevenueCat / Apple / Google, push natif Firebase, communauté T13) et les CGU.
12. **DPA des sous-traitants** ([registre § 7](legal/registre-traitements.md#7-accords-de-sous-traitance-dpa-à-signer)) : Neon, Render, Netlify, Brevo, Sentry, GitHub, RevenueCat (avant `IAP_ENABLED=true`), Cloudflare (avant la communauté) ; vérifier aussi la ligne Google (FCM) du registre.
13. **Durée de conservation de `PaymentEvent`** (avec l'expert-comptable) ; confirmer les 36 mois d'inactivité, le préavis et la fréquence de revue ([registre § 8](legal/registre-traitements.md#8-points-à-décider-ou-compléter-par-le-propriétaire)).
14. **Relecture humaine** (vétérinaire, juriste) des sections législation et santé des fiches avant mise en avant.

**D. Stores et mobile** (Jalon 2)
15. **Comptes Apple Developer et Google Play en organisation** (D-12, D-U-N-S), contrats « Paid Apps » et fiscalité (W6-01).
16. **RevenueCat et produits** ([PAYMENTS.md](PAYMENTS.md)) : abonnements mensuel et annuel dans App Store Connect et la Play Console, **prix à fixer par le propriétaire**, projet RevenueCat, entitlement `premium`, webhook ; variables Render `IAP_ENABLED`, `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_ENTITLEMENT_ID`, `GOOGLE_PLAY_PACKAGE_NAME` ; variables GitHub `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY` ; test Sandbox.
17. **Firebase et APNs** ([MOBILE.md § 7.3](MOBILE.md#73-push-natif-fcm--apns-w6-07)) : projet Firebase, `google-services.json` (secret `GOOGLE_SERVICES_JSON_BASE64`), `GoogleService-Info.plist`, clé APNs `.p8`, capacités Xcode, `AppDelegate`, `FCM_SERVICE_ACCOUNT_JSON` sur Render ; poser `NATIVE_PUSH` seulement ensuite.
18. **Projets natifs** : `npx cap add android` / `ios`, versionner, vérifier que `CORS_ORIGIN` sur Render contient `capacitor://localhost` et `https://localhost` ([MOBILE.md § 5](MOBILE.md#5-cors-backend)), `APPLE_TEAM_ID` et `ANDROID_SHA256_CERT_FINGERPRINTS` sur Netlify, Associated Domains et `intent-filter`.
19. **Logo définitif (D-15)** et graphique de présentation Play ; saisie des fiches et des déclarations dans les consoles ([store/README.md](store/README.md)) ; URL des fiches (`NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`) ; compte de démo ; TestFlight et test fermé Play.

**E. Ouverture de la communauté** (`COMMUNITY_ENABLED`, seulement une fois la modération prête)
20. Publier les CGU complétées et la politique (T13) ; désigner le point de contact DSA (`COMMUNITY_CONTACT_EMAIL`) et le délai cible de traitement des signalements et des recours ; valider les 365 jours du journal de modération ; prévoir la procédure de signalement aux autorités ([RUNBOOK.md § 9](RUNBOOK.md#9-modération-de-la-communauté)) ; identifier les opérateurs (e-mail vérifié).
21. Créer le bucket **Cloudflare R2** (juridiction UE), signer le DPA Cloudflare, renseigner `MEDIA_DRIVER=s3` et les variables `S3_*` / `MEDIA_*` ([DEPLOY.md](DEPLOY.md#communauté--stockage-des-médias-cloudflare-r2)), puis `COMMUNITY_ENABLED=true` (Render) et `NEXT_PUBLIC_COMMUNITY_ENABLED=true` + `NEXT_PUBLIC_MEDIA_BASE_URL` (Netlify).

**Décisions encore ouvertes** : D-01, D-03, D-06, D-12, D-13, D-14, D-15 (§3).

### 0.4 Historique condensé

- **2026-10-02, sprint initial** (20 agents + 1 revue Opus) : vagues 0 à 2 et socle des vagues 3 à 5 ; 11 constats de revue corrigés (migration CI après tous les checks, anti-antidatage des points, jeton après changement de mot de passe, scrub Sentry, export RGPD complet…). Seed de production vérifié sur base vierge.
- **Soirée du 2026-10-02, vague « niveau complet »** : refresh tokens, vérification d'e-mail, Web Push, modales Radix, découpe de la page animal, E2E fiables, socle Capacitor, agenda ICS, sauvegardes chiffrées, release-please. Enrichissement des fiches : ~70 agents rédacteurs, contre-vérification obligatoire par des agents Sonnet (nombreuses hallucinations corrigées ou retirées : statuts légaux inventés, espèces protégées présentées « sans restriction », maladies inexistantes, sources génériques) ; seuls les lots ayant un rapport `verify/<LOT>.json` sont importés, sources https obligatoires, législation marquée `needsReview`.
- **Nuit du 2-3 octobre, vague « produit et design »** : revues Opus backend (12 constats) et frontend (15 constats) corrigées, produit (D-16), mode invité, refonte design, résilience des API externes, durcissement du schéma, purge RGPD, CSP stricte, rappels locaux et deep links, lots d'enrichissement H001-H011 (citations contrôlées mécaniquement).
- **2026-10-03** : lint backend résorbé (1 908 → 0 erreur, bloquant, `test/` inclus), préparation des stores, achats intégrés RevenueCat (Stripe abandonné), communauté (backend, interface, modération DSA, correctifs de sécurité), pt-PT, suppression de `SiteChrome`, push natif FCM / APNs (W6-07) ; guide `AGENTS.md`, README réécrit, documents périmés archivés et code mort retiré (W1-07, WH-01, WH-04).

### 0.5 Points d'attention et changements de contrat

**À traiter**
- Listes API bornées à 100 éléments (W1-05) sans pagination côté interface.
- Logo et icônes **provisoires** (`frontend/public/brand/`, D-15).
- `SpeciesProfile.sourceUrl` pointe vers Wikidata (CC0) pour une part des fiches : vérifier l'origine des extraits (W2-06).
- Sans SMTP, aucun e-mail (reset de mot de passe, vérification, rappels) ne part ; la vérification d'e-mail bloque alors l'accès aux fonctions réservées.

**À connaître avant le premier déploiement**
- Après la migration `20261002100000_auth_roles_sessions`, **aucun compte n'est opérateur** : `cd backend && DATABASE_URL=<URL Neon directe> npm run operator:set -- <email>` depuis un poste de développement (l'image runtime n'a pas les scripts). Le compte doit avoir un e-mail vérifié.
- `/auth/register` exige `acceptTerms: true` et `ageConfirmed: true` ; mots de passe de 10 à 128 caractères ; `change-password` renvoie un nouvel `accessToken`.
- En production, l'API **refuse de démarrer** sans `JWT_SECRET` (≥ 32 caractères, non-exemple), `CORS_ORIGIN` et `FRONTEND_URL` (https) ; avec `IAP_ENABLED=true` sans `REVENUECAT_WEBHOOK_SECRET` ; avec `COMMUNITY_ENABLED=true` sans stockage S3. Variables : [DEPLOY.md § 5](DEPLOY.md#5-matrice-des-variables-denvironnement).
- Le lien public d'un animal est en opt-in (les liens existants restent actifs, sans données de santé).
- Maintien en éveil de l'API Render : monitor **UptimeRobot** (le dépôt étant privé, pas de cron GitHub Actions).

---

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

## 2. État des lieux de l'audit initial (2026-10-02, historique)

> Photographie prise avant les travaux : **ces mesures ne sont plus à jour** (voir [§0](#0-situation-au-2026-10-03) pour l'état réel). Elle est conservée pour la traçabilité des constats cités dans les tâches et l'annexe A.

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

## 3. Décisions du propriétaire

| ID | Décision | Recommandation par défaut | Bloque | Statut au 2026-10-03 |
|---|---|---|---|---|
| D-01 | Structure juridique : raison sociale, SIREN, directeur de publication, TVA | — (à fournir) | W2-02 | Ouverte 👤 : les champs `[À COMPLÉTER]` de `legal.ts` attendent ces informations |
| D-02 | Hébergement | **Netlify (front) + Render Free Frankfurt (API) + Neon Free Frankfurt (DB)**. Passer Render en Starter dès que le trafic le justifie (fin de la mise en veille) | §5 | Retenue : `render.yaml`, `netlify.toml`, jobs de migration (mise en service à vérifier côté propriétaire) |
| D-03 | Nom de domaine | `captivia.<tld>` (front) + `api.captivia.<tld>` | DEP-02 | Ouverte 👤 : site prévu sur `https://captivia-app.netlify.app` |
| D-04 | Monétisation au lancement web | **Lancer v1.0 sans premium payant** (page abonnement en « bientôt »), puis Stripe en v1.0.x. Évite CGV, rétractation et TVA au J0 | W3-04 | **Révisée** : pas de Stripe ; le premium passe par les achats intégrés des stores (voir D-05) ; le web n'a aucun achat |
| D-05 | Prestataire de paiement | Stripe Billing (web) + RevenueCat (stores), ou Paddle / Lemon Squeezy comme *merchant of record* pour la TVA UE | W3-04, W6-08 | **Tranchée** : RevenueCat seul (achats intégrés Apple et Google), Stripe abandonné (W3-04 ✖) ; `docs/PAYMENTS.md` |
| D-06 | Prestataire e-mail | Brevo (UE, offre gratuite de 300 mails/jour) avec SPF, DKIM et DMARC | W3-01 | Ouverte 👤 : aucun prestataire configuré, donc aucun e-mail envoyé |
| D-07 | Âge minimum | 15 ans (consentement numérique en France) | W2-03 | Appliquée : 15 ans, case à l'inscription |
| D-08 | Partage public des animaux (QR) | Garder, en **opt-in** avec champs choisis et lien révocable | W0-06 | Appliquée : opt-in, lien révocable |
| D-09 | Affiliation | Amazon.fr seul au lancement. Vérifier la migration PA-API 5 vers Creators API | W2-05, W3-05 | **Révisée** : Amazon retiré (W3-05) ; liens d'affiliation via `AffiliateStore` ; à rouvrir quand un compte Associates est validé |
| D-10 | Textes Wikipédia | Garder avec attribution CC BY-SA visible (ou réécrire à terme) | W2-06 | Appliquée : attribution CC BY-SA affichée (réserve : W2-06) |
| D-11 | Stratégie mobile | **PWA + Capacitor 7** (export statique embarqué, sans `server.url`). Expo est écarté (coût ×4) | Vague 6 | Appliquée (Capacitor 7, export statique embarqué) |
| D-12 | Comptes stores | Apple Developer (99 $/an) et Google Play (25 $) en **Organisation** (D-U-N-S) pour éviter la règle des 12 testeurs pendant 14 jours | W6-01 | Ouverte 👤 |
| D-13 | Licence du code | Propriétaire (`UNLICENSED`) : ajouter un fichier `LICENSE` explicite | WH-06 | Ouverte : pas de `LICENSE` (WH-06) |
| D-14 | Staging | Oui : branche Neon `staging` + previews Netlify | DEP-05 | Ouverte : pas de staging (DEP-05) |
| D-15 | Logo maître 1024×1024 et charte | À fournir (designer) | W4-06, W6-10 | Ouverte 👤 : logo et icônes provisoires |
| D-16 | Carnet de santé complet pour l'animal unique (invité et compte gratuit) ; le Premium débloque plusieurs animaux | Validée le 2026-10-02 | Mode invité, offre | Appliquée (`docs/PRODUCT.md`) |

---

## 4. Feuille de route par vagues

Format des tâches : **ID · Tâche** — fichiers — action et critères d'acceptation — Prio · Effort · Modèle/effort · Dépendances. Les identifiants entre crochets renvoient aux constats d'audit.

> Les tableaux ci-dessous décrivent les tâches **telles qu'elles étaient spécifiées**. Leur avancement n'y figure pas : il est uniquement au [§0.2](#02-état-davancement-source-unique), où sont aussi consignés les écarts entre la spécification et le code livré.

### Vague 0 — Urgences sécurité et déblocage du déploiement (P0, ~3 j)

| ID | Tâche | Détail et acceptation | Prio · Effort · Modèle | Dép. |
|---|---|---|---|---|
| **W0-01** 🔒 | Rôles et e-mails normalisés [SEC-01, BE-07, M4] | `@Transform(trim+lowercase)` sur les DTO register, login, forgot et reset. Migration : détecter les collisions de casse, puis `lower(email)` et index unique sur `lower(email)` (ou citext). Remplacer la liste `OPERATOR_EMAILS` par un champ `User.role` (`USER`/`OPERATOR`) attribué par seed ou CLI. `effectivePremium` utilisé partout (`animals.service.ts:33`). **Test e2e** : inscription `OP1@EXAMPLE.COM` → 409 ; `/admin/users` → 403 pour un non-opérateur. | P0 · M · **opus high** | — |
| **W0-02** | URL d'API unique [SEC-02, FE-01, MOB-10, MOB-11, MOB-19] | Créer `frontend/src/lib/config.ts` (`API_URL` = `NEXT_PUBLIC_API_URL`, obligatoire en prod ; fallback LAN **seulement** si `NODE_ENV==='development'`). L'utiliser dans `api.ts`, `AuthContext.tsx:30`, `parametres/notifications/page.tsx:59`. Remplacer le message « npm run start:dev » par un message i18n avec bouton Réessayer. `/api/mobile-link` limité au dev. Test jest : hôte non local + env définie → l'URL d'env est utilisée. | P0 · S · sonnet medium | — |
| **W0-03** | Dépendances vulnérables [SEC-03, FE-02, BE-13] | Front : `next ≥ 16.3.6`, `axios` à jour (ou supprimer axios avec `api-client.ts`, code mort). Back : `nodemailer ≥ 10.0.6`, `axios ≥ 1.19.1`, joi, prisma, `@nestjs/*`. Retirer `memcached` et les dépendances front inutilisées (`leaflet`, `react-leaflet`, `qrcode`, `framer-motion`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-query`, `@radix-ui/react-select`) après vérification. `images.unoptimized: true` (aucun `next/image` utilisé). **Acceptation** : `npm audit --omit=dev --audit-level=high` = 0 des deux côtés, build et tests verts. | P0 · M · sonnet medium | — |
| **W0-04** | Secrets et valeurs par défaut de prod [SEC-11, SEC-12, OPS-02, OPS-03, OPS-14, BE-03, BE-05, BE-16] | Joi conditionnel `NODE_ENV=production` : `JWT_SECRET` ≥ 32 caractères avec liste noire des valeurs d'exemple ; `CORS_ORIGIN`, `FRONTEND_URL` (https), `PUBLIC_WEB_URL` obligatoires ; `MAIL_HOST` obligatoire dès W3-01. Ne **jamais** logger le lien de reset en prod ; `sendMail` dans un try/catch avec réponse générique ; stocker `sha256(token)` de reset et purger les expirés. Remplacer `console.error(AxiosError)` par message + statut (fuite du token Species+). Défaut `FRONTEND_URL` → `:3000`. Corriger `api.config.ts:35` (WIKIPEDIA_RATE_WINDOW). Compose : `${JWT_SECRET:?}`, `${POSTGRES_PASSWORD:?}`, Postgres sur `127.0.0.1`. Défaut `HOST` à `0.0.0.0` [BE-19]. `.env.example` racine et backend complets et cohérents. | P0 · M · sonnet medium | — |
| **W0-05** | Seed de prod et identifiants propres [BE-02, BE-21, HYG-03, HYG-04] | Supprimer les 9 magasins `example-*.fr` de `seed-prod.ts:774-850` (et prévoir la requête SQL de purge). Garde `NODE_ENV==='production' → throw` dans `seed-dev.ts` et `backend/scripts/reset-dev-password.ts`. Retirer l'e-mail réel et `Captivia2025` de ce script. Expurger `test@captivia.local / Test1234!` des docs. | P0 · S · haiku low | — |
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
| **W3-04** 🔒 | Paiement web Stripe [BE-04, LEG-05, FE-03] — **abandonné** (remplacé par W6-08, voir §0.2). Spécification d'origine : | Modèle `Subscription` (`status`, `currentPeriodEnd`, `source: stripe|apple|google|manual`). Checkout + Customer Portal. Webhook signé et idempotent. `isPremium` dérivé de `currentPeriodEnd`. Politique de rétrogradation (au-delà de 1 animal : lecture seule). Paywall conforme : prix TTC, renouvellement, rétractation de 14 j avec renonciation expresse, résiliation en 2 clics. **Si D-04 = lancement gratuit** : masquer l'achat (P1 post-lancement). | P1 · XL · **opus high** | D-04, D-05, W2-02 |
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
| **W6-07** | Push distant FCM / APNs [MOB-35 (2)] | Jetons d'appareil (`DeviceToken`), enregistrement et retrait côté API, envoi FCM HTTP v1 (iOS par le relais APNs de FCM), branchement sur le scheduler W3-02 avec anti-doublon des rappels locaux, purges, export RGPD ; côté app, `@capacitor/push-notifications`, explication préalable et deep link au toucher. Configuration Firebase / Apple : `docs/MOBILE.md` § 7.3. | P1 · L · opus medium → sonnet medium | W3-02 |
| **W6-08** 🔒 | Achats intégrés [MOB-30] — seul canal de paiement depuis l'abandon de W3-04 (`docs/PAYMENTS.md`) | RevenueCat (produits mensuel et annuel), webhook vers `Subscription` (source apple/google), paywall conforme (prix, durée, renouvellement auto, Restaurer, liens CGU et Confidentialité). Sandbox testée. Option MVP : masquer l'offre sur natif. | P0 (si premium) · XL · **opus high** | W3-04, W6-01 |
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

### 5.2 Ce que contient le dépôt
- `render.yaml` : Blueprint du service `captivia-api` (Docker, Francfort, `/health`, `JWT_SECRET` généré, `autoDeployTrigger: checksPass`, variables listées).
- `netlify.toml` : base `frontend/`, Node 22, runtime Next.js détecté automatiquement, `NEXT_PUBLIC_SITE_URL`.
- `.github/workflows/ci.yml` : tests, build, Docker, lint, smoke Playwright et, sur `main`, job `migrate-production` (`prisma migrate deploy` sur Neon avec `NEON_DATABASE_URL_DIRECT`, ignoré avec un avertissement si le secret est absent). Comme c'est un check du commit, Render ne déploie qu'une fois la migration appliquée : les migrations restent **expand/contract**, compatibles avec la version N-1.
- `.github/workflows/deploy.yml` : seed de production manuel (`workflow_dispatch`) ; `keep-warm.yml` : ping manuel de diagnostic (le maintien en éveil passe par UptimeRobot) ; `backup.yml` : sauvegarde hebdomadaire chiffrée ; `codeql.yml`, `security.yml`, `release.yml`, `mobile.yml` (manuel).

### 5.3 Mise en place par le propriétaire
Les étapes (comptes Neon, Render, Netlify, secrets et variables GitHub, protection de `main`, premier déploiement, seed) sont décrites une seule fois dans [DEPLOY.md § 3 et § 6](DEPLOY.md#3-mise-en-place-pas-à-pas) ; la liste ordonnée des actions est au [§0.3](#03-actions-du-propriétaire). Le site Netlify est `https://captivia-app.netlify.app` (nom repris dans `render.yaml`, `netlify.toml` et la CSP).

### 5.4 Variables d'environnement
La matrice complète et à jour (Render, Netlify, build mobile, GitHub) est dans [DEPLOY.md § 5](DEPLOY.md#5-matrice-des-variables-denvironnement). `OPERATOR_EMAILS` est remplacé par `User.role` (W0-01) ; il n'y a pas de variable Stripe (W3-04 abandonné) : les achats passent par RevenueCat (`docs/PAYMENTS.md`).

---

## 6. Ordonnancement et parallélisation

> Séquencement de la planification initiale (historique). L'état réel est au [§0.2](#02-état-davancement-source-unique) ; Stripe (W3-04) a été abandonné, la chaîne du couloir A s'arrête donc à W2-04.

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

Cases cochées = critère satisfait dans le code au 2026-10-03 (items ✅ du [§0.2](#02-état-davancement-source-unique)). Une case vide indique ce qui manque ; aucune ne vaut mise en service vérifiée.

**Sécurité**
- [x] 0 vulnérabilité high/critical (`npm audit --omit=dev`) au dernier relevé, Dependabot actif (à rejouer avant la mise en ligne).
- [x] Aucune élévation possible (tests e2e rôles et casse des e-mails), sessions révocables, refresh tokens.
- [x] Rate limiting global et par endpoint sensible, cache borné, appels externes avec timeout et circuit breaker.
- [ ] CSP stricte et HSTS en place (pas de nonce : écart documenté, `docs/DEPLOY.md` §10) ; « aucun secret dans les logs » : redaction pino en place, vérification par grep des logs de staging non faite (pas de staging).
- [x] Valeurs par défaut dangereuses refusées au démarrage en production (hors `MAIL_HOST`, voir W0-04).

**Fonctionnel**
- [ ] Rappels envoyés réellement (e-mail + push web ; local et push natif sur mobile), sans doublon, au bon fuseau horaire : code complet, mais SMTP, VAPID et Firebase non configurés et aucun essai en conditions réelles.
- [x] Paiement : aucun achat sur le web (offre vendue par achats intégrés uniquement, D-04 / D-05 révisées).
- [x] Aucun stub visible : la seule mention « Bientôt » est l'annonce volontaire de la communauté fermée ; plus de magasins factices ; Amazon retiré.
- [ ] Catalogue : 100 % des fiches avec alimentation, habitat et comportement sourcés (1 401 fiches complètes sur 1 510 au dernier relevé ; relecture humaine législation et santé à faire).

**Qualité**
- [ ] CI bloquante verte en conditions réelles : configurée (lint, `tsc`, tests, e2e, axe, Docker) mais la CI ne démarre plus (quota) ; contrôles passés localement seulement ; 3 runs consécutifs non constatés.
- [ ] Couverture backend ≥ 75 % lignes, ≥ 60 % branches ; scheduler, auth et paiement ≥ 90 % : non mesurée.
- [ ] Lighthouse mobile ≥ 90 sur home, fiche espèce et connexion : non mesuré.
- [ ] i18n : 6 locales complètes, aucun texte en dur, test de parité : fait pour l'application, mais documents légaux en FR et EN seulement.

**Exploitation**
- [ ] Déploiement automatique depuis `main`, migrations avant déploiement, rollback documenté et testé : configuré et documenté ; mise en service (secret Neon, Render, Netlify) et test de rollback non constatés.
- [ ] `/health/ready` supervisé (monitor et alertes à créer), Sentry front et back avec releases (DSN à fournir), logs JSON expurgés (fait).
- [ ] Sauvegarde hebdomadaire chiffrée en place (`backup.yml`) ; clé `age`, stockage hors GitHub et restauration testée : à faire.
- [ ] Staging opérationnel, test de charge passé.

**Légal**
- [ ] Mentions légales, confidentialité, CGU, sources et licences, footer global : pages livrées, `[À COMPLÉTER]` et relecture juridique à faire (CGV sans objet : pas de vente sur le web).
- [x] Suppression et export de compte gratuits, consentement et âge à l'inscription, vérification d'e-mail.
- [x] `rel="sponsored"` sur les liens d'affiliation (la mention Amazon est sans objet), attributions CC BY-SA / ODbL / GBIF affichées.
- [ ] Registre des traitements fait ; DPA signés et durées de conservation entièrement appliquées par un job (comptes inactifs et `PaymentEvent` restent manuels ou à décider) : à faire.

**Mobile (Jalon 2)**
- [ ] Builds signés iOS et Android en CI, Universal Links / App Links vérifiés : projets natifs non générés, rien de signé.
- [ ] Achats intégrés (produits, Sandbox), suppression de compte dans l'app (faite), déclarations de confidentialité et d'âge saisies dans les consoles.
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
