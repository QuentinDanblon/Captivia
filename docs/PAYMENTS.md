# Paiements — abonnement Premium via achats intégrés (W6-08, MOB-30)

Captivia Premium (formules mensuelle et annuelle ; prix fixés dans App Store Connect et la Play Console — `[À COMPLÉTER]`, jamais codés en dur dans l’app) est vendu **uniquement** par les achats intégrés
Apple App Store et Google Play, via **RevenueCat**. Il n'y a **aucun paiement web** (pas de
Stripe) : `POST /users/me/subscription` répond 501 « Abonnement disponible dans l'application
mobile ». `User.isPremium` reste l'activation **manuelle** par un opérateur (rétrocompatible).

## Architecture

```
App Capacitor ──(SDK @revenuecat/purchases-capacitor, appUserID = User.id Captivia)──► RevenueCat
      │                                                                                   │
      └──► App Store / Google Play (paiement, renouvellement, remboursement)              │
                                                                                          ▼
        POST /webhooks/revenuecat (Authorization: Bearer REVENUECAT_WEBHOOK_SECRET) ──► API Captivia
                                                                                          │
                          PaymentEvent (idempotence par event.id) + Subscription (source APPLE/GOOGLE)
```

- **Droit premium** (`EntitlementService.isPremium(userId)`, `effectivePremium()` dans
  `backend/src/common/operators.ts`) : rôle `OPERATOR` **ou** `User.isPremium` **ou** une
  `Subscription` `ACTIVE` / `IN_GRACE_PERIOD` / `CANCELLED` dont `currentPeriodEnd` est future.
- **Webhook** (`backend/src/subscription/revenuecat-webhook.*`) : secret comparé en temps
  constant (401 sinon), pas de throttling, corps ≤ 64 Ko, idempotent (`PaymentEvent.eventId`
  unique), événements plus anciens que le dernier appliqué (`event_timestamp_ms`) ignorés,
  `app_user_id` inconnu → 200 journalisé sans rien créer, `subscriber_attributes` non stockés.

| Événement RevenueCat | Effet sur `Subscription` |
|---|---|
| INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, UNCANCELLATION, NON_RENEWING_PURCHASE | `ACTIVE`, échéance = `expiration_at_ms` |
| CANCELLATION | `CANCELLED` (accès jusqu'à l'échéance) ; `cancel_reason=CUSTOMER_SUPPORT` (remboursement) → `REFUNDED`, accès retiré immédiatement |
| BILLING_ISSUE | `IN_GRACE_PERIOD` jusqu'à `grace_period_expiration_at_ms`, sinon `BILLING_ISSUE` (pas d'accès) |
| EXPIRATION | `EXPIRED` |
| TRANSFER | abonnements des comptes `transferred_from` rattachés au compte `transferred_to` |
| TEST, autres | journalisés, ignorés |

`GET /users/me/subscription` → `{ premium, source, status, productId, currentPeriodEnd,
willRenew, manageUrl }` (+ `isPremium`, `plan` pour les anciens clients). `manageUrl` pointe
vers la gestion App Store ou Google Play selon la source.

## Configuration pas à pas

### Variables (Render, `sync: false`)

| Variable | Rôle |
|---|---|
| `IAP_ENABLED` | `true` en production dès la mise en vente : rend le secret obligatoire au démarrage |
| `REVENUECAT_WEBHOOK_SECRET` | secret ≥ 32 caractères (`openssl rand -hex 32`) |
| `REVENUECAT_ENTITLEMENT_ID` | entitlement qui ouvre le premium (défaut `premium`) |
| `GOOGLE_PLAY_PACKAGE_NAME` | package Android, pour le lien « Gérer mon abonnement » |

### Variables de l'app (build mobile, inlinées : clés **publiques** RevenueCat)

À fournir à `npm run build:mobile` (GitHub Variables `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`
pour le workflow `mobile.yml`). Sans clé, la plateforme concernée affiche « Abonnement indisponible pour
le moment » et aucun achat n'est possible ; le web n'en a pas besoin.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY` | clé publique iOS (`appl_…`, RevenueCat > Project settings > API keys) |
| `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` | clé publique Android (`goog_…`) |
| `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | facultatif, défaut `premium` : **identique** à `REVENUECAT_ENTITLEMENT_ID` (backend) |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | Netlify : fiches stores affichées sur la page abonnement du web (`[À COMPLÉTER]` tant qu'elles n'existent pas) |

### App Store Connect

1. Accords, taxes et coordonnées bancaires signés (contrat « Paid Apps »).
2. App > Abonnements : créer un **groupe d'abonnements** « Captivia Premium » contenant deux
   abonnements **auto-renouvelables** : mensuel et annuel (prix `[À COMPLÉTER]` par le propriétaire), avec nom
   localisé, description et capture d'écran de revue.
3. Utilisateurs et accès > Intégrations > **clé In-App Purchase** (fichier .p8) + Issuer ID,
   à téléverser dans RevenueCat ; renseigner aussi le secret partagé spécifique à l'app.
4. Comptes testeurs **Sandbox**.

### Google Play Console

1. Profil marchand actif ; app publiée au moins en test interne.
2. Monétiser > Produits > **Abonnements** : un abonnement avec deux *base plans*
   (mensuel, annuel, renouvellement automatique), prix localisés.
3. Google Cloud : **compte de service** avec accès à l'API Google Play Developer, invité dans
   Play Console (droits financiers + gestion des commandes) ; JSON téléversé dans RevenueCat.
4. (Recommandé) Notifications en temps réel (RTDN) vers le topic Pub/Sub fourni par RevenueCat.
5. Testeurs de licence.

### RevenueCat

1. Créer le projet et les apps iOS / Android (bundle id, package, identifiants ci-dessus).
2. Importer les produits ; créer l'**entitlement `premium`** et y attacher les 4 produits.
3. Créer l'**offering** par défaut avec les packages `$rc_monthly` et `$rc_annual`.
4. Integrations > **Webhooks** : URL `https://<api>/webhooks/revenuecat`, en-tête
   d'autorisation `Bearer <REVENUECAT_WEBHOOK_SECRET>`, environnements Sandbox + Production.
5. Envoyer un événement de test (réponse attendue 200, `outcome: ignored_type`).

## Checklist de conformité stores

- [x] Bouton **Restaurer mes achats** (`Purchases.restorePurchases()`), toujours visible sur le paywall.
- [x] Prix, durée et **renouvellement automatique** affichés avant l'achat (prix et période lus dans
      l'offering ; texte de renouvellement propre à l'App Store — résiliation 24 h avant — et à Google Play).
- [x] Liens **CGU** et **Politique de confidentialité** sur le paywall (navigateur du système) ;
      à reporter aussi dans la fiche store (champ EULA / Conditions d'utilisation).
- [x] Aucun lien ni mention de paiement externe dans l'app (le web n'en propose pas).
- [x] Gestion / résiliation : « Gérer mon abonnement » (`manageUrl` de l'API, sinon page d'abonnements du store).
- [x] **Suppression de compte** dans l'app ; le paywall rappelle qu'elle ne résilie pas l'abonnement store.
- [ ] Achats testés en Sandbox (iOS) et avec testeurs de licence (Android).

## Côté app (W6-08, livré)

- **`frontend/src/lib/purchases.ts`** (plugin importé à la demande, sans effet sur le web) :
  - identité : `Purchases.configure({ apiKey, appUserID: user.id })` à la connexion d'un **compte**
    (jamais d'un invité), `logIn` si un autre compte se connecte, `logOut` à la déconnexion ou au retour
    en invité (`NativeBridge`, `syncPurchasesUser`) ; appels enchaînés, idempotents ;
  - offering courante : packages `$rc_monthly` puis `$rc_annual` (sinon tout abonnement dont le store
    donne la durée) ; prix (`priceString`), période ISO 8601 et offre d'introduction lus dans le store ;
  - achat (`purchasePackage`), restauration (`restorePurchases`), état client (`getCustomerInfo`) ;
    erreurs classées : annulation (silencieuse), réseau / hors ligne, produit indisponible, achats
    interdits, paiement en attente, déjà abonné, store ;
  - **le backend reste la source de vérité** : après un achat ou une restauration, `waitForBackendPremium`
    relit `GET /auth/me` (1 s, 1,5 s, 2,5 s, 4 s puis toutes les 6 s) jusqu'à `isPremium: true`, 30 s au
    plus ; au-delà, « Activation en cours… » avec un bouton « Vérifier ». L'entitlement vu par le SDK
    n'ouvre jamais le Premium à lui seul.
- **Paywall** (`src/components/purchases/NativePaywall.tsx`) : page *Paramètres > Abonnement* dans l'app,
  et modale ouverte par l'emplacement verrouillé « Ajouter un animal » (compte gratuit, app native).
  Invité : création de compte d'abord. Web : aucune offre d'achat, explication et liens stores.
- Tests : `src/lib/__tests__/purchases.test.ts`, `src/components/__tests__/NativePaywall.test.tsx`,
  `AddAnimalLockedSlot.test.tsx`, `NativeBridge.test.tsx`.
- Natif (à la création des projets) : capacité **In-App Purchase** dans Xcode ; côté Android, la
  permission `com.android.vending.BILLING` est apportée par le plugin.

## Évolution possible sans RevenueCat (non implémentée)

Recevoir directement **App Store Server Notifications v2** (JWS signés, vérification de la
chaîne Apple) et **Google Real-time Developer Notifications** (Pub/Sub + appel à
`purchases.subscriptionsv2.get`), avec validation serveur des reçus. Les modèles
`Subscription` / `PaymentEvent` (provider, eventId unique) sont prévus pour cela.
