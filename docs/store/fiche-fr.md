# Fiche store — français (App Store et Google Play)

> À copier-coller dans App Store Connect (*Informations de l'app*, *Version*) et dans la Play Console (*Présence sur le Store → Fiche principale*).
> Chaque champ est un bloc `text` précédé de sa clé (contrôlée par `npm run store:check`, qui vérifie les longueurs et les règles d'écriture).
> Sources : `docs/MESSAGING.md` § 8, règle d'écriture de `docs/PRODUCT.md`. Aucun prix n'est écrit ici : les tarifs se saisissent dans les consoles (`docs/PAYMENTS.md`).
> Les URL utilisent le domaine actuel ; les remplacer par le domaine définitif (D-03) avant la soumission.

## Champs communs

### `title` — Titre (30 max, App Store et Google Play)

```text
Captivia : santé des animaux
```

### `subtitle` — Sous-titre (30 max, App Store)

```text
Carnet, vaccins et rappels
```

### `short` — Description courte (80 max, Google Play)

```text
Le carnet de santé de vos animaux, avec les rappels au bon moment.
```

### `promo` — Texte promotionnel (170 max, App Store, modifiable sans nouvelle version)

```text
Vaccins, vermifuges, pesées, visites chez le vétérinaire : notez-les une fois, Captivia vous prévient le moment venu. Sans compte pour commencer.
```

### `keywords` — Mots-clés (100 max, App Store ; séparés par des virgules, sans espace)

Les mots déjà présents dans le titre et le sous-titre (santé, animaux, carnet, vaccins, rappels) sont indexés par l'App Store : ils ne sont pas répétés.

```text
chat,chien,lapin,reptile,NAC,vétérinaire,vermifuge,pesée,agenda,rendez-vous,espèce,gecko,oiseau
```

### `description` — Description longue (4 000 max, App Store et Google Play)

```text
Vous les aimez. Captivia se souvient du reste.

Vaccins, vermifuges, pesées, visites chez le vétérinaire : notez-les une fois, Captivia vous prévient le moment venu. Pour un chat, un chien, un lapin… ou un gecko léopard.

TOUT CE QUE LE VÉTÉRINAIRE VOUS DEMANDERA, DÉJÀ NOTÉ
• Un carnet de santé par animal : vaccins avec leur prochaine échéance, traitements, comptes rendus de visite, photos.
• Une courbe de poids tracée à chaque pesée.
• Un carnet à imprimer ou à partager avant la consultation, pour arriver avec l'historique complet.

LE BON RAPPEL, AU BON MOMENT
• Soins du jour, traitements, rappels de vaccin et rendez-vous à prendre : Captivia vous prévient sur votre téléphone, même sans connexion.
• Un agenda des soins, avec le statut de chacun : fait, à faire, en retard.
• Avec un compte, vos soins peuvent aussi apparaître dans l'agenda de votre téléphone.

DES RÉPONSES SOURCÉES, PAS DES ON-DIT
• Une fiche par espèce : alimentation, habitat, comportement, santé, réglementation.
• Chaque information renvoie à sa source : Wikipédia, GBIF, Liste rouge de l'UICN, CITES.
• Captivia vous aide à ne rien oublier et indique ce qui doit vous amener à consulter. Le diagnostic reste celui du vétérinaire.

BIENTÔT : LES AUTRES PASSIONNÉS
Une communauté pour montrer vos animaux et poser vos questions arrive. Le carnet de santé de votre animal, lui, reste privé : rien n'est publié sans votre action.

GRATUIT POUR UN ANIMAL
• Sans compte pour commencer : vous ajoutez votre animal et vous jugez sur pièce.
• Un compte gratuit sauvegarde vos données et les retrouve sur un autre appareil. Votre animal et son carnet vous suivent, rien à ressaisir.
• Premium sert à suivre plusieurs animaux, chacun avec son carnet. C'est un abonnement mensuel ou annuel, souscrit dans l'application : son tarif est affiché avant tout achat. Il se renouvelle automatiquement jusqu'à sa résiliation, que vous pouvez faire à tout moment dans les réglages de votre compte App Store ou Google Play.

VOS DONNÉES RESTENT LES VÔTRES
• Hébergement à Francfort (Allemagne).
• Aucune donnée vendue ni louée, aucune publicité.
• Suppression de votre compte et de vos données à tout moment, depuis l'application.

Disponible en français, anglais, espagnol, allemand, italien et portugais.

Conditions d'utilisation : https://captivia-app.netlify.app/cgu
Politique de confidentialité : https://captivia-app.netlify.app/confidentialite
```

### `whatsnew` — Notes de version 1.0 (4 000 max sur l'App Store ; 500 max sur Google Play)

```text
Première version de Captivia.

• Notez vaccins, traitements, pesées et rendez-vous dans le carnet de santé de chaque animal.
• Recevez vos rappels sur votre téléphone, même sans connexion.
• Consultez les fiches espèces, avec leurs sources.
• Commencez sans compte, pour un animal.
```

## Liens

| Champ | Valeur |
| --- | --- |
| URL d'assistance (App Store) / Site web (Play) | `https://captivia-app.netlify.app/mentions-legales` (coordonnées de l'éditeur, dont le courriel ; page d'assistance dédiée à envisager, voir README) |
| URL marketing (App Store, facultative) | `https://captivia-app.netlify.app` |
| URL de la politique de confidentialité | `https://captivia-app.netlify.app/confidentialite` |
| Conditions d'utilisation (EULA personnalisé, App Store) | `https://captivia-app.netlify.app/cgu` |
| Suppression de compte (Play : champ « Supprimer le compte ») | `https://captivia-app.netlify.app/suppression-compte` |
| E-mail de contact (Play, obligatoire) | `[À COMPLÉTER : adresse de contact, D-01 — la même que LEGAL.contactEmail dans src/lib/legal.ts]` |
| Copyright (App Store) | `© 2026 [À COMPLÉTER : raison sociale, D-01]` |

## Catégorie, prix et classification

| Rubrique | Valeur |
| --- | --- |
| App Store — catégorie principale | **Style de vie** (Lifestyle) |
| App Store — catégorie secondaire | **Référence** (fiches espèces sourcées) |
| Google Play — type et catégorie | Application · **Style de vie** (Lifestyle) ; choisir ensuite les étiquettes proposées par la console qui touchent aux animaux de compagnie (la liste évolue : ne rien inventer) |
| Pourquoi pas « Santé et forme » | Cette catégorie vise la santé des personnes (règle 1.4 de l'App Store, politique « Santé » de Google Play) ; Captivia suit celle des animaux et ne fait ni diagnostic ni mesure sur l'utilisateur. |
| Prix | Gratuit, avec achats intégrés (abonnement Premium, tarifs à saisir dans les consoles) |
| Classification d'âge | Voir `docs/store/classification-age.md` (attendu : **4+** App Store, **PEGI 3 / Tous** au lancement) |
| Déclarations de confidentialité | Voir `docs/store/declarations-confidentialite.md` |
| Langues de la fiche | Français (langue principale), anglais (`fiche-en.md`) ; es, de, it, pt : titres et descriptions courtes dans `docs/MESSAGING.md` § 8 |

## Captures d'écran et visuels

- iPhone 6,9" : 1 320 × 2 868 ; iPhone 6,5" : 1 284 × 2 778 ; Play : 1 080 × 1 920 (téléphone).
- Produites par `npm run screenshots:store` (voir `docs/store/README.md`).
- Icône 1 024 × 1 024 (App Store) : `frontend/mobile/assets/icon-only.png` ; icône Play 512 × 512 : `frontend/mobile/assets/store/play-icon-512.png`. Logo provisoire (D-15).
- Graphique de présentation Play (1 024 × 500) : **à produire avec le logo définitif** (D-15), non généré ici.
