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
| Icônes, splash, icône de notification | `frontend/mobile/assets/` (sources), `frontend/mobile/android-template/res/` (notification), script `frontend/scripts/make-mobile-assets.mjs` (§ 11) |
| Push natif FCM / APNs (W6-07) | `frontend/src/lib/native-push.ts`, `backend/src/notifications/` (`native-push-sender.ts`, `fcm-client.ts`, `device-tokens.*`) (§ 7.3) |
| Fiches store, déclarations, âge | `docs/store/` (§ 12) ; `frontend/mobile/ios-template/PrivacyInfo.xcprivacy` |
| CI | `.github/workflows/mobile.yml` (manuel ; APK de debug, AAB signé optionnel) (§ 10) |

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
CSP. `NEXT_PUBLIC_SENTRY_DSN` est facultatif (même rôle que sur le web). `NEXT_PUBLIC_REVENUECAT_IOS_KEY` /
`NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` ouvrent l'achat intégré (§ 6) ; le SDK appelle RevenueCat depuis le
code natif, hors de la WebView : rien à ajouter à la CSP. `NEXT_PUBLIC_NATIVE_PUSH=1` active le push
natif (§ 7.3), uniquement avec la configuration Firebase dans les projets natifs ; FCM et APNs sont
joints par le code natif : rien à ajouter à la CSP non plus.

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
| `/communaute/publication/<id>` | `/communaute/publication?id=<id>` |
| `/communaute/u/<pseudo>` | `/communaute/u?handle=<pseudo>` |
| `/communaute/decisions/<id>` | `/communaute/decisions?id=<id>` (la page liste lit le paramètre) |

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
| `@capacitor/push-notifications` | 7.0.x | push natif FCM / APNs (`src/lib/native-push.ts`, § 7.3) |
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
- rappels locaux puis push natif : synchronisation après la connexion (invité compris), à chaque
  retour au premier plan (`appStateChange`) et après la création d'un soin (`captivia:care-scheduled`),
  annulation à la déconnexion, notification touchée (locale ou distante) → fiche de l'animal (§ 7) ;
- explication préalable (`NotificationPrimer`) avant la demande de permission système (§ 7.1) ;
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

`@revenuecat/purchases-capacitor` (v11, compatible Capacitor 7) est branché : `src/lib/purchases.ts`
(configure / logIn / logOut suivant la session, offering, achat, restauration, attente du webhook) et
paywall `src/components/purchases/NativePaywall.tsx` (page abonnement, modale du deuxième animal). Clés
publiques au build : `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` (sans clé :
achat désactivé, message propre). Produits, offerings, webhook et sandbox : **`docs/PAYMENTS.md`**. Aucun
lien vers un paiement web dans l'app (règle 3.1.1). Xcode : ajouter la capacité *In-App Purchase*.

## 7. Notifications locales

`@capacitor/local-notifications` (W6-06) : rappels de routines, médicaments, vaccins et RDV programmés
sur l'appareil, fonctionnent hors ligne. Icône Android `ic_stat_captivia` (silhouette blanche sur fond transparent, versionnée dans
`mobile/android-template/res/drawable-*/` : à copier après `cap add android`, § 11.2), couleur `#0aa678` (`capacitor.config.ts`). Android 13+ :
demander `POST_NOTIFICATIONS` ; Android 14+ : `SCHEDULE_EXACT_ALARM` seulement si nécessaire. Le push
distant (FCM/APNs, W6-07) complète ces rappels : § 7.3.

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
- **Permission** (une seule autorisation système pour les rappels locaux et le push natif) : jamais
  au lancement à froid. Une **explication préalable** (`NotificationPrimer` : « Être prévenu à
  l'heure des soins ? », boutons « Activer les rappels » / « Plus tard ») est proposée **une seule
  fois par appareil** : (1) à la création du premier soin (routine, médicament, vaccin, rendez-vous ;
  événement `captivia:care-scheduled` émis par `api.ts`) ; (2) juste après une connexion faite
  pendant l'exécution, s'il y a au moins un soin à rappeler. Seul « Activer » ouvre la boîte de
  dialogue du système ; « Plus tard » ne demande rien. (3) Le bouton « Activer les rappels sur ce
  téléphone » des paramètres de notifications demande directement (action explicite). Refusée dans
  les réglages : jamais redemandée, la carte explique comment la rétablir.
- **Couper les rappels** (paramètres de notifications → « Sur cet appareil », carte native qui
  remplace le Web Push dans l'app) : tous les rappels programmés sont annulés et plus rien n'est
  programmé jusqu'à réactivation.
- **Clic** sur un rappel : `localNotificationActionPerformed` → fiche de l'animal (`animalDetailPath`).
- **Android** : canal `captivia-reminders-v2` (importance haute, nom traduit, **visibilité privée** :
  sur l'écran verrouillé, « contenu masqué » — le titre d'un rappel peut contenir le nom d'un
  médicament, sa dose ou le nom du vétérinaire), `allowWhileIdle`. La visibilité d'un canal existant
  ne pouvant plus être modifiée par une app, l'ancien canal `captivia-reminders` (visibilité
  publique) est supprimé à chaque synchronisation (`deleteChannel`) et les rappels sont reprogrammés
  sur le nouveau : pas de doublon dans les réglages. Le texte complet reste affiché une fois le
  téléphone déverrouillé.
- **iOS** : rien à forcer ; l'affichage des aperçus sur l'écran verrouillé est un réglage de
  l'utilisateur (*Réglages → Notifications → Afficher les aperçus* : « Si déverrouillé » masque le
  texte des rappels, push compris).

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

### 7.3 Push natif FCM / APNs (W6-07)

**Choix** : **Firebase Cloud Messaging pour les deux plateformes**, iOS compris (FCM relaie vers
APNs avec la clé `.p8` téléversée dans Firebase). Un seul fournisseur gratuit (FCM n'a ni quota
payant ni facturation), un seul jeton par installation, une seule clé côté serveur. L'API appelle
l'**API HTTP v1** directement (assertion JWT RS256 signée avec la clé du compte de service, sans
SDK Firebase Admin : aucune dépendance ajoutée). Sans `FCM_SERVICE_ACCOUNT_JSON`, le canal natif est
désactivé (journal « info » au démarrage), comme le Web Push sans clés VAPID.

**Interrupteur de build** : `NEXT_PUBLIC_NATIVE_PUSH=1` (build mobile ; variable GitHub `NATIVE_PUSH`
pour `mobile.yml`), à poser **seulement** quand les projets natifs contiennent la configuration
Firebase (§ 7.3.1 à 7.3.3). Sans lui, l'app n'appelle jamais `PushNotifications.register()` : sur
Android, cet appel fait planter l'app si `google-services.json` manque (Firebase non initialisé).
`mobile.yml` échoue si `NATIVE_PUSH=1` sans le secret `GOOGLE_SERVICES_JSON_BASE64`.

**Ce qui part en push** : les mêmes rappels que le Web Push (scheduler W3-02 : routines, médicaments,
vaccins, rendez-vous, types personnalisés) et la notification de test. `PushDispatcher` envoie sur
tous les canaux actifs du compte (navigateurs abonnés **et** installations de l'app), une fois par
appareil ; les préférences existantes s'appliquent (`deliveryChannel` « e-mail seul » : aucun push ;
types désactivés : aucun rappel généré). Il n'existe pas d'heures calmes réglables aujourd'hui (la
fenêtre `schedule` des préférences n'est pas exposée ni appliquée, y compris au Web Push).

**Anti-doublon avec les rappels locaux (§ 7.1)** : un rappel n'est retenu côté serveur que si l'app
programme **réellement ce rappel-là, à cet instant-là** (revue de sécurité W6-07, constat 1). Après
chaque synchronisation réussie depuis le réseau, l'app envoie `localRemindersUntil` (fin de
l'horizon de 30 jours, ou instant du 64ᵉ rappel si la limite iOS est atteinte) et
`localRemindersAsOf` (`generatedAt` de l'Agenda programmé, horloge serveur). Le serveur ne pousse
**pas** à cet appareil un rappel qui remplit toutes ces conditions (`localReminderFor`,
`coveredLocally`) :

- c'est une **routine** ou un **médicament** dont l'Agenda contient une occurrence **au même instant**
  (mêmes fonctions de calcul : `agenda-occurrences.ts`) ; un médicament hebdomadaire un autre jour ou
  une prise « toutes les N heures » qui ne tombe pas à 08:00 n'est donc pas couvert ;
- l'instant précède `localRemindersUntil` ;
- la routine / le médicament n'a **pas été modifié depuis** `localRemindersAsOf` (sinon, par exemple
  une routine créée depuis le site pendant que l'app est en arrière-plan, le push part).

Ne sont **jamais** couverts, donc toujours poussés : les **RDV vétérinaires** (l'app ne programme
qu'une notification à l'heure du RDV, le serveur envoie les rappels J-N et celui du jour à 08:00),
les **vaccins** (l'app rappelle à 9 h heure du téléphone, le serveur à 08:00 heure du compte : deux
notifications ce jour-là), les types personnalisés (absents de l'agenda). Sans `localRemindersAsOf`,
ou si l'Agenda a été tronqué par l'API, aucune couverture n'est retenue (anti-perte avant
anti-doublon). Valeur bornée à 31 jours côté serveur. L'app demande l'Agenda de J-2 à J+31 (jours du
téléphone) pour que tous les soins de la couverture y figurent même si le téléphone n'est pas dans
le fuseau du compte. Limite connue : après un changement de fuseau du compte, les rappels locaux
suivent au prochain retour au premier plan.

**Cycle de vie du jeton** (`src/lib/native-push.ts`) :

- enregistré (`POST /users/me/device-tokens`) seulement si la permission est accordée, après chaque
  synchronisation des rappels (lancement avec session, retour au premier plan, soin créé, bouton des
  paramètres) : `lastSeenAt` reste à jour ;
- rafraîchi : nouvel événement `registration` → renvoyé avec `previousToken` (l'ancien est supprimé) ;
- retiré : déconnexion (`/auth/logout` avec `deviceToken` + `DELETE`), « Couper les rappels sur ce
  téléphone », permission retirée dans les réglages, logout-all, suppression du compte, purge des
  invités, réponse `UNREGISTERED` / `INVALID_ARGUMENT` (jeton) de FCM, 270 jours sans
  réenregistrement (maintenance). `SENDER_ID_MISMATCH` ne purge **pas** : c'est presque toujours une
  clé de compte de service d'un autre projet Firebase (erreur de configuration, RUNBOOK § 4.7) ;
- invalidé auprès de FCM / APNs (`PushNotifications.unregister()`) à chaque retrait côté app, y
  compris à la déconnexion **forcée** (session expirée ou révoquée : `auth:logout`) et hors ligne :
  si le `DELETE` n'a pas abouti, FCM répond `UNREGISTERED` au prochain envoi et le serveur purge la
  ligne. La reconnexion (ou la réactivation des rappels) appelle `register()`, qui fournit un nouveau
  jeton ;
- un jeton enregistré par un autre compte (téléphone prêté, déconnexion hors ligne) lui est retiré ;
  le compte qui le reprend reste plafonné à 10 installations (les moins récemment vues partent).

**Notification touchée** : `pushNotificationActionPerformed` → `data.animalId` → fiche de l'animal
(`animalDetailPath`), sinon l'agenda. Au premier plan, la notification est affichée aussi
(`presentationOptions` de `capacitor.config.ts`).

**Contrat API** (JWT, invités compris, 30 requêtes / min / IP) :

| Route | Corps | Réponse |
| --- | --- | --- |
| `POST /users/me/device-tokens` | `{ token, platform: "android"\|"ios", locale?, localRemindersUntil?: ISO\|null, localRemindersAsOf?: ISO, previousToken? }` | `200 { enabled, platform, lastSeenAt }` (`enabled` : FCM configuré côté serveur) |
| `DELETE /users/me/device-tokens` | `{ token }` | `200 { success: true }` (idempotent) |
| `POST /auth/logout` | `{ refreshToken, endpoint?, deviceToken? }` | `200` |

`token`, `previousToken`, `deviceToken` : 32 à 512 caractères `[A-Za-z0-9_:-]` (CHECK SQL
identique) ; champ inconnu → 400. `localRemindersUntil` sans `localRemindersAsOf` : aucune
couverture retenue.

#### 7.3.1 Projet Firebase (gratuit, une fois)

1. <https://console.firebase.google.com> → **Ajouter un projet** (« captivia »), Google Analytics
   **désactivé** (inutile, et il ajouterait une collecte à déclarer).
2. **Android** : *Ajouter une application* → Android, nom de package `app.captivia` → télécharger
   **`google-services.json`**. Le placer dans `frontend/mobile/android/app/google-services.json`
   (**jamais commité** : `.gitignore`). Le gabarit Capacitor applique le plugin Gradle
   `com.google.gms.google-services` dès que ce fichier existe. CI : secret
   `GOOGLE_SERVICES_JSON_BASE64` (`base64 -w0 google-services.json`), écrit par `mobile.yml` avant le
   build (sans lui, l'APK se construit sans push).
3. **iOS** : *Ajouter une application* → iOS, bundle ID `app.captivia` → télécharger
   **`GoogleService-Info.plist`**, l'ajouter dans Xcode au groupe `App` (cible cochée). Non commité.
4. **Clé APNs** : developer.apple.com → *Certificates, IDs & Profiles* → *Keys* → **+** → cocher
   *Apple Push Notifications service (APNs)* → télécharger `AuthKey_<KEYID>.p8` (une seule fois ;
   la ranger dans le coffre de l'équipe, jamais dans le dépôt). Firebase → *Paramètres du projet* →
   *Cloud Messaging* → *Configuration de l'application Apple* → **Clé d'authentification APNs** →
   téléverser le `.p8` avec le **Key ID** et le **Team ID**. Une clé `.p8` sert en développement et
   en production, et n'expire pas.
5. **Compte de service pour l'API** : Firebase → *Paramètres du projet* → *Comptes de service* →
   *Générer une nouvelle clé privée* (JSON). Sur Render : `FCM_SERVICE_ACCOUNT_JSON` =
   `base64 -w0 captivia-firebase-adminsdk-xxxx.json` (et facultativement `FCM_PROJECT_ID`) ; voir
   `docs/DEPLOY.md`. Supprimer le fichier local ensuite. Rotation : `docs/RUNBOOK.md`.

#### 7.3.2 Android

- `variables.gradle` : `firebaseMessagingVersion` (défaut du plugin 24.1.0) peut rester tel quel.
- `AndroidManifest.xml`, dans `<application>` : icône et couleur des notifications affichées par
  le plugin au premier plan (en arrière-plan, l'API envoie déjà `icon` / `color` / `channel_id`) :

```xml
<meta-data android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@drawable/ic_stat_captivia" />
<meta-data android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/captivia_notification" />
<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="captivia-reminders-v2" />
```

  avec `<color name="captivia_notification">#0AA678</color>` dans `res/values/colors.xml`. Le canal
  `captivia-reminders-v2` (visibilité privée) est créé par l'app (§ 7.1) et l'API l'indique dans
  chaque message (`android.notification.channel_id`) ; `POST_NOTIFICATIONS` est déjà déclarée.

#### 7.3.3 iOS (Xcode)

1. Cible *App* → *Signing & Capabilities* → **+ Capability** → **Push Notifications**, puis
   **Background Modes** → cocher **Remote notifications**. (developer.apple.com : l'identifiant
   `app.captivia` doit avoir *Push Notifications* coché ; les profils sont régénérés.)
2. Ajouter **FirebaseMessaging** (Swift Package Manager : `https://github.com/firebase/firebase-ios-sdk`,
   produit `FirebaseMessaging` ; ou CocoaPods : `pod 'FirebaseMessaging'` dans `ios/App/Podfile`).
3. `AppDelegate.swift` : le plugin Capacitor reçoit le jeton **APNs** ; on le confie à Firebase et on
   transmet à Capacitor le jeton **FCM** (celui que l'API sait utiliser) :

```swift
import FirebaseCore
import FirebaseMessaging

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    FirebaseApp.configure()
    return true
}

func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
    Messaging.messaging().token { token, error in
        if let error = error {
            NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
        } else if let token = token {
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
        }
    }
}

func application(_ application: UIApplication,
                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

4. `PrivacyInfo.xcprivacy` : FirebaseMessaging embarque son propre manifeste ; vérifier le rapport
   de confidentialité Xcode (*Generate Privacy Report*). App Privacy : l'identifiant d'appareil
   (jeton push) est une donnée « Identifiants → ID de l'appareil » liée au compte, finalité
   « Fonctionnalité de l'app », sans suivi (`docs/store/declarations-confidentialite.md`).

#### 7.3.4 Vérifier sur appareil

0. Build mobile avec `NEXT_PUBLIC_NATIVE_PUSH=1` (après 7.3.1 à 7.3.3), puis `npx cap sync`.
1. API avec `FCM_SERVICE_ACCOUNT_JSON` : journal `Push natif actif (FCM HTTP v1, projet …)`.
2. App installée, connecté, permission accordée : une ligne `DeviceToken` apparaît
   (`platform`, `lastSeenAt`).
3. *Paramètres → Notifications* (site ou app) → **notification de test** : reçue app fermée et app
   ouverte ; toucher → l'app s'ouvre (fiche de l'animal pour un rappel).
4. Désinstaller l'app puis renvoyer un test : FCM répond `UNREGISTERED`, la ligne est supprimée.
5. Se déconnecter : la ligne disparaît ; « Couper les rappels sur ce téléphone » aussi.

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
- [ ] Icônes et splash (`npm run assets:mobile`, § 11), captures 6,9" / 6,5" et Play (`npm run screenshots:store`), fiches FR/EN (`docs/store/`, `npm run store:check`) (W6-10) : sources prêtes ; logo définitif (D-15) à substituer.
- [ ] `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`
      (Info.plist) ; permissions Android minimales (W6-05).
- [ ] `PrivacyInfo.xcprivacy` (§ 12), App Privacy, Data Safety, questionnaire d'âge Apple, IARC (`docs/store/`) (W6-11) : réponses rédigées, saisie dans les consoles à faire.
- [ ] Suppression de compte dans l'app **et** page web publique (`/suppression-compte`).
- [ ] Liens Amazon via `openExternal`, mention d'affiliation, app déclarée dans Associates Central.
- [ ] Sandbox IAP testée (paywall conforme livré, clés RevenueCat au build) (W6-08).
- [ ] Compte de démo rempli pour la relecture, aucun « bientôt disponible » (W6-13).
- [ ] TestFlight + test fermé Play.
- [ ] Signature : keystore (secrets `ANDROID_KEY*`, § 10) et certificats iOS (fastlane match, § 13) en secrets CI, jamais dans le dépôt (W6-12).
- [ ] Universal / App Links : `APPLE_TEAM_ID` et `ANDROID_SHA256_CERT_FINGERPRINTS` (Play App Signing +
      upload) sur Netlify, *Associated Domains* et `intent-filter autoVerify` en place (§ 8).
- [ ] Icône de notification `ic_stat_captivia` (copier `mobile/android-template/res/`, § 11.2) ; aucune `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (§ 7.2).
- [ ] Push natif (W6-07, § 7.3) : projet Firebase, `google-services.json` (secret CI `GOOGLE_SERVICES_JSON_BASE64`),
      `GoogleService-Info.plist`, clé APNs `.p8` téléversée dans Firebase, capacités *Push Notifications* et
      *Background Modes → Remote notifications*, `AppDelegate` (FirebaseMessaging), `FCM_SERVICE_ACCOUNT_JSON` sur Render,
      puis seulement `NEXT_PUBLIC_NATIVE_PUSH=1` (variable GitHub `NATIVE_PUSH`) au build mobile.

### À vérifier sur appareil réel (non couvert par jest / Playwright)

- Liens sortants (source GBIF, crédit photo, boutique) : ouverture dans Safari / Chrome, retour à
  l'app intact ; CGU depuis l'inscription : page du site, formulaire conservé.
- Photo : feuille « Prendre une photo / Choisir dans la galerie », refus puis autorisation dans les
  réglages, orientation, poids après compression. Android : app tuée par le système pendant la prise
  de vue (`appRestoredResult` non géré à ce jour : la photo est alors perdue).
- Rappels : explication proposée au premier soin créé ou après connexion / essai invité (pas au
  lancement), boîte système seulement sur « Activer », rappels reçus app fermée, en mode avion, après
  redémarrage (Android) ; 64 au plus avec une routine horaire ; « Couper » vide la liste ; clic → fiche ;
  retard toléré sans alarme exacte (Doze).
- Push natif (§ 7.3.4) : notification de test reçue app fermée / ouverte, une seule notification par
  rappel (pas de doublon local + distant), toucher → fiche, jeton retiré à la déconnexion.
- Liens universels : lien de réinitialisation et QR public ouverts depuis Mail / Gmail / l'appareil
  photo, à froid et app ouverte ; lien d'un autre domaine ignoré.
- Bouton retour Android : modale fermée, puis historique, puis sortie de l'app.

## 10. CI (W6-12)

`.github/workflows/mobile.yml` : **`workflow_dispatch` uniquement** (quota GitHub Actions limité : ne pas ajouter
`push` / `pull_request` / `schedule` avant son déblocage).

| Job | Rôle | Condition |
| --- | --- | --- |
| `export` | `npm ci`, tests, `npm run build:mobile`, contrôle de l'arborescence web, artefact `mobile-web-bundle` (`out/`) | toujours |
| `android` | `cap add android` **seulement si `mobile/android` n'est pas versionné** (et `create_missing`), gabarit Captivia (icône de notification, SDK 36, `@capacitor/assets`), `cap sync android`, `./gradlew assembleDebug` → artefact **`captivia-android-debug-apk`** | toujours ; étapes natives ignorées si le projet est absent et `create_missing` est décoché |
| `android-release` | `bundleRelease`, signature `jarsigner` avec la clé d'upload → artefact `captivia-android-release-aab` | **désactivé par défaut** : entrée `android_bundle` ; sans les 4 secrets, le job réussit en annonçant qu'il s'arrête (aucun échec) ; exige un `mobile/android` versionné |
| `ios` | `cap add ios` si absent, puis **`cap sync ios` seulement** (aucun build ni signature) | entrée `ios`, runner macOS |

Entrées : `api_url` (`NEXT_PUBLIC_API_URL`), `create_missing` (défaut `true` : build jetable tant que les projets
natifs ne sont pas versionnés), `android_bundle` (défaut `false`), `ios` (défaut `false`).

**Secrets du job `android-release`** (Settings, Secrets and variables, Actions) :

| Secret | Contenu |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | keystore d'**upload** : `base64 -w0 upload-keystore.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | alias de la clé d'upload |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Avec Play App Signing, Google garde la clé de signature : la clé d'upload peut être remplacée en cas de perte
(Play Console, Intégrité de l'application). Le `versionCode` est celui de `mobile/android/app/build.gradle` : à
incrémenter à la main (ou par fastlane, § 13) avant chaque envoi.

Lancer un build : onglet *Actions*, workflow *Mobile*, *Run workflow*. L'APK de debug se télécharge dans les
artefacts du run (7 jours) et s'installe par `adb install`.

## 11. Icônes, splash et icône de notification (W6-10)

### 11.1 Sources et génération

Les sources sont versionnées dans `frontend/mobile/assets/` ; elles viennent du **logo provisoire** (D-15,
`public/brand/captivia-mark.svg`) recoloré avec les jetons de la direction artistique (mousse `#2F5D46`, papier
`#F6F3EC`, encre sombre `#121714`).

| Fichier | Taille | Usage |
| --- | --- | --- |
| `icon-only.png` | 1024², opaque, plein cadre | iOS, icône « classique » Android |
| `icon-foreground.png` / `icon-background.png` | 1024² | icône adaptative Android (motif réduit dans la zone sûre de 66 %) |
| `splash.png` / `splash-dark.png` | 2732² | écran de lancement clair / sombre |
| `store/play-icon-512.png` | 512² | icône haute résolution de la Play Console |

```bash
cd frontend
npm run assets:mobile:sources   # (re)génère ces PNG avec sharp, de façon reproductible
# plus tard, APRÈS `npx cap add android` et `npx cap add ios` :
npm run assets:mobile           # @capacitor/assets : icônes et splash natifs
```

`assets:mobile` lance `npx @capacitor/assets generate --assetPath mobile/assets --iosProject mobile/ios/App
--androidProject mobile/android` (les projets natifs sont sous `mobile/`, pas aux emplacements par défaut de
l'outil). Il télécharge `@capacitor/assets` à la volée ; rien n'est ajouté aux dépendances. Relancer après chaque
changement du logo, puis commiter les ressources générées dans `mobile/android` et `mobile/ios`.

**Logo maître (D-15)** : quand le designer livre le logo définitif, remplacer le motif dans
`scripts/make-mobile-assets.mjs` (constantes `LEAF_*`) **ou** déposer ses PNG dans `mobile/assets/` sans relancer
le script ; régénérer ensuite les icônes web (`src/app/icon.png`, `apple-icon.png`, `public/icons/*`,
`public/badge.png`, voir `public/brand/README.md`).

### 11.2 Icône de notification Android

`mobile/android-template/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_captivia.png` (24, 36, 48, 72 et
96 px) : silhouette blanche, nervures évidées, fond transparent (Android ne retient que le canal alpha et la teinte
avec `iconColor`, `capacitor.config.ts`). Après `npx cap add android` :

```bash
cp -R mobile/android-template/res/. mobile/android/app/src/main/res/
```

Le nom `ic_stat_captivia` correspond à `plugins.LocalNotifications.smallIcon`. `@capacitor/assets` ne le touche pas
(il écrit les `mipmap-*` et les `drawable-*/splash.png`).

### 11.3 Fiches store et captures

Voir `docs/store/` (`README.md` pour l'ordre des opérations). `npm run store:check` contrôle les longueurs
(titre et sous-titre 30, description courte 80, mots-clés 100, description 4 000, notes de version 500) et la règle
d'écriture ; `npm run screenshots:store` produit les captures (API simulée, rien dans le dépôt).

## 12. Déclarations de confidentialité et d'âge (W6-11)

- `docs/store/declarations-confidentialite.md` : tableau des données réellement collectées (code et registre),
  saisie pas à pas de **App Privacy** (Apple) et de **Sécurité des données** (Google), suppression de compte, points
  de vigilance.
- `docs/store/classification-age.md` : questionnaire d'âge Apple, IARC Google, public cible, et ce que change le volet
  social à venir.
- `frontend/mobile/ios-template/PrivacyInfo.xcprivacy` : à copier après `npx cap add ios` :

```bash
cp mobile/ios-template/PrivacyInfo.xcprivacy mobile/ios/App/App/PrivacyInfo.xcprivacy
# Xcode : clic droit sur le groupe « App », Add Files to "App"…, PrivacyInfo.xcprivacy, cible « App » cochée
```

  Il déclare `UserDefaults` (`CA92.1`, Preferences) et `FileTimestamp` (`C617.1`, Filesystem), l'absence de suivi,
  et les types de données de la fiche App Privacy. Après le premier archivage, contrôler *Generate Privacy Report*
  (les SDK embarquent leurs propres manifestes).
- Android, après `cap add android` : passer `android:allowBackup` à `false` dans `AndroidManifest.xml` (la sauvegarde
  automatique de Google pourrait copier la session).

## 13. À venir (non installé) : fastlane et `@sentry/capacitor`

Rien de ce qui suit n'est dans les dépendances ni dans le workflow aujourd'hui.

**fastlane** (distribution, W6-12 puis W6-13) :

- `frontend/fastlane/Fastfile` avec deux couloirs `beta` : `android` (`gradle` `bundleRelease`, puis `upload_to_play_store`
  vers la piste *interne*, avec un compte de service Google : secret `PLAY_SERVICE_ACCOUNT_JSON`) et `ios` (`match`
  pour les certificats et profils, `build_app`, `upload_to_testflight`).
- iOS : **`fastlane match`** (dépôt privé chiffré pour les certificats, secret `MATCH_PASSWORD`) plus une clé d'API App
  Store Connect (secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_BASE64`), jamais d'identifiants Apple personnels en CI.
  Runner macOS (minutes facturées dix fois plus cher) : à lancer à la demande seulement.
- Numéro de build : `versionCode` / `CURRENT_PROJECT_VERSION` dérivés de `github.run_number` dans le couloir.
- Les fiches `docs/store/` pourront alimenter `fastlane/metadata` (`deliver` / `supply`) ; d'ici là, copier-coller.
- Il remplacerait alors le job `android-release` (signature `jarsigner`) ; le garde « secrets absents » reste valable.

**`@sentry/capacitor`** (rapports de plantage natifs, MOB-43) :

- `npm i @sentry/capacitor`, puis initialisation dans le pont natif, avec le même DSN et les mêmes filtres que le web
  (`sendDefaultPii: false`, `scrubSentryEvent` de `src/lib/sentry-scrub.ts`, traces à 10 %), projet **région UE**,
  « ne pas stocker les adresses IP » activé.
- Source maps du bundle exporté (`out/`) et symboles natifs (dSYM iOS, mapping R8 Android) envoyés par `sentry-cli`
  dans le workflow (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` en secrets), puis `cap sync`.
- Déjà couvert par les déclarations (`CrashData`, `PerformanceData`, journaux de plantage et diagnostics Google) :
  pas de changement de fiche, mais vérifier le rapport de confidentialité Xcode après l'ajout du SDK.
