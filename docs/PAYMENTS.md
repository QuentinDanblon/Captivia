# Paiements — abonnement Premium via achats intégrés (W6-08, MOB-30)

Captivia Premium (5,99 €/mois, 29,99 €/an) est vendu **uniquement** par les achats intégrés
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

### App Store Connect

1. Accords, taxes et coordonnées bancaires signés (contrat « Paid Apps »).
2. App > Abonnements : créer un **groupe d'abonnements** « Captivia Premium » contenant deux
   abonnements **auto-renouvelables** : mensuel (5,99 €) et annuel (29,99 €), avec nom
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

- [ ] Bouton **Restaurer les achats** (`Purchases.restorePurchases()`).
- [ ] Prix, durée et **renouvellement automatique** affichés avant l'achat (texte du store).
- [ ] Liens **CGU** et **Politique de confidentialité** sur le paywall et dans la fiche store.
- [ ] Aucun lien ni mention de paiement externe dans l'app (le web n'en propose pas).
- [ ] Gestion / résiliation : lien `manageUrl` (« Gérer mon abonnement »).
- [ ] **Suppression de compte** dans l'app (déjà disponible) ; rappeler qu'elle ne résilie
      pas l'abonnement store.
- [ ] Achats testés en Sandbox (iOS) et avec testeurs de licence (Android).

## Reste à faire côté app (W6-08)

- Installer `@revenuecat/purchases-capacitor` ; `Purchases.configure({ apiKey, appUserID: user.id })`
  après connexion, `Purchases.logOut()` à la déconnexion.
- Paywall natif à partir de l'offering (prix localisés fournis par le SDK), bouton Restaurer.
- Après achat / restauration : rafraîchir `GET /users/me/subscription` (le webhook peut
  arriver quelques secondes après ; prévoir un nouvel essai).
- Sur le web, aucune offre d'achat (déjà en place : message « disponible dans l'application »).

## Évolution possible sans RevenueCat (non implémentée)

Recevoir directement **App Store Server Notifications v2** (JWS signés, vérification de la
chaîne Apple) et **Google Real-time Developer Notifications** (Pub/Sub + appel à
`purchases.subscriptionsv2.get`), avec validation serveur des reçus. Les modèles
`Subscription` / `PaymentEvent` (provider, eventId unique) sont prévus pour cela.
