# Captivia — Vision produit et message

> Source : propriétaire, 2026-10-02. Ce document fait foi pour le message (landing, stores, textes de l'app) et pour les règles d'accès. Les agents de design et de rédaction s'y réfèrent.

## Promesse
**L'application indispensable dès qu'on a un ou plusieurs animaux.** On y consigne tout, on est guidé et renseigné, on est prévenu des rendez-vous à prendre, et on en apprend plus sur ses animaux.

## Piliers
1. **Tout consigner** : carnet de santé (vaccins, traitements, pesées, rendez-vous vétérinaires, notes, photos), historique, carnet imprimable / partageable avec le vétérinaire.
2. **Être guidé et averti** : rappels (soins, traitements, vaccins, rendez-vous à prendre), agenda des soins, abonnement calendrier, notifications.
3. **Apprendre** : fiches espèces et races sourcées (alimentation, habitat, comportement, santé, reproduction, réglementation).
4. **Partager (à venir)** : volet réseau social — photos de ses animaux, questions à la communauté, commentaires et réponses.

## Forme
- **Une vraie application**, mobile d'abord (Android / iOS via Capacitor), **pleinement utilisable sur PC** dans le navigateur (même app, navigation adaptée : barre d'onglets en mobile, barre latérale sur PC).
- **Une landing marketing** séparée de l'app, pensée comme un entonnoir (PC en priorité) : elle montre concrètement ce qu'il y a derrière la connexion (aperçus réels du carnet, de l'agenda, des fiches, de la communauté), puis mène à « Essayer sans compte ».
- **Direction artistique et message cohérents** entre landing, app web, app mobile et fiches stores (cf. `frontend/docs/DESIGN.md`). Vraies photos d'animaux et de nature sous licence libre vérifiée, jamais d'images générées.

## Accès et offre
| Profil | Animaux | Accès |
|---|---|---|
| **Invité** (sans compte, sur l'appareil) | **1** | App utilisable immédiatement ; invitation discrète à créer un compte pour sauvegarder / synchroniser. |
| **Compte gratuit** | **1** | Sauvegarde et synchronisation multi-appareils. |
| **Abonnement Premium** (in-app, RevenueCat ; pas de Stripe) | **Plusieurs** | Ajouter plus d'un animal exige un compte **et** l'abonnement. |

Passage invité → compte **sans perte de données** (l'animal et son carnet sont rattachés au nouveau compte).

### Décision D-16 (validée par le propriétaire le 2026-10-02)
Aujourd'hui le carnet de santé détaillé (soins, mesures, vaccins) est réservé au Premium dans l'API. Proposition alignée sur la promesse « on y consigne tout » : **le carnet complet est disponible pour l'animal unique de l'invité et du compte gratuit** ; le Premium débloque **plusieurs animaux** (+ éventuels extras : export avancé, partage vétérinaire, stockage photo étendu). Validé.

## Réseau social (volet à venir) — exigences à prévoir dès maintenant
- Publications (photos d'animaux), questions, commentaires, réactions ; profils publics minimalistes (pseudo, avatar, animaux montrés volontairement).
- Comptes requis pour publier (pas d'invité) ; âge minimal conforme aux CGU.
- Modération : signalement, masquage, blocage d'utilisateurs, file de modération opérateur, règles de communauté, conformité DSA (point de contact, motifs de retrait, recours).
- Stockage des médias : stockage objet (ex. Cloudflare R2, offre gratuite) avec redimensionnement et retrait des métadonnées EXIF (géolocalisation).
- Ne jamais mélanger les données de santé privées et le contenu public : partage explicite uniquement.

## Ton
Précis, chaleureux sans mièvrerie, factuel : des chiffres plutôt que des adjectifs (« 3 soins aujourd'hui », « dernière pesée il y a 12 jours »). Pas de superlatifs creux ni de jargon technique visible.

### Règle d'écriture (propriétaire, 2026-10-02)
Les textes affichés (landing, app, stores) doivent être **naturels, chaleureux, un peu marketing** — jamais la reformulation des consignes internes. Aucun mot de ce document ou des briefs (« promesse », « piliers », « entonnoir », « derrière la connexion », « carnet de terrain »…) ne doit apparaître tel quel à l'écran. Chaque titre doit donner envie plutôt que décrire la section ; test : « une marque grand public l'écrirait-elle sur sa page d'accueil ? ».
