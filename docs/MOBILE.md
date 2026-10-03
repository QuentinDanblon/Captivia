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
   `src/proxy.ts` (middleware next-intl), `src/app/api/**`, `src/app/.well-known/**` (fichiers
   d'association, servis par le site), `src/app/[locale]/[...rest]` (404 en
   `force-dynamic`), le layout SEO de `species/[id]` (fetch API), `manifest.ts`, `robots.ts`, `sitemap.ts`.
2. Copie les overlays de `mobile/app/**` dans `src/app/**`.
3. Lance `next build` avec `MOBILE_BUILD=1` : `output: 'export'`, `trailingSlash: true`,
   `images.unoptimized`, sans `headers()`/rewrites, `NEXT_PUBLIC_MOBILE_BUILD=1` inliné.
4. Restaure **toujours** l'arborescence (bloc `finally`, SIGINT/SIGTERM, journal
   `mobile/.build-journal.json`). Après un `kill -9` : `node scripts/build-mobile.mjs --restore`
   (le build suivant restaure aussi automatiquement). Ne pas lancer `next dev` en même temps.
5. Post-traite `out/` : écrit `out/index.html` (amorce), injecte la CSP en `<meta>` (MOB-16, W4-08 :
   construite par `src/lib/csp.ts`, avec les hachages SHA-256 des scripts inline de chaque page, sans
   `'unsafe-inline'` ni `'unsafe-eval'` pour les scripts ; voir `docs/DEPLOY.md` § 10) et un script de
   normalisation d'URL en tête de chaque page, vérifie la présence des 6 locales.

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
- `useIsNative()` : `isNative()` lu après l'hydratation (le HTML exporté est celui du web).

Tout ce qui suit est **sans effet sur le web** : garde-fous `isNative()` / `IS_MOBILE_BUILD`, plugins
importés dynamiquement (`import('@capacitor/…')`), donc absents du bundle web.

### 4.1 Plugins (Capacitor 7)

| Plugin | Version | Usage |
| --- | --- | --- |
| `@capacitor/app` | 7.1.x | `appUrlOpen`, `getLaunchUrl`, `appStateChange`, `backButton`, `exitApp` (`NativeBridge`) |
| `@capacitor/camera` | 7.0.x | photo d'animal : appareil photo ou galerie (`usePhotoPicker`) |
| `@capacitor/local-notifications` | 7.0.x | rappels de soins (`src/lib/local-reminders.ts`) |
| `@capacitor/preferences` | 7.0.x | session (`tokenStorage`), réglage et dernière liste des rappels |
| `@capacitor/filesystem`, `@capacitor/share` | 7.1.x, 7.0.x | partage du carnet (`src/lib/carnet-share.ts`) |
| `@revenuecat/purchases-capacitor` | 11.x | achats intégrés (W6-08) |

Versions vérifiées avec `npm view <plugin>@7 version` (dernières 7.x). Après tout ajout : `npx cap sync`.

### 4.2 Liens sortants (W6-05, MOB-36)

`ExternalLink` (`src/components/ui/ExternalLink.tsx`) remplace tout `<a target="_blank">` vers un autre
site : sources Wikipédia / GBIF / PubMed, crédits photo et licences, boutiques (`rel="sponsored"`),
gestion de l'abonnement, liens des pages légales. Web : `target="_blank" rel="noopener noreferrer"`
(+ jetons passés en `rel`). Natif : le clic passe par `openExternal` (navigateur du système, jamais la
WebView). `NewTabPageLink` (`src/components/NewTabPageLink.tsx`) ouvre une page du site à côté d'un
formulaire (CGU, confidentialité à l'inscription) : nouvel onglet sur le web, page publique du site
(`NEXT_PUBLIC_SITE_URL`) dans le navigateur du système sur natif. Ne plus écrire `target="_blank"` à la main.

### 4.3 Photos (W6-05, MOB-17)

`usePhotoPicker` (`src/components/usePhotoPicker.ts`) : sur le web, l'`<input type="file">` reste
inchangé ; sur natif, `Camera.getPhoto({ source: Prompt })` propose « Prendre une photo » ou
« Choisir dans la galerie » (libellés traduits, `photoPicker.*`), redimensionne à 1 600 px côté natif,
puis la compression existante `src/lib/image.ts` (JPEG 0,82, refus > 10 Mo) s'applique. Accès refusé :
message traduit invitant à l'autoriser dans les réglages. `saveToGallery: false` (rien n'est écrit
dans la galerie).

**iOS — `Info.plist`** (obligatoires pour le plugin, sinon plantage à l'ouverture de la caméra et rejet
5.1.1) ; à traduire dans `InfoPlist.strings` pour les 6 langues :

| Clé | Texte (fr) | Texte (en) |
| --- | --- | --- |
| `NSCameraUsageDescription` | « Captivia utilise l'appareil photo pour prendre la photo de profil de votre animal. » | “Captivia uses the camera to take your animal's profile photo.” |
| `NSPhotoLibraryUsageDescription` | « Captivia accède à vos photos pour que vous choisissiez celle de votre animal. » | “Captivia accesses your photos so you can pick one of your animal.” |
| `NSPhotoLibraryAddUsageDescription` | « Captivia peut enregistrer des photos de vos animaux dans votre galerie. » | “Captivia can save photos of your animals to your library.” |

**Android** : aucune permission à déclarer. Le plugin passe par l'intent caméra du système et le
Photo Picker (Android 11+, sinon `ACTION_OPEN_DOCUMENT`) ; `READ_/WRITE_EXTERNAL_STORAGE` ne servent
qu'avec `saveToGallery: true`. Ne **pas** déclarer `android.permission.CAMERA` : déclarée, elle devrait
être demandée à l'exécution, sans quoi l'intent caméra échoue. Option : le service
`ModuleDependencies` du README du plugin pour installer le Photo Picker rétroporté.

### 4.4 Pont natif (`src/components/native/NativeBridge.tsx`)

Monté **une fois** dans `src/app/[locale]/layout.tsx`, rendu seulement dans l'export mobile, actif
seulement si `isNative()` :

- `appUrlOpen` et `App.getLaunchUrl()` (lien ouvert à froid, traité une seule fois) →
  `mapWebUrlToAppRoute` → `router.push` (§ 8.5) ;
- rappels locaux : synchronisation après la connexion (invité compris) et à chaque retour au premier
  plan (`appStateChange`), annulation à la déconnexion, rappel touché → fiche de l'animal (§ 7) ;
- **bouton retour Android** (`backButton`) : ferme d'abord une fenêtre modale ouverte (Échap), sinon
  `history.back()` si la WebView a un historique, sinon `App.exitApp()`.

## 5. CORS (backend)

Ajouter les origines de la WebView à `CORS_ORIGIN` (Render), séparées par des virgules :

```
CORS_ORIGIN=https://captivia-app.netlify.app,capacitor://localhost,https://localhost
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

### 7.1 Fonctionnement (`src/lib/local-reminders.ts`)

- **Source** : `GET /users/me/agenda` sur les **30 prochains jours** (routines, médicaments, rappels de
  vaccin, RDV vétérinaires ; disponible pour les invités). Seuls les soins « à faire » à venir sont
  programmés ; une échéance « journée entière » sonne à **9 h** locale ce jour-là.
- **Identifiants stables** : FNV-1a de l'identifiant d'agenda (`<type>:<source>:<instant>`), entier
  31 bits ; un même soin garde le même numéro d'une synchronisation à l'autre (il est remplacé, jamais
  dupliqué). Collision (rarissime) : identifiant libre suivant, dans l'ordre chronologique.
- **Limite iOS** : 64 notifications locales en attente par app → les **64 plus proches**.
- **Annulation** : à chaque synchronisation, les rappels Captivia en attente (marqués
  `extra.kind = 'captivia-agenda'` ou mémorisés) qui ne font plus partie du plan sont annulés ; les
  autres notifications ne sont pas touchées.
- **Hors ligne** : la dernière liste connue (Preferences, propre au compte) est reprogrammée ; les
  soins passés en sont retirés. Une session refusée (401/403) ne reprogramme rien.
- **Déclencheurs** (`NativeBridge`) : connexion ou essai invité, retour au premier plan, bouton des
  paramètres. Déconnexion : tout est annulé et la liste oubliée.
- **Permission** : jamais au lancement à froid. Demandée (1) juste après une connexion faite pendant
  l'exécution, s'il y a au moins un soin à rappeler, **une seule fois par appareil** ; (2) sur le
  bouton « Activer les rappels sur ce téléphone » des paramètres de notifications. Refusée dans les
  réglages : jamais redemandée, la carte explique comment la rétablir.
- **Couper les rappels** (paramètres de notifications → « Sur cet appareil », carte native qui
  remplace le Web Push dans l'app) : tous les rappels programmés sont annulés et plus rien n'est
  programmé jusqu'à réactivation.
- **Clic** sur un rappel : `localNotificationActionPerformed` → fiche de l'animal (`animalDetailPath`).
- **Android** : canal `captivia-reminders` (importance haute, nom traduit), `allowWhileIdle`.

### 7.2 Permissions Android

| Permission | Déclarée par | Pourquoi |
| --- | --- | --- |
| `POST_NOTIFICATIONS` | manifeste du plugin (fusionné) | Android 13+ : afficher les rappels ; demandée à l'exécution (§ 7.1) |
| `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` | manifeste du plugin | reprogrammer les rappels après un redémarrage |
| `SCHEDULE_EXACT_ALARM` | **non utilisée** | voir ci-dessous |

`SCHEDULE_EXACT_ALARM` n'est **pas** déclarée : un rappel de soin à quelques minutes près reste utile,
et Google Play réserve les alarmes exactes aux réveils et agendas (déclaration et justification
exigées ; `USE_EXACT_ALARM` est interdite hors de ces catégories). Sans elle, le plugin bascule de
lui-même sur `setAndAllowWhileIdle` (alarme inexacte compatible Doze). À reconsidérer seulement si des
retards importants sont constatés sur appareil (et alors la demander à l'utilisateur, jamais
`USE_EXACT_ALARM`).

iOS : aucune clé `Info.plist` pour les notifications locales ; la permission est demandée par
`requestPermissions()` au moment décrit au § 7.1.

## 8. Universal Links / App Links (W6-09)

- Servir `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json` depuis le site web
  (déjà exclus du middleware dans `src/proxy.ts`). `assetlinks.json` : empreintes SHA-256 de la clé
  d'upload **et** de Play App Signing.
- iOS : capability *Associated Domains* `applinks:<domaine>` ; Android : `intent-filter` `autoVerify`.
- Dans l'app : `App.addListener('appUrlOpen', …)` (`@capacitor/app`) → convertir l'URL web en route de
  l'app (mêmes règles que l'amorce, ex. `/fr/animal-public/<slug>` → `/fr/animal-public?slug=<slug>`)
  puis `router.push`.

### 8.1 Fichiers d'association (site web)

Route handlers `src/app/.well-known/apple-app-site-association/route.ts` et
`src/app/.well-known/assetlinks.json/route.ts` (`force-static`), contenu construit par
`src/lib/app-links.ts` **au build** à partir de :

| Variable (Netlify) | Défaut | Fichier |
| --- | --- | --- |
| `APPLE_TEAM_ID` | — | `apple-app-site-association` |
| `IOS_BUNDLE_ID` | `app.captivia` | `apple-app-site-association` |
| `ANDROID_PACKAGE_NAME` | `app.captivia` | `assetlinks.json` |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | — | `assetlinks.json` (liste séparée par des virgules) |

- Valeur manquante ou mal formée (Team ID ≠ 10 caractères majuscules, empreinte ≠ 32 octets…) :
  **404** `text/plain`, `Cache-Control: no-store` — jamais un fichier invalide qu'Apple ou Google
  mettrait en cache.
- Sinon : **200** `application/json`, `Cache-Control: public, max-age=3600`, sans redirection (exigé
  par Apple). `src/proxy.ts` laisse passer `/.well-known/*` sans préfixe de locale.
- Chemins déclarés à iOS (avec et sans préfixe de locale) : `/mes-animaux`, `/mes-animaux/*`,
  `/animal-public/*`, `/species/*`, `/especes`, `/reset-password`, `/verifier-email`. La landing et les
  pages légales restent dans le navigateur.
- Écartés de l'export mobile (`scripts/build-mobile.mjs`).

Contrôle local :

```bash
APPLE_TEAM_ID=ABCDE12345 ANDROID_SHA256_CERT_FINGERPRINTS="AA:BB:…" npm run build
cd .next/standalone/frontend && PORT=3000 node server.js &
curl -sI http://127.0.0.1:3000/.well-known/apple-app-site-association   # 200, application/json
curl -s  http://127.0.0.1:3000/.well-known/assetlinks.json
```

### 8.2 iOS : Associated Domains

1. developer.apple.com → *Identifiers* → `app.captivia` : cocher **Associated Domains**.
2. Xcode → cible App → *Signing & Capabilities* → **+ Capability → Associated Domains** :
   `applinks:captivia-app.netlify.app` (puis le domaine définitif ; un domaine par ligne). Le fichier
   `App.entitlements` est versionné avec le projet iOS.
3. Apple récupère le fichier via son CDN à l'installation :
   `https://app-site-association.cdn-apple.com/a/v1/captivia-app.netlify.app`. En développement,
   `applinks:captivia-app.netlify.app?mode=developer` + *Réglages → Développeur → Associated Domains
   Development* contournent le cache.

### 8.3 Android : intent-filter `autoVerify`

Dans `mobile/android/app/src/main/AndroidManifest.xml`, sur `MainActivity` (déjà
`launchMode="singleTask"` dans le gabarit Capacitor) :

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="captivia-app.netlify.app" />
    <data android:pathPrefix="/mes-animaux" />
    <data android:pathPrefix="/animal-public/" />
    <data android:pathPrefix="/species/" />
    <data android:path="/especes" />
    <data android:path="/reset-password" />
    <data android:path="/verifier-email" />
    <!-- Préfixe de locale (/en/…, /de/…) -->
    <data android:pathPattern="/../mes-animaux.*" />
    <data android:pathPattern="/../animal-public/.*" />
    <data android:pathPattern="/../species/.*" />
    <data android:pathPattern="/../especes" />
    <data android:pathPattern="/../reset-password" />
    <data android:pathPattern="/../verifier-email" />
</intent-filter>
```

Vérification sur appareil : `adb shell pm verify-app-links --re-verify app.captivia` puis
`adb shell pm get-app-links app.captivia` (état `verified`), ou l'API
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://captivia-app.netlify.app&relation=delegate_permission/common.handle_all_urls`.

### 8.4 Empreintes SHA-256 (Play App Signing)

Avec Play App Signing, Google re-signe l'app : l'empreinte à déclarer est celle de la **clé de
signature de Google**, plus celle de la **clé d'upload** (builds installés hors Play : tests internes,
`bundletool`).

1. Play Console → l'app → *Tester et publier → Configuration → Intégrité de l'application* → onglet
   **Signature de l'application** : copier « Empreinte du certificat SHA-256 » de la **clé de signature
   de l'application** et de la **clé d'importation** (la page propose aussi un extrait
   « Digital Asset Links JSON » à recouper).
2. À défaut (avant la première publication), clé d'upload locale :
   `keytool -list -v -keystore upload-keystore.jks -alias upload` → ligne `SHA256:`.
3. `ANDROID_SHA256_CERT_FINGERPRINTS` = les deux valeurs séparées par une virgule (format
   `AA:BB:…:FF`, ou 64 caractères hexadécimaux), puis redéployer le site.
4. Clé de debug (`~/.android/debug.keystore`, mot de passe `android`) : seulement sur un site de
   test, jamais en production.

### 8.5 Réception dans l'app (`src/lib/deep-links.ts`)

`mapWebUrlToAppRoute(url, { locale })` (fonction pure, testée) :

| URL du site | Route de l'app |
| --- | --- |
| `/mes-animaux/<id>`, `/en/mes-animaux/<id>` | `/fr/mes-animaux/detail/?id=<id>`, `/en/…` |
| `/mes-animaux/<id>/carnet` | `/<locale>/mes-animaux/carnet/?id=<id>` |
| `/species/<id>` | `/<locale>/species/?id=<id>` |
| `/animal-public/<slug>` (QR) | `/<locale>/animal-public/?slug=<slug>` |
| `/reset-password?token=…`, `/verifier-email?token=…` | même page, seul `token` conservé |
| `/especes?q=…&groupe=…`, `/agenda`, `/parametres/…`, `/login`… | même page |
| chemin inconnu, identifiant invalide | accueil de l'app `/<locale>/mes-animaux/` |
| autre domaine, schéma non http(s), identifiants dans l'URL | `null` : lien ignoré |

Sans préfixe, la locale courante de l'app est utilisée. Domaines acceptés : hôte de
`NEXT_PUBLIC_SITE_URL`, `captivia-app.netlify.app`, et leurs variantes `www.`. Les routes produites ont
la barre finale de l'export statique (`trailingSlash`).

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
- [ ] Universal / App Links : `APPLE_TEAM_ID` et `ANDROID_SHA256_CERT_FINGERPRINTS` (Play App Signing +
      upload) sur Netlify, *Associated Domains* et `intent-filter autoVerify` en place (§ 8).
- [ ] Icône de notification `ic_stat_captivia` ; aucune `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (§ 7.2).

### À vérifier sur appareil réel (non couvert par jest / Playwright)

- Liens sortants (source GBIF, crédit photo, boutique) : ouverture dans Safari / Chrome, retour à
  l'app intact ; CGU depuis l'inscription : page du site, formulaire conservé.
- Photo : feuille « Prendre une photo / Choisir dans la galerie », refus puis autorisation dans les
  réglages, orientation, poids après compression. Android : app tuée par le système pendant la prise
  de vue (`appRestoredResult` non géré à ce jour : la photo est alors perdue).
- Rappels : permission proposée après connexion / essai invité (pas au lancement), rappels reçus app
  fermée, en mode avion, après redémarrage (Android) ; 64 au plus avec une routine horaire ; « Couper »
  vide la liste ; clic → fiche ; retard toléré sans alarme exacte (Doze).
- Liens universels : lien de réinitialisation et QR public ouverts depuis Mail / Gmail / l'appareil
  photo, à froid et app ouverte ; lien d'un autre domaine ignoré.
- Bouton retour Android : modale fermée, puis historique, puis sortie de l'app.

## 10. CI

`.github/workflows/mobile.yml` (déclenchement manuel `workflow_dispatch`) : `npm ci`, tests,
`npm run build:mobile`, puis `npx cap add` (si le projet natif n'est pas versionné) et `npx cap sync`
pour Android (Ubuntu) et, en option, iOS (macOS). Aucune signature : l'export `out/` est publié en
artefact. La signature et la publication (`bundleRelease`, fastlane `beta`) relèvent de W6-12.
