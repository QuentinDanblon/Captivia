# Déclarations de confidentialité — App Privacy (Apple) et Data safety (Google Play)

> W6-11 (MOB-33, MOB-37). Établi le 2026-10-03 à partir de `docs/legal/registre-traitements.md` (T1 à T12) **et du code** de la branche `claude/zen-mendel-xq6nkb` (HEAD `5e0e69f`), pas à partir de la seule documentation.
> Ces déclarations doivent rester identiques à la politique de confidentialité du site (`frontend/src/content/legal/`) et au registre. Toute évolution (nouvelle donnée, nouveau prestataire) se reporte ici, dans le registre et dans la politique.
> Fichier compagnon pour iOS : `frontend/mobile/ios-template/PrivacyInfo.xcprivacy`.

## 1. Ce que l'app collecte réellement

Captivia ne contient **ni publicité, ni SDK d'analyse d'usage, ni identifiant publicitaire (IDFA / AAID), ni suivi inter-apps, ni localisation, ni contacts, ni micro**. Les rappels de soins sont des notifications locales (rien ne sort du téléphone pour les programmer).

| # | Donnée | Origine dans le code | Finalité | Lien à l'identité | Suivi | Chiffrement en transit | Suppression |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Adresse e-mail** (compte ; absente en mode invité) | `POST /auth/register`, `/auth/upgrade` (T1) ; envoi des e-mails de vérification, de réinitialisation et de rappel (Brevo) | Fonctionnement : compte, connexion, rappels par e-mail | Liée | Non | HTTPS (TLS) | Oui : suppression du compte (§ 5) |
| 2 | **Identifiants** : identifiant interne du compte ou de l'invité (`User.id`), jetons de session (empreintes côté serveur) | T1, T2 ; `User.id` est aussi l'identifiant d'utilisateur RevenueCat | Fonctionnement : session, rattachement des données, droit Premium | Liée | Non | HTTPS | Oui : suppression du compte ; invité : purge à 90 jours d'inactivité |
| 3 | **Données saisies sur les animaux** : nom, espèce, naissance, sexe, carnet de santé (vaccins, traitements, pesées, rendez-vous, comptes rendus), routines, notes libres | T3, T4 | Fonctionnement : carnet, agenda, rappels | Liée | Non | HTTPS | Oui : suppression du compte (cascade) ; modification et suppression à l'unité dans l'app |
| 4 | **Photos** : photo de profil de l'animal, prise ou choisie par l'utilisateur | `usePhotoPicker` (Capacitor Camera) → envoyée à l'API avec l'animal (T3) | Fonctionnement : afficher l'animal | Liée | Non | HTTPS | Oui : retrait de la photo ou suppression du compte |
| 5 | **Achats** : statut et historique de l'abonnement Premium (produit, échéance, identifiant de transaction) | Webhook RevenueCat → `Subscription`, `PaymentEvent` (T6). Aucune donnée de carte : Apple et Google encaissent | Fonctionnement : ouvrir et retirer le droit Premium | Liée | Non | HTTPS | Partielle : `Subscription` supprimée avec le compte ; `PaymentEvent` conservé sans lien au compte (`userId` mis à NULL), durée `[À COMPLÉTER : D-01, voir registre T6]` |
| 6 | **Identifiant d'appareil** pour l'achat intégré | SDK RevenueCat (IDFV sur iOS, identifiant d'installation sur Android) | Fonctionnement : achats | Liée | Non | HTTPS | À la suppression du compte côté Captivia ; RevenueCat applique sa propre rétention (DPA à signer, registre § 7) |
| 7 | **Plantages et performances** | Sentry, **seulement si un DSN est configuré** (`NEXT_PUBLIC_SENTRY_DSN`) : pile d'appels, route, version, 10 % de traces ; `sendDefaultPii: false`, jetons et e-mails retirés avant envoi (`sentry-scrub.ts`) | Fonctionnement : corriger les erreurs | **Non liée** (aucun `setUser`) | Non | HTTPS | Rétention Sentry 90 jours au plus |
| 8 | **Journaux techniques** : adresse IP, agent utilisateur, route, statut | API (pino), limitation de débit (T9) ; en-têtes d'autorisation, cookies, mots de passe et jetons masqués | Sécurité et diagnostic | Non liée (le journal ne porte pas d'identifiant de compte) | Non | HTTPS | Rotation chez l'hébergeur (`[À COMPLÉTER : durée Render, registre T9]`) |

Aucune des données ci-dessus n'est **vendue, louée, ni utilisée pour de la publicité, du profilage ou du suivi**. Les prestataires (Render et Neon à Francfort, Brevo, Sentry, RevenueCat) agissent comme sous-traitants (registre § 3) : ni Apple ni Google ne comptent ces transferts comme un « partage ».

> **À confirmer au branchement du SDK d'achat.** Au 2026-10-03, le code de l'app ne contient pas encore d'appel au SDK RevenueCat (le backend, le webhook et la page abonnement existent ; le paywall natif est à finir, W6-08/W6-13). Les lignes 5 et 6 sont déclarées **par anticipation** : déclarer plus que ce qui est collecté est sans risque, l'inverse est un motif de rejet. Si l'offre reste masquée sur natif (option MVP, D-04), retirer ces deux lignes **et** les entrées `PurchaseHistory` / `DeviceID` du `PrivacyInfo.xcprivacy`.

## 2. Ce qui n'est PAS collecté (ne rien cocher)

Localisation (précise ou approximative), contacts, nom, téléphone, adresse postale, santé ou forme physique **de l'utilisateur**, messages, fichiers, historique de navigation, historique de recherche, données financières autres que l'achat intégré, identifiant publicitaire, données sensibles, données d'enfants.

- *La santé des animaux n'est pas une donnée de santé au sens des stores* : les catégories « Santé et forme » (Apple, Google) concernent la personne. Les données du carnet se déclarent en **contenu utilisateur** (§ 3, § 4). Les champs libres peuvent recevoir autre chose : la politique de confidentialité invite à ne pas y saisir d'informations sensibles (registre § 0).
- *Pas de suivi* : aucune invite App Tracking Transparency, donc **aucune** clé `NSUserTrackingUsageDescription` dans l'`Info.plist`.
- *Le code QR / lien public* d'un animal est désactivé par défaut et révocable (D-08) ; il expose uniquement des champs choisis, sans données de santé : c'est un partage décidé par l'utilisateur, pas une collecte supplémentaire.

## 3. App Store Connect — « Confidentialité de l'app » (App Privacy)

*App Store Connect → l'app → Confidentialité de l'app → Commencer.*

1. **Collectez-vous des données de cette app ?** Oui.
2. **Cases à cocher** (types de données), avec pour chacune les réponses suivantes.

| Catégorie Apple | Type | Utilisée pour le suivi ? | Liée à l'utilisateur ? | Finalité |
| --- | --- | --- | --- | --- |
| Coordonnées | Adresse e-mail | Non | **Oui** | Fonctionnalités de l'app |
| Identifiants | ID utilisateur | Non | **Oui** | Fonctionnalités de l'app |
| Identifiants | ID d'appareil | Non | **Oui** | Fonctionnalités de l'app |
| Contenu de l'utilisateur | Photos ou vidéos | Non | **Oui** | Fonctionnalités de l'app |
| Contenu de l'utilisateur | Autre contenu de l'utilisateur | Non | **Oui** | Fonctionnalités de l'app |
| Achats | Historique des achats | Non | **Oui** | Fonctionnalités de l'app |
| Diagnostics | Données de plantage | Non | Non | Fonctionnalités de l'app |
| Diagnostics | Données de performance | Non | Non | Fonctionnalités de l'app |
| Diagnostics | Autres données de diagnostic | Non | Non | Fonctionnalités de l'app |

3. **Aucune** autre catégorie (Données d'utilisation, Localisation, Santé et forme, Informations financières, Informations sensibles, Historique de navigation, Recherche… : « Non collectées »).
4. Résumé attendu sur la fiche : *Données liées à vous* (e-mail, identifiants, photos, contenu, achats) ; *Données non liées à vous* (diagnostics) ; **aucune donnée utilisée pour vous suivre**.
5. URL de la politique de confidentialité : `https://captivia-app.netlify.app/confidentialite`. Option « Choix de confidentialité de l'utilisateur » : facultative, laisser vide.

Cohérence avec `PrivacyInfo.xcprivacy` : les neuf types ci-dessus y figurent (`EmailAddress`, `UserID`, `DeviceID`, `PhotosorVideos`, `OtherUserContent`, `PurchaseHistory`, `CrashData`, `PerformanceData`, `OtherDiagnosticData`), avec `NSPrivacyTracking = false`.

### 3.1 Manifeste `PrivacyInfo.xcprivacy`

- À copier : `cp mobile/ios-template/PrivacyInfo.xcprivacy mobile/ios/App/App/PrivacyInfo.xcprivacy` (après `npx cap add ios`), puis l'ajouter à la cible « App » dans Xcode (le gabarit Capacitor 7 n'en contient pas).
- **API « raison requise »** déclarées, vérifiées dans le code source des plugins installés (`node_modules`, 2026-10-03) :

| Catégorie | Raison | Source dans le projet |
| --- | --- | --- |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` (lecture et écriture de réglages propres à l'app) | `@capacitor/preferences` (`UserDefaults.standard` : session, rappels) ; aussi RevenueCat et Sentry |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `C617.1` (dates de fichiers du conteneur de l'app) | `@capacitor/filesystem` (`stat` : ctime / mtime ; partage du carnet) |

- Aucune autre catégorie dans Capacitor 7 (`Capacitor`, `CapacitorCordova` : manifestes vides), `@capacitor/app`, `camera`, `local-notifications`, `share` : recherche des symboles `UserDefaults`, dates de fichiers, espace disque, temps de démarrage, `ProcessInfo` sans autre résultat.
- Les SDK tiers (RevenueCat / `PurchasesHybridCommon`, Sentry Cocoa, `ion-ios-filesystem`) **embarquent leur propre manifeste**, fusionné à l'archivage. **À faire une fois le projet iOS créé** : Xcode → *Product → Archive* → *Distribute → … → Generate Privacy Report*. Si le rapport signale une catégorie manquante (par exemple `DiskSpace` / `E174.1` ou `SystemBootTime` / `35F9.1` côté SDK), l'ajouter au fichier : un manquant provoque un avertissement ITMS-91053 à l'envoi.

## 4. Google Play Console — « Sécurité des données » (Data safety)

*Play Console → l'app → Contenu de l'application → Sécurité des données.*

**Questions générales**

| Question | Réponse |
| --- | --- |
| L'app collecte ou partage-t-elle des données utilisateur requises ? | Oui |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** (HTTPS / TLS partout, HSTS) |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | **Oui** : dans l'app (Compte → Supprimer mon compte) et sur le web |
| URL de suppression de compte | `https://captivia-app.netlify.app/suppression-compte` |
| Méthode de création de compte | Adresse e-mail et mot de passe (le mode invité n'en demande aucun) |
| Respect de la politique Familles de Google Play | Non (app non conçue pour les enfants) |
| Examen de sécurité indépendant | Non |

**Types de données** (aucun n'est « partagé » : les prestataires sont des sous-traitants, exclus de la définition du partage ; aucune collecte « éphémère » à revendiquer)

| Catégorie Google | Type | Collectée | Partagée | Obligatoire ou facultative | Finalités |
| --- | --- | --- | --- | --- | --- |
| Infos personnelles | Adresse e-mail | Oui | Non | Facultative (mode invité sans compte) | Fonctionnement de l'app ; gestion du compte |
| Infos personnelles | ID utilisateur | Oui | Non | Obligatoire | Fonctionnement de l'app ; gestion du compte |
| Infos financières | Historique des achats | Oui | Non | Facultative (Premium) | Fonctionnement de l'app |
| Photos et vidéos | Photos | Oui | Non | Facultative | Fonctionnement de l'app |
| Activité dans l'application | Autre contenu généré par l'utilisateur | Oui | Non | Facultative | Fonctionnement de l'app |
| Infos et performances de l'app | Journaux de plantage | Oui | Non | Obligatoire (si Sentry actif) | Analyse (diagnostic) |
| Infos et performances de l'app | Diagnostics | Oui | Non | Obligatoire (si Sentry actif) | Analyse (diagnostic) |
| ID de l'appareil ou autres ID | ID de l'appareil ou autres ID | Oui | Non | Obligatoire pour l'achat intégré | Fonctionnement de l'app |

À ne **pas** cocher : Localisation, Santé et forme, Messages, Contacts, Agenda, Fichiers et documents, Audio, Historique de navigation, Historique de recherche, Applications installées, Nom, Adresse, Numéro de téléphone, Informations de paiement (Google encaisse : l'app ne reçoit aucune carte).

*Les journaux de sécurité du serveur (adresse IP, agent utilisateur) ne correspondent à aucune ligne du formulaire Google (l'adresse IP n'y est pas un type de données à part) ; ils sont décrits dans la politique de confidentialité.*

## 5. Suppression des données (exigence Apple 5.1.1(v) et Google Play)

- **Dans l'app** : Compte → paramètres du compte (`/parametres/compte`) → « Supprimer mon compte » (`DELETE /users/me`, mot de passe exigé hors invité) ; export JSON préalable (`GET /users/me/export`).
- **Sur le web, sans connexion** : `https://captivia-app.netlify.app/suppression-compte` (explique la voie dans l'app et la demande par e-mail). Nécessite le courriel de contact (D-01) pour que la voie « par e-mail » soit exploitable.
- **Effet** : suppression immédiate en base en cascade ; les sauvegardes chiffrées disparaissent sous 30 jours ; `PaymentEvent` est conservé sans lien au compte (registre T6, durée à fixer).
- **Invité** : aucune suppression manuelle requise, purge automatique à 90 jours d'inactivité ; le compte invité peut aussi être supprimé depuis l'app.

## 6. Points de vigilance avant la soumission

1. **Politique de confidentialité** : elle doit citer les achats intégrés (RevenueCat, Apple, Google) — point encore ouvert dans le registre (§ 8) — et correspondre ligne à ligne aux § 3 et § 4. Elle contient encore des `[À COMPLÉTER]` (D-01) ; Apple et Google ouvrent le lien pendant la relecture.
2. **Sentry** : le projet doit rester en région UE avec « ne pas stocker les adresses IP » activé (réglage du projet) pour que la ligne 7 reste non liée à l'identité. Tenir la déclaration alignée sur la configuration finale du build : sans DSN, aucune donnée de diagnostic n'est collectée ; avec un DSN, les ligne 7 et les entrées `CrashData` / `PerformanceData` sont exactes.
3. **Sauvegarde Android** : le gabarit Capacitor déclare `android:allowBackup="true"`, ce qui peut sauvegarder la session (Preferences) chez Google. Mettre `android:allowBackup="false"` dans `AndroidManifest.xml` après `cap add android`.
4. **Notifications push distantes (W6-07)**, non livrées : si elles le sont, ajouter « ID de l'appareil » (jeton FCM / APNs, finalité Fonctionnement) côté Google, et vérifier côté Apple que `DeviceID` couvre le jeton APNs ; mettre à jour le registre (T4).
5. **Réseau social (à venir)** : chaque nouveauté (publications, commentaires, signalements, profils publics) change ces tableaux (contenu public, messages, ID utilisateur public) et la classification d'âge (voir `docs/store/classification-age.md`). Ne pas déclarer par avance ; mettre à jour avant la mise en ligne de la fonction.
6. **Informations d'`Info.plist`** : `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` (`docs/MOBILE.md` § 4.3) correspondent à la ligne 4 ; ne pas ajouter de clé de localisation, de micro ni de suivi.

## 7. Amazon Associates Central (rappel du plan W6-11)

Les liens d'affiliation s'ouvrent dans le navigateur du système, jamais dans l'app (`openExternal`, MOB-36). Dans le compte Amazon Associates, ouvrir la rubrique de gestion des applications mobiles (l'intitulé varie selon la version de l'interface), saisir le nom de l'app, les identifiants de bundle (`app.captivia`) et les URL des fiches App Store / Google Play **après leur publication**. Action du propriétaire ; sans compte Associates actif, aucun lien affilié ne doit être affiché (`docs/MESSAGING.md`, D-09).
