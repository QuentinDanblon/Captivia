# Classification d'âge — questionnaire Apple, IARC (Google Play) et public cible

> W6-11 (MOB-37). Réponses au lancement (v1.0, **sans** réseau social), justifiées par ce que fait l'app aujourd'hui. Le volet social à venir change plusieurs réponses : voir § 4, à refaire **avant** sa mise en ligne.
> Le questionnaire Apple décrit ici est le nouveau (4+, 9+, 13+, 16+, 18+), tel que le documente la page *Age ratings values and definitions* d'App Store Connect ; les libellés exacts peuvent légèrement varier à la saisie. Les intitulés IARC de la Play Console s'affichent dans la console elle-même et sont à relire à la saisie.

## 1. App Store Connect — questionnaire d'âge

*App Store Connect → l'app → Informations de l'app → Classification d'âge → Modifier.*

| Rubrique | Question | Réponse | Justification (code et produit) |
| --- | --- | --- | --- |
| Contrôles dans l'app | Contrôle parental | Non | Aucun. |
| Contrôles dans l'app | Vérification de l'âge | Non | L'âge minimal (15 ans, D-07) est une condition des CGU acceptées à l'inscription, pas une vérification technique. |
| Fonctionnalités | Contenu généré par les utilisateurs | **Non** | Les données saisies (animaux, carnet, photos) sont privées. Le lien ou QR public d'un animal est désactivé par défaut et ne montre que les champs choisis : ce n'est pas une diffusion à d'autres utilisateurs. |
| Fonctionnalités | Messagerie et discussion | Non | Aucun échange entre utilisateurs. |
| Fonctionnalités | Réseaux sociaux | Non | Pas de fil ni de redistribution de contenu (volet à venir, § 4). |
| Fonctionnalités | Accès web sans restriction | **Non** | La WebView ne charge que le paquet embarqué (jamais de `server.url`, `capacitor.config.ts`) ; les liens sortants (sources, boutiques) s'ouvrent dans le navigateur du système (`openExternal`, `docs/MOBILE.md` § 4.2). Aucun navigateur dans l'app. |
| Fonctionnalités | Publicité | Non | Aucune publicité ni SDK publicitaire. Les liens d'affiliation sont des liens, pas des annonces. |
| Thèmes matures | Grossièretés ou humour cru | Aucun | — |
| Thèmes matures | Horreur ou peur | Aucun | — |
| Thèmes matures | Alcool, tabac ou drogues | Aucun | — |
| Médical ou bien-être | Sujets de santé ou de bien-être | **Non** | Il s'agit du suivi d'animaux, pas de conseils de santé ou de vie saine pour la personne. |
| Médical ou bien-être | Informations médicales ou de traitement | **Aucune** | Les fiches espèces listent des maladies d'animaux et « quand consulter » ; le carnet enregistre des traitements d'animaux. Aucun diagnostic ni conseil de traitement pour des personnes ; l'app ne remplace pas le vétérinaire (`docs/MESSAGING.md`). |
| Sexualité ou nudité | Thèmes suggestifs / contenu sexuel / contenu explicite | Aucun | — |
| Violence | Violence fantastique, réaliste, prolongée ; armes | Aucune | — |
| Jeux d'argent et hasard | Concours | Aucun | Les points et grades sont une progression personnelle, sans classement ni concours. |
| Jeux d'argent et hasard | Coffres à butin, jeux d'argent simulés, jeux d'argent réels | Non | — |

**Résultat attendu : 4+.** Autres réponses : « Destinée aux enfants » (catégorie Kids) : **non** ; remplacement de la classification par pays : aucun.

*Si l'évaluateur estime que les fiches de santé animale relèvent de « Informations médicales » (réponse « Peu fréquentes »), la note passerait à 13+ : sans conséquence pour la distribution ni pour les CGU (15 ans). Ne pas répondre « Non » par principe : répondre ce que l'on peut défendre devant le relecteur, ici l'absence de contenu médical pour des personnes.*

## 2. Google Play — questionnaire IARC

*Play Console → l'app → Contenu de l'application → Classification du contenu → Démarrer le questionnaire.* Saisir l'e-mail de contact (celui de D-01).

| Question | Réponse | Justification |
| --- | --- | --- |
| Catégorie de l'app | « Utilitaire, productivité, communication ou autre » (intitulé à vérifier dans la console). **Ni jeu, ni réseau social** au lancement | Carnet et agenda de soins. |
| Violence | Non (sang, armes, cruauté, aucune) | Les fiches d'espèces ne montrent aucune violence. |
| Contenu sexuel et nudité | Non | — |
| Langage grossier | Non | — |
| Substances contrôlées (drogue, alcool, tabac) | Non | — |
| Humour cru, horreur | Non | — |
| Jeux d'argent | Non | — |
| Les utilisateurs peuvent-ils interagir ou échanger du contenu ? | **Non** | Pas de messagerie, de commentaires ni de publication. Le lien public d'un animal est en lecture seule. |
| L'app partage-t-elle la position de l'utilisateur ? | Non | Aucune localisation. |
| L'app partage-t-elle des informations personnelles fournies par l'utilisateur avec des tiers ? | Non | Les prestataires sont des sous-traitants (cohérent avec la Sécurité des données, `declarations-confidentialite.md` § 4). |
| Achats numériques | **Oui** | Abonnement Premium (achat intégré). Affiche l'étiquette « Achats intégrés ». |
| Accès Internet sans restriction | Non | Pas de navigateur intégré. |

**Résultat attendu** : ESRB Everyone, PEGI 3, USK 0, ClassInd L, IARC Generic 3+ (avec l'étiquette achats intégrés). À recopier du certificat affiché par la console.

### Public cible et contenu (Play)

- Tranches d'âge cibles : **16-17 ans et 18 ans et plus**. Ne **pas** sélectionner de tranche en dessous de 13 ans : cela soumettrait l'app à la politique Familles de Google Play (SDK certifiés, publicité adaptée, etc.), sans objet ici.
- L'âge minimal des CGU est de 15 ans (D-07). Pour être strictement cohérent, ajouter « 13-15 ans » : aucune exigence supplémentaire tant que l'app n'est pas conçue pour les moins de 13 ans, mais l'examen « Teen data » est plus attentif. Décision du propriétaire ; par défaut, ne pas l'ajouter (usage grand public d'adultes).
- « L'app attire-t-elle les enfants ? » : non (direction artistique éditoriale, aucun personnage, aucun mécanisme de jeu).

## 3. Cohérence entre les trois âges

| Où | Valeur | Rôle |
| --- | --- | --- |
| CGU, inscription | 15 ans minimum (D-07) | Condition d'accès au compte (consentement numérique en France) |
| App Store | 4+ | Nature du contenu |
| Google Play | PEGI 3 / Everyone ; public cible 16+ | Nature du contenu ; ciblage |

Les trois sont indépendants : la classification dit ce que contient l'app, les CGU disent qui peut s'inscrire.

## 4. Le volet social à venir change la classification

Publications de photos, questions, commentaires, réponses, profils publics (`docs/PRODUCT.md`, « Réseau social ») : **ces réponses sont à refaire avant sa mise en ligne**, dans les deux consoles.

| Console | Réponse qui change | Effet attendu |
| --- | --- | --- |
| Apple | Contenu généré par les utilisateurs : **Oui** ; Réseaux sociaux : **Oui** ; Messagerie et discussion : Oui si échanges directs | **13+ au minimum** (la règle « Réseaux sociaux » impose 13+ ; 16+ dans certains pays, par exemple l'Australie) |
| Apple | Exigences associées (guideline 1.2) | Filtrage ou modération du contenu, signalement, blocage d'utilisateur, coordonnées de contact publiées ; sans cela : rejet |
| Google | « Les utilisateurs peuvent interagir ou échanger du contenu » : **Oui** ; catégorie « Réseaux sociaux, forums, UGC » | Étiquette « Les utilisateurs interagissent » ; la note passe en général à Teen / PEGI 12 selon les réponses sur la modération |
| Google | Politique « Contenu généré par les utilisateurs » | Signalement dans l'app, blocage, modération et retrait, règles de communauté |
| Les deux | Sécurité des données / App Privacy | Photos et publications publiques, pseudo, messages : mettre à jour les deux déclarations (`declarations-confidentialite.md` § 6, point 5) |
| Juridique | CGU, DSA | Âge minimal conforme, point de contact, motifs de retrait, recours (déjà listés dans `docs/PRODUCT.md`) |

Dernier point : les données de santé privées du carnet ne doivent jamais se mélanger au contenu public ; seul le partage explicite est autorisé (`docs/PRODUCT.md`). Les déclarations doivent continuer à le refléter.
