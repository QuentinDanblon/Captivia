# AGENTS.md — guide du dépôt Captivia

Guide canonique pour toute personne ou tout agent (quel que soit l'outil) qui modifie ce dépôt. Il
est court à dessein : il fixe les règles et renvoie aux documents détaillés, qui font foi chacun dans
leur domaine. En cas de contradiction entre ce fichier et un document de référence, le document de
référence l'emporte : corrigez alors ce fichier dans la même PR.

## 1. Captivia en bref

L'application indispensable du particulier qui a un ou plusieurs animaux : **tout consigner** (carnet
de santé, vaccins, traitements, pesées, visites), **être guidé et prévenu** (rappels de soins et de
rendez-vous, agenda, abonnement calendrier, notifications), **apprendre** (fiches espèces et races
sourcées), et bientôt **partager** (communauté : photos, questions, commentaires, derrière le drapeau
`COMMUNITY_ENABLED`, fermée par défaut). Mobile d'abord (Android / iOS via Capacitor), pleinement
utilisable sur ordinateur ; landing marketing séparée de l'app.

Accès (décision **D-16**) : **invité** sans compte = 1 animal ; **compte gratuit** = 1 animal, carnet
complet ; **Premium** (achats intégrés) = plusieurs animaux. Passage invité → compte sans perte.

Référence : [`docs/PRODUCT.md`](docs/PRODUCT.md). État du projet et décisions D-xx :
[`docs/PLAN-PRODUCTION.md`](docs/PLAN-PRODUCTION.md) (le tableau du § 0.2 est la **seule** source de
vérité sur l'avancement ; mettez-le à jour quand vous livrez ou retirez quelque chose).

## 2. Règles non négociables

Chaque règle : ce qu'il faut faire, pourquoi, où est la référence.

1. **Écriture.** Textes affichés naturels, chaleureux, un peu marketing ; jamais la reformulation
   d'une consigne interne. Interdits à l'écran : les mots de travail (« promesse », « piliers »,
   « entonnoir », « preuve », « réassurance », « carnet de terrain », « derrière la connexion »…),
   les formules méta, les superlatifs creux, « Découvrez… », « en quelques clics », « IA »,
   « Veuillez / Vous devez », émojis et points d'exclamation, « soigne / guérit », tout message brut
   de l'API. Vouvoiement en français ; forme d'adresse fixée par langue.
   *Pourquoi* : une marque grand public de confiance, et aucune promesse médicale.
   *Référence* : [`docs/MESSAGING.md`](docs/MESSAGING.md) § 0, [`frontend/docs/DESIGN.md`](frontend/docs/DESIGN.md) § 2.
2. **Direction artistique.** Uniquement les jetons de couleur, les deux rayons, les trois polices
   (Fraunces, IBM Plex Sans, IBM Plex Mono) et les composants de `src/components/ui`. Photos réelles
   sous licence libre **vérifiée**, inscrites dans `public/images/CREDITS.md` et
   `src/content/photos.ts` avant usage, affichées avec leur crédit ; **jamais d'image générée**. Le
   job CI `quality` refuse les motifs de style interdits (variante `dark:`, couleurs Tailwind brutes,
   dégradés, grands rayons, ombres floues, flou, capitales espacées, `var(--captivia-*)`).
   *Pourquoi* : un seul système visuel cohérent entre landing, web, mobile et stores.
   *Référence* : `frontend/docs/DESIGN.md` (§ 8 à ne pas faire, § 9 garde-fous, § 10 journal).
3. **i18n.** Aucun texte en dur : tout passe par `frontend/messages/<locale>.json`, dans les **six**
   langues (`fr` source, `en`, `es`, `de`, `it`, `pt` = **portugais européen**, pt-PT). Le test
   `src/lib/__tests__/i18n-parity.test.ts` échoue si une clé manque. Jamais de texte français
   recopié comme « traduction provisoire » dans une autre langue.
   *Pourquoi* : l'app est publiée dans six langues ; une clé manquante casse l'écran.
4. **Contenu des espèces et santé.** Toute donnée éditoriale (alimentation, habitat, santé,
   reproduction…) est appuyée par une **citation exacte** d'une source réellement consultée et
   vérifiée par `backend/prisma/enrichment/check_quotes.py` ; sans source, le champ reste `null`.
   Ne jamais inventer une donnée de santé, un statut légal ou une source ; la législation reste
   marquée `needsReview` jusqu'à une relecture humaine.
   *Pourquoi* : c'est une app de soin aux animaux ; une erreur peut nuire à un animal.
   *Référence* : [`backend/prisma/enrichment/CONTRACT.md`](backend/prisma/enrichment/CONTRACT.md), `backend/prisma/enrichment/VERIFY.md`.
5. **Migrations Prisma.** Additives (« expand / contract ») et compatibles avec la version N-1 de
   l'API : on ajoute (colonne nullable ou avec défaut, table, index), on ne supprime ni ne renomme
   dans la même livraison. Format du projet : dossier `AAAAMMJJHHMMSS_nom_en_snake_case/migration.sql`,
   en-tête commenté (tâche, pourquoi, compatibilité N-1), contraintes nommées
   (`"<Table>_<colonne>_check"`), `TIMESTAMPTZ(3)`. Une seule tâche à la fois touche `schema.prisma`.
   Le schéma et les migrations doivent rester sans écart (`migrate diff --exit-code`, § 4).
   *Pourquoi* : Render déploie l'API **après** la migration ; un rollback de code ne défait pas la base.
   *Référence* : [`docs/DEPLOY.md`](docs/DEPLOY.md) § 7.
6. **Paiements.** Pas de Stripe ni d'aucun paiement web : Premium passe uniquement par les achats
   intégrés (RevenueCat), et le **backend est la source de vérité** du droit Premium (webhook,
   `EntitlementService`). Aucun prix codé en dur ni inventé : le tarif vient des stores.
   *Pourquoi* : décisions D-04 / D-05 ; règles Apple et Google.
   *Référence* : [`docs/PAYMENTS.md`](docs/PAYMENTS.md).
7. **Export statique mobile.** L'app embarque `npm run build:mobile` (export statique, aucun
   serveur). Donc : pas de route handler, de server action, de `headers()` / `cookies()` ni de fetch
   au build dans une page utilisée par l'app ; une route dynamique web (`[id]`) a un équivalent à
   query dans l'app (`mobile/app/**`, table `DYNAMIC_ROUTES` de `scripts/build-mobile.mjs`, helper
   dans `src/lib/platform.ts` comme `animalDetailPath`) ; les capacités natives passent par
   `src/lib/platform.ts` et restent sans effet sur le web. La CSP de l'app est à **hachages**
   (calculés par `build-mobile.mjs`) : pas de script inline ajouté à la main.
   *Pourquoi* : Apple refuse une app qui charge du contenu distant ; la CSP stricte protège la WebView.
   *Référence* : [`docs/MOBILE.md`](docs/MOBILE.md) § 2 à 4.
8. **Sécurité et données personnelles.** Aucun secret, jeton ou URL de base de données dans le
   dépôt, les logs ou les PR (secrets : Render, Netlify, GitHub). CSP sans `unsafe-eval` en
   production, source unique `frontend/src/lib/csp.ts`. Contrôle d'appartenance sur toute ressource
   d'un utilisateur ; données de santé jamais publiques sans action explicite. **Tout nouveau
   traitement de données personnelles** (nouvelle donnée, sous-traitant, durée de conservation) met à
   jour [`docs/legal/registre-traitements.md`](docs/legal/registre-traitements.md) et, s'il y a lieu,
   la purge (`backend/src/maintenance/`) et `docs/RUNBOOK.md` § 6.5.
   *Pourquoi* : RGPD, données de santé animale liées à des personnes.
   *Référence* : `docs/DEPLOY.md` § 10 (CSP), `docs/RUNBOOK.md` § 4 (secrets).
9. **Accessibilité.** AA, focus visible, zones tactiles ≥ 44 px, statut jamais porté par la seule
   couleur. `e2e/smoke/a11y.spec.ts` (axe) fait échouer le smoke sur toute violation sérieuse ou
   critique, en clair et en sombre. *Référence* : `frontend/docs/DESIGN.md` § 1 et § 9.

## 3. Carte du dépôt

```
backend/                      API NestJS 11 + Prisma 6 (PostgreSQL)
  src/auth, account/          sessions, invité → compte, vérification d'e-mail ; export / suppression RGPD
  src/animals, routines, medications, vaccinations, vet-appointments, animal-measurements, breeding/
                              animaux et carnet de santé
  src/notifications/          scheduler des rappels, Web Push, push natif FCM / APNs
  src/agenda/                 agenda des soins, flux ICS
  src/subscription, entitlement/   webhook RevenueCat, droit Premium
  src/community/              volet social (404 tant que COMMUNITY_ENABLED != true)
  src/species, external, gateway, health-content, legislation, food, equipment/   catalogue, API externes
  src/maintenance/            purges quotidiennes ; src/config/ validation des variables (Joi)
  prisma/schema.prisma, prisma/migrations/, prisma/seed-prod.ts (catalogue, idempotent)
  prisma/enrichment/          enrichissement sourcé des fiches (CONTRACT.md, check_quotes.py, out/, verify/)
  test/                       e2e Jest (Postgres réel), inclus dans `npm test`
frontend/                     Next.js 16 App Router + next-intl, Capacitor 7
  src/app/[locale]/(marketing)/   landing, pages légales, transparence, page publique d'un animal
  src/app/[locale]/(auth)/        connexion, inscription, mots de passe, vérification, /sauvegarder
  src/app/[locale]/(app)/         l'app : mes-animaux, agenda, especes, species, parametres, communaute…
  src/components/ui/          composants du système visuel (import depuis `@/components/ui`)
  src/components/frames/      cadres MarketingFrame, AccountFrame (AppShell : src/components/AppShell.tsx)
  src/components/native/      pont Capacitor, rappels locaux, demande de permission push
  src/components/community/, landing/, guest/, purchases/, species/
  src/lib/api.ts              client API unique (timeout, ApiError, rafraîchissement de session)
  src/lib/platform.ts         couche plateforme web / natif, chemins compatibles avec l'app
  src/lib/csp.ts, config.ts   CSP, URL d'API
  src/i18n/navigation.ts      Link, useRouter localisés ; i18n/routing.ts, i18n/request.ts : config next-intl
  messages/<locale>.json      textes de l'interface (6 langues)
  mobile/app/**               overlays de routes copiés dans src/app pendant `build:mobile`
  e2e/smoke/                  Playwright sur API simulée (CI) ; e2e/integration/ : hors CI, backend réel
  docs/DESIGN.md              système visuel
docs/                         produit, message, plan, déploiement, exploitation, mobile, paiements,
                              legal/ (registre RGPD), store/ (fiches), archive/ (périmé, ne pas suivre)
.github/workflows/            ci.yml (bloquant), security.yml, codeql.yml, mobile.yml (manuel),
                              deploy.yml (seed manuel), backup.yml, release.yml, keep-warm.yml (manuel)
render.yaml, netlify.toml, docker-compose.yml
```

## 4. Vérifier avant de livrer (mêmes commandes que la CI)

La CI (`.github/workflows/ci.yml`) ignore les changements purement documentaires (`docs/**`,
`**/*.md`). Son quota GitHub Actions est actuellement épuisé : **lancez ces commandes en local**.

**Backend** (`cd backend`, PostgreSQL local, base dédiée) :

```bash
export DATABASE_URL='postgresql://<user>:<mdp>@localhost:5432/captivia_test?schema=public'
export JWT_SECRET='ci-test-secret-at-least-16-chars-long'
npm ci
npm run build                         # prisma generate + nest build (avant tsc : client Prisma requis)
npx tsc --noEmit
npx prisma migrate deploy && npx prisma db seed
npm run lint:check                    # 0 erreur, src/ et test/
npm test -- --runInBand               # unitaires + e2e
# Schéma et migrations sans écart (base fantôme vide dédiée, détruite ensuite) :
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url 'postgresql://<user>:<mdp>@localhost:5432/captivia_test_shadow' --exit-code
```

**Frontend** (`cd frontend`) :

```bash
npm ci
rm -rf .next && npx tsc --noEmit
npx eslint "src/**/*.{ts,tsx}" "e2e/**/*.ts" "mobile/**/*.tsx" --no-fix
npx jest                              # avant le build (voir pièges)
NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run build
npx playwright install chromium       # une fois
npx playwright test --project=smoke --project=smoke-mobile
npm run build:mobile                  # export statique de l'app (out/)
git status --porcelain -- src i18n    # rien d'autre que vos modifications : build:mobile a tout restauré
```

**Garde-fou de style** (job `quality`, doit ne rien afficher) :

```bash
cd frontend && grep -rnE --include='*.ts' --include='*.tsx' --include='*.css' --exclude-dir=__tests__ --exclude='*.test.*' \
  'dark:|\b(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(bg|text|border)-(white|black)\b|bg-gradient-|\brounded-(lg|xl|2xl|3xl)\b|\bshadow-(sm|md|lg|xl|2xl)\b|backdrop-blur|\buppercase\b|tracking-(wider|widest)|var\(--captivia-' \
  src mobile
```

Textes des stores modifiés : `npm run store:check` (longueurs, `frontend/scripts/check-store-texts.mjs`).

**Pièges connus**

- Le smoke doit tourner sur un build fait avec `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010` : l'URL
  est inlinée dans le bundle **et** dans la CSP, et les mocks (`e2e/support/mock-api.ts`) l'attendent.
  Un build fait pour une autre API fait échouer le smoke (violations CSP).
- Après `npm run build:mobile`, `.next/` contient les types de l'export : faire `rm -rf .next`
  avant `npx tsc --noEmit`, sinon `tsc` signale des erreurs qui n'existent pas.
- Lancer Jest avant `next build` (ou après `rm -rf .next`) : les `package.json` copiés dans `.next/`
  provoquaient des collisions de modules.
- `build:mobile` écarte temporairement des fichiers de `src/` : ne pas lancer `next dev` en même
  temps ; après une interruption brutale, `node scripts/build-mobile.mjs --restore`.
- Les e2e backend utilisent une vraie base : jamais l'URL de production. `JWT_SECRET` est obligatoire
  (16 caractères minimum hors production, 32 et non-exemple en production).
- Docker Compose exige `POSTGRES_PASSWORD` et `JWT_SECRET` dans `.env` ; le backend y tourne en mode
  production.

## 5. Flux de travail

- **Une demande du propriétaire = une seule PR**, référence de tâche du plan dans le titre quand
  elle existe (ex. `W4-09`). Jamais de push direct sur `main`.
- **Économie de minutes Actions** (dépôt privé, quota payant) : chaque push sur une PR prête
  relance la CI. Donc :
  - ouvrir la PR **en brouillon** (rien ne tourne en brouillon), tout vérifier **en local** avec
    les commandes du § 4, pousser **en une fois**, puis passer la PR « prête » : un seul passage
    de CI ;
  - ne pas pousser commit par commit pour « voir si la CI passe » ; regrouper les corrections ;
  - avant de fusionner, vérifier le contenu de l'aperçu Netlify (lien direct du déploiement), pas
    seulement son statut, pour ne pas devoir rouvrir une PR de correctif ;
  - la CI ne lance que les jobs concernés (backend ou frontend, job `changes`) ; Netlify ne
    reconstruit que si `frontend/` change ; Dependabot n'ouvre plus de PR de version (seulement
    les correctifs de sécurité) ;
    release-please se lance à la main (Actions → Release).
- **CI verte obligatoire** avant fusion (`test-backend`, `lint-backend`, `build-frontend`,
  `docker-build`, `quality`, `e2e`, audit `security.yml`).
- Après fusion sur `main` : le job `migrate-production` applique les migrations sur Neon (secret
  `NEON_DATABASE_URL_DIRECT`), puis **Render** déploie l'API quand tous les checks sont verts
  (`autoDeployTrigger: checksPass`) ; **Netlify**, relié à GitHub, construit et publie le site (et
  une preview par PR). Le seed du catalogue est manuel (workflow « Seed production »).
- Commits en **français**, petits et clairs, au format Conventional Commits (`feat:`, `fix:`,
  `docs:`, `refactor:`…, release-please s'en sert pour les changelogs quand on le lance).
  Auteur : QuentinDanblon ; chaque commit se termine par la ligne de co-auteur suivante, et
  aucune autre ligne de signature ou d'attribution (pas d'outil ni d'agent IA) :
  `Co-authored-by: Amaury Baptist <amaurybaptistecole@gmail.com>`
- Toute livraison met à jour la documentation qu'elle rend fausse (et le § 0.2 du plan).

## 6. Ne jamais

- Désactiver, sauter (`.skip`, `.only`) ou affaiblir un test, ou une règle de lint, pour faire
  passer la CI ; ajouter un `eslint-disable` global ou de fichier.
- Commiter un secret, un `.env`, une clé, un keystore ou une URL de base de données.
- Écrire à la main dans la base de production (hors procédures écrites de `docs/RUNBOOK.md`).
- Inventer un prix, une donnée médicale ou légale, un chiffre d'usage, une source ou une citation.
- Changer la direction artistique ou le ton sans mettre à jour d'abord `frontend/docs/DESIGN.md`
  (§ 10, journal des décisions) ou `docs/MESSAGING.md`.
- Contourner le garde-fou de style (classe construite dynamiquement, style inline, nouvelle couleur
  hors jetons).
- Ajouter un paiement web, un SDK publicitaire ou de suivi, une image générée.
- Suivre un document de `docs/archive/` : il est périmé.

## 7. Où trouver quoi

| Besoin | Document |
|---|---|
| État, priorités, décisions D-xx, actions du propriétaire | [`docs/PLAN-PRODUCTION.md`](docs/PLAN-PRODUCTION.md) § 0 et § 3 |
| Vision, offre, ton | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| Mots publiés | [`docs/MESSAGING.md`](docs/MESSAGING.md) |
| Système visuel | [`frontend/docs/DESIGN.md`](frontend/docs/DESIGN.md) |
| Mise en ligne, variables d'environnement, CSP | [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| Exploitation, incidents, purges, secrets | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) |
| Mobile (Capacitor, push, liens universels) | [`docs/MOBILE.md`](docs/MOBILE.md) |
| Achats intégrés | [`docs/PAYMENTS.md`](docs/PAYMENTS.md) |
| RGPD | [`docs/legal/registre-traitements.md`](docs/legal/registre-traitements.md) |
| Stores (fiches, déclarations) | [`docs/store/README.md`](docs/store/README.md) |
| Enrichissement des fiches | [`backend/prisma/enrichment/CONTRACT.md`](backend/prisma/enrichment/CONTRACT.md) |
