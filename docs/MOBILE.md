# Applications mobiles (Android / iOS) — Capacitor 7

Vague 6 du plan (`docs/PLAN-PRODUCTION.md`), décision **D-11** : le web reste une PWA ; iOS et Android
embarquent l'**export statique** du frontend Next.js dans Capacitor 7. L'app ne charge **jamais** de
contenu distant (`server.url` interdit : rejet Apple 4.2). Elle parle à l'API publique comme le site web.

| Élément | Emplacement |
| --- | --- |
| Configuration Capacitor | `frontend/capacitor.config.ts` (appId `app.captivia`, webDir `out`) |
| Cible d'export | `frontend/next.config.ts` (branche `MOBILE_BUILD=1`) |
| Script de build | `frontend/scripts/build-mobile.mjs` (`npm run build:mobile`) |
| Routes propres à l'app | `frontend/mobile/app/**` (overlays copiés dans `src/app` pendant le build) |
| Projets natifs | `frontend/mobile/android`, `frontend/mobile/ios` (créés par `npx cap add`) |
| Couche plateforme | `frontend/src/lib/platform.ts` |
| CI | `.github/workflows/mobile.yml` (manuel, sans signature) |

## 1. Prérequis

- **Node 22** (comme le web) et `npm ci` dans `frontend/`.
- **Android** : Android Studio récent, SDK **API 36** (`compileSdk`/`targetSdk 36`, exigence Play 2026),
  JDK 21. Variable `ANDROID_HOME` définie.
- **iOS** : macOS + **Xcode 26** (SDK iOS 26, exigé par l'App Store depuis avril 2026), CocoaPods ou
  Swift Package Manager. iPhone seulement en v1.
- **Comptes stores (W6-01, à lancer dès J1)** : Apple Developer Program (99 $/an) et Google Play Console
  (25 $), tous deux au nom de l'**organisation** (numéro D-U-N-S) pour éviter le test fermé obligatoire
  de 12 testeurs / 14 jours des comptes personnels. Contrats « Paid Apps » et fiscalité signés.

## 2. Build et synchronisation

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.captivia.app npm run build:mobile   # → out/
npx cap sync                                                       # copie out/ + plugins dans les projets natifs
npx cap open android   # ou: npx cap open ios
```

Première fois seulement (machine avec SDK Android / Xcode) :

```bash
npx cap add android    # crée frontend/mobile/android
npx cap add ios        # crée frontend/mobile/ios (macOS)
```

Puis régler `targetSdkVersion = 36` / `compileSdkVersion = 36` dans `mobile/android/variables.gradle`,
le déploiement iOS minimal et « iPhone only » dans Xcode, et versionner les deux dossiers.

`NEXT_PUBLIC_API_URL` est **obligatoire** : il est inliné dans le bundle et ajouté au `connect-src` de la
CSP. `NEXT_PUBLIC_SENTRY_DSN` est facultatif (même rôle que sur le web).

### Ce que fait `npm run build:mobile`

1. Écarte temporairement les fichiers web incompatibles avec `output: 'export'` :
   `src/proxy.ts` (middleware next-intl), `src/app/api/**`, `src/app/[locale]/[...rest]` (404 en
   `force-dynamic`), le layout SEO de `species/[id]` (fetch API), `manifest.ts`, `robots.ts`, `sitemap.ts`.
2. Copie les overlays de `mobile/app/**` dans `src/app/**`.
3. Lance `next build` avec `MOBILE_BUILD=1` : `output: 'export'`, `trailingSlash: true`,
   `images.unoptimized`, sans `headers()`/rewrites, `NEXT_PUBLIC_MOBILE_BUILD=1` inliné.
4. Restaure **toujours** l'arborescence (bloc `finally`, SIGINT/SIGTERM, journal
   `mobile/.build-journal.json`). Après un `kill -9` : `node scripts/build-mobile.mjs --restore`
   (le build suivant restaure aussi automatiquement). Ne pas lancer `next dev` en même temps.
5. Post-traite `out/` : écrit `out/index.html` (amorce), injecte la CSP en `<meta>` (MOB-16) et un
   script de normalisation d'URL en tête de chaque page, vérifie la présence des 6 locales.

Le build web (`npm run build`, sans `MOBILE_BUILD`) est **inchangé** : même `output: 'standalone'`,
mêmes en-têtes de sécurité, mêmes routes.

## 3. Routage dans l'app

### Locales : `localePrefix: 'always'`

Sans serveur, pas de middleware next-intl. Dans le bundle mobile, `i18n/routing.ts` passe en
`localePrefix: 'always'` : chaque page vit sous `/<locale>/…` (`/fr/`, `/en/`…). Les liens next-intl
(`Link`, `useRouter`) produisent donc directement des chemins exportés.

### Amorce `out/index.html` et repli SPA de Capacitor

Capacitor sert `index.html` **racine** pour toute URL sans extension (démarrage, rechargement,
navigation « dure »). L'amorce :

- `/` → locale mémorisée (`localStorage['captivia.locale']`), sinon langue du téléphone, sinon `fr` ;
- `/<chemin>` sans locale → préfixé par cette locale ;
- routes dynamiques web → routes à query (ci-dessous), en conservant la query et le hash ;
- route inconnue → accueil de la locale ;
- recharge `/<locale>/<page>/index.html`, puis le script injecté rétablit l'URL canonique
  (`history.replaceState` vers `/<locale>/<page>/`) **avant** l'hydratation du routeur Next.

La navigation côté client (RSC `*.txt` exportés, qui ont une extension) n'est pas concernée.

### Routes dynamiques → routes à query (choix retenu)

| Web | App |
| --- | --- |
| `/mes-animaux/<id>` | `/mes-animaux/detail?id=<id>` |
| `/species/<id>` | `/species?id=<id>` |
| `/animal-public/<slug>` | `/animal-public?slug=<slug>` |

Pourquoi : les identifiants (animaux privés, 1 500+ espèces) ne sont pas connus au build ; le pré-rendu
exhaustif est impossible (animaux) ou coûteux et fragile (espèces × 6 locales, API requise au build).
Les pages à query (`mobile/app/**/page.tsx`) **réutilisent telles quelles** les pages web dynamiques en
leur passant `params` lus dans la query (`useQueryRouteParams`, `src/lib/platform.ts`). Les routes
`[id]`/`[slug]` ne sont exportées qu'avec un paramètre factice `_` (overlays `layout.tsx` avec
`generateStaticParams`), uniquement pour satisfaire `output: 'export'`.

Les liens existants `href={`/mes-animaux/${id}`}` **fonctionnent déjà** dans l'app : le fichier RSC
n'existe pas, Next bascule en navigation dure, et l'amorce redirige vers la route à query (coût : un
rechargement du shell local). Pour une navigation instantanée, utiliser les helpers
`animalDetailPath(id)`, `speciesPath(id)`, `publicAnimalPath(slug)` de `src/lib/platform.ts`
(chemin web inchangé, chemin à query dans l'app).

## 4. Couche plateforme (`src/lib/platform.ts`)

- `isNative()` / `getPlatform()` : détection Capacitor ; `IS_MOBILE_BUILD` : bundle mobile.
- `openExternal(url)` : http(s) uniquement. Sur natif, Capacitor confie toute navigation vers un hôte
  externe au système (Safari / navigateur par défaut / app Amazon) : les liens Amazon ne s'ouvrent
  **jamais** dans la WebView (MOB-36). Les `<a target="_blank">` suivent le même chemin.
- `tokenStorage` : sur le web, strictement `localStorage` ; sur natif, écriture double
  `@capacitor/preferences` (persistant, hors stockage WebView purgeable par iOS) + miroir `localStorage`
  pour les lecteurs synchrones (`api.ts`). `AuthContext` attend `tokenStorage.hydrate()` au démarrage
  natif. Évolution prévue (W6-04) : Keychain / Keystore chiffré.

## 5. CORS (backend)

Ajouter les origines de la WebView à `CORS_ORIGIN` (Render), séparées par des virgules :

```
CORS_ORIGIN=https://captivia.netlify.app,capacitor://localhost,https://localhost
```

- iOS : `capacitor://localhost` (`server.iosScheme`) ;
- Android : `https://localhost` (`server.androidScheme`).

Aucune modification du code backend n'est nécessaire (liste déjà lue depuis la variable).

## 6. Achats intégrés (RevenueCat)

`@revenuecat/purchases-capacitor` (v11, compatible Capacitor 7) est installé. Produits, webhook vers
`Subscription`, paywall conforme et sandbox : voir **`docs/PAYMENTS.md`** et la tâche W6-08. Option MVP
(D-04) : masquer l'offre sur natif (`isNative()`) tant que W6-08 n'est pas livrée — aucun lien vers un
paiement web dans l'app (règle 3.1.1).

## 7. Notifications locales

`@capacitor/local-notifications` (W6-06) : rappels de routines, médicaments, vaccins et RDV programmés
sur l'appareil, fonctionnent hors ligne. Icône Android `ic_stat_captivia` (monochrome, à générer dans
`mobile/android/app/src/main/res/drawable*`), couleur `#0aa678` (`capacitor.config.ts`). Android 13+ :
demander `POST_NOTIFICATIONS` ; Android 14+ : `SCHEDULE_EXACT_ALARM` seulement si nécessaire. Le push
distant (FCM/APNs) relève de W6-07.

## 8. Universal Links / App Links (W6-09)

- Servir `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json` depuis le site web
  (déjà exclus du middleware dans `src/proxy.ts`). `assetlinks.json` : empreintes SHA-256 de la clé
  d'upload **et** de Play App Signing.
- iOS : capability *Associated Domains* `applinks:<domaine>` ; Android : `intent-filter` `autoVerify`.
- Dans l'app : `App.addListener('appUrlOpen', …)` (`@capacitor/app`) → convertir l'URL web en route de
  l'app (mêmes règles que l'amorce, ex. `/fr/animal-public/<slug>` → `/fr/animal-public?slug=<slug>`)
  puis `router.push`.

## 9. Checklist stores

- [ ] Comptes organisation Apple / Google actifs, contrats et fiscalité (W6-01).
- [ ] `NEXT_PUBLIC_API_URL` de production au build ; `CORS_ORIGIN` mis à jour.
- [ ] Icônes et splash (`@capacitor/assets`), captures 6,9" / 6,5" et Play, fiches FR/EN (W6-10).
- [ ] `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`
      (Info.plist) ; permissions Android minimales (W6-05).
- [ ] `PrivacyInfo.xcprivacy`, App Privacy, Data Safety, questionnaire d'âge Apple, IARC (W6-11).
- [ ] Suppression de compte dans l'app **et** page web publique (`/suppression-compte`).
- [ ] Liens Amazon via `openExternal`, mention d'affiliation, app déclarée dans Associates Central.
- [ ] Paywall conforme ou offre masquée sur natif ; sandbox IAP testée (W6-08).
- [ ] Compte de démo rempli pour la relecture, aucun « bientôt disponible » (W6-13).
- [ ] TestFlight + test fermé Play.
- [ ] Signature : keystore et certificats en secrets CI (fastlane match), jamais dans le dépôt (W6-12).

## 10. CI

`.github/workflows/mobile.yml` (déclenchement manuel `workflow_dispatch`) : `npm ci`, tests,
`npm run build:mobile`, puis `npx cap add` (si le projet natif n'est pas versionné) et `npx cap sync`
pour Android (Ubuntu) et, en option, iOS (macOS). Aucune signature : l'export `out/` est publié en
artefact. La signature et la publication (`bundleRelease`, fastlane `beta`) relèvent de W6-12.
