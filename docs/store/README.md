# Fiches store — mode d'emploi (W6-10, W6-11)

Tout ce qui se copie-colle dans App Store Connect et la Play Console est ici ; le reste se génère.
Contexte : projets natifs non générés, comptes développeurs pas encore créés (W6-01).

| Fichier | Contenu |
| --- | --- |
| `fiche-fr.md`, `fiche-en.md` | Titre, sous-titre, descriptions, mots-clés, notes de version, liens, catégories |
| `declarations-confidentialite.md` | App Privacy (Apple), Sécurité des données (Google), suppression de compte, points de vigilance |
| `classification-age.md` | Questionnaire d'âge Apple, IARC, public cible, effet du volet social |
| `../../frontend/mobile/ios-template/PrivacyInfo.xcprivacy` | Manifeste de confidentialité iOS |
| `../../frontend/mobile/assets/`, `../../frontend/mobile/android-template/` | Icônes, splash, icône de notification (logo provisoire, D-15) |

## Contrôles et générations (depuis `frontend/`)

```bash
npm run store:check           # longueurs des textes (titre 30, sous-titre 30, courte 80, mots-clés 100, longue 4 000) et règle d'écriture
npm run assets:mobile:sources # régénère icônes et splash (sharp)
npm run screenshots:store -- --out ~/captivia-captures      # captures : 3 tailles × 6 pages (--locales fr,en pour l'anglais)
rm -rf .next out              # le script construit le frontend avec l'API simulée : nettoyer ensuite
```

Les captures (1 320 × 2 868, 1 284 × 2 778, 1 080 × 1 920) utilisent l'API simulée des tests e2e et un jeu de
données fictif (Mochi, chat ; Sunny, agame barbu ; compte Premium d'exemple). Elles ne sont pas versionnées. La fiche
espèce vient de l'API et reste en français : elle n'est produite qu'en `fr`.

## Ordre des opérations pour le propriétaire

1. **Créer les projets natifs** (`docs/MOBILE.md` § 2) : `npx cap add android`, `npx cap add ios`.
2. **Copier les gabarits** : icône de notification (`cp -R mobile/android-template/res/. mobile/android/app/src/main/res/`),
   `PrivacyInfo.xcprivacy` (`docs/MOBILE.md` § 12), `allowBackup="false"`.
3. **Générer icônes et splash** : `npm run assets:mobile` (après `cap add`).
4. **Saisir les fiches** : copier chaque bloc de `fiche-fr.md` (langue principale) et `fiche-en.md`.
5. **Déclarations** : suivre `declarations-confidentialite.md` § 3 et § 4, puis `classification-age.md` § 1 et § 2.
6. **Captures** : `npm run screenshots:store`, puis téléverser les trois dossiers.

## Ce qui reste à la charge du propriétaire

- **Comptes développeurs** Apple et Google (W6-01), contrats et fiscalité ; D-U-N-S.
- **Identité de l'éditeur** (D-01) : raison sociale, adresse, **e-mail de contact**. L'e-mail est exigé par la Play Console et
  rend exploitable la page `/suppression-compte` ; il alimente aussi les URL d'assistance.
- **URL d'assistance** : les fiches pointent sur `/mentions-legales` (coordonnées de l'éditeur). Une page d'assistance dédiée
  (FAQ + contact) serait préférable ; non créée ici (périmètre : pas de modification du frontend).
- **Domaine définitif** (D-03) : remplacer `captivia-app.netlify.app` dans les fiches et déclarations.
- **Logo définitif** (D-15) : icônes et splash sont provisoires ; le **graphique de présentation Play** (1 024 × 500) n'est
  pas produit.
- **Prix** : à saisir dans les consoles (aucun prix dans les textes) ; produits, essai, paywall conforme et sandbox : W6-08, W6-13.
- **Crédits photo des captures** : elles montrent des photos sous licence libre (CC BY, CC BY-SA ; `frontend/public/images/CREDITS.md`).
  Mentionner l'attribution (la page « Sources et licences » du site la porte) ou les remplacer par des photos de votre choix.
- **Politique de confidentialité** : y citer les achats intégrés (registre § 8) et résorber les `[À COMPLÉTER]` ; relecture juridique.
- **Compte de démo** et notes pour l'évaluateur (W6-13).
- **Amazon Associates Central** : déclarer l'app une fois publiée (`declarations-confidentialite.md` § 7).
- **Vérifier à la saisie** les intitulés exacts des consoles (catégories, questionnaire IARC, étiquettes Play) : ils évoluent.
