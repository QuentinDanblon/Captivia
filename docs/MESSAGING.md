# Captivia — message et textes de référence

> Source : `docs/PRODUCT.md` (vision, offre, ton), `frontend/docs/DESIGN.md` § 2 (voix). Ce document
> fixe **les mots** : landing, fiches stores, textes de l'app. Les textes de la landing en vivent
> dans `frontend/messages/<locale>.json` (namespace `landing`) ; toute évolution du message passe
> d'abord ici.
>
> Rédigé en français, puis traduit (anglais complet ci-dessous ; fiches stores dans les 6 langues).

## 0. Règles d'écriture

1. **On parle à quelqu'un qui aime ses animaux**, pas à un développeur ni à un acheteur de
   logiciel. On écrit ce que la personne vit (« c'était quand, le dernier vermifuge ? »), pas ce
   que l'application contient.
2. **Des faits plutôt que des adjectifs** : « rappel par notification ou par e-mail », « serveurs
   à Francfort », « 1 animal gratuit ». Aucun chiffre inventé (ni nombre d'utilisateurs, ni note,
   ni durée « en 2 minutes »).
3. **Les titres donnent envie, ils ne décrivent pas la section.** Interdits à l'écran : les mots
   de travail (« promesse », « preuve », « fonctionnement », « réassurance », « piliers »,
   « entonnoir », « carnet de terrain vétérinaire », « ce qui vous attend derrière la
   connexion »), les formulations méta (« découvrez ce que propose l'application »), les listes de
   fonctionnalités en jargon, les superlatifs creux et les mots bannis de DESIGN.md § 2.
4. **Test de relecture** : une marque grand public sérieuse (Doctolib, Petcube) écrirait-elle
   cette phrase sur sa page d'accueil ? Sinon, on la réécrit.
5. Vouvoiement, phrases courtes, verbes d'action, pas d'émoji ni de points d'exclamation.
6. Santé : jamais « soigne » ni « guérit » ; Captivia aide à ne rien oublier et à savoir quand
   consulter.

## 1. L'idée en une phrase

**Captivia se souvient de tout ce qui compte pour vos animaux et vous prévient au bon moment.**

Version longue (présentation, dossier presse) : *Captivia est le carnet de santé et l'agenda de vos
animaux. Vous y notez vaccins, traitements, pesées et rendez-vous ; l'application vous prévient
avant chaque échéance et vous explique, sources à l'appui, ce que chaque espèce demande.*

## 2. Accroche

| Usage | Texte |
| --- | --- |
| Titre principal (landing) | **Vous les aimez. Captivia se souvient du reste.** |
| Sous-titre | Vaccins, vermifuges, pesées, visites chez le vétérinaire : notez-les une fois, Captivia vous prévient le moment venu. Pour un chat, un chien, un lapin… ou un gecko léopard. |
| Ligne de réassurance sous le bouton | Sans compte, sans carte bancaire. Gratuit pour un animal. |
| Variante courte (bannière, réseaux) | Leur santé, leurs rendez-vous, leurs habitudes. Au même endroit. |

## 3. Quatre raisons d'adopter Captivia, et ce qui les prouve

| Ce que vit la personne | Titre | Ce qui le prouve (montré sur la landing) |
| --- | --- | --- |
| « Le vétérinaire me demande la date du dernier vaccin, je ne la retrouve pas. » | **Tout ce que le vétérinaire vous demandera, déjà noté.** | Aperçu réel du carnet : vaccins datés avec la prochaine échéance, courbe de poids tracée à chaque pesée, carnet imprimable et partageable. |
| « J'oublie le vermifuge une fois sur deux. » | **Le bon rappel, au bon moment.** | Aperçu réel de l'agenda (frise des soins) : statut de chaque soin (fait, à faire, en retard), rappel par notification ou par e-mail, abonnement depuis l'agenda du téléphone. |
| « Sur les forums, chacun dit le contraire. » | **Des réponses sourcées, pas des on-dit.** | Aperçu d'une fiche espèce : statut Liste rouge UICN, besoins chiffrés, sources citées (Wikipédia, GBIF, UICN, CITES). |
| « J'aimerais montrer mes animaux à des gens qui comprennent. » | **Bientôt : les autres passionnés.** | Aperçu de la communauté, marqué « Bientôt » ; rappel que les données de santé restent privées. |

## 4. Objections et réponses

| Objection | Réponse courte (landing) | Réponse développée (support, FAQ) |
| --- | --- | --- |
| **« C'est payant ? »** | Gratuit pour un animal, carnet complet compris. | Sans compte ou avec un compte gratuit, vous suivez un animal avec tout : carnet de santé, rappels, agenda, fiches. Premium sert à suivre plusieurs animaux ; il se souscrit dans l'application mobile (achats intégrés), mensuel ou annuel, et son tarif est affiché avant tout achat. Tarifs de référence : 5,99 €/mois ou 29,99 €/an (`docs/PAYMENTS.md`), localisés par les stores : **ne pas les écrire sur la landing**. |
| **« Et mes données de santé ? »** | Le carnet de votre animal ne regarde que vous. | Carnet privé par défaut ; rien n'est publié sans action explicite, même quand la communauté ouvrira. Serveur et base de données à Francfort (Allemagne). Aucune donnée vendue ou louée, aucun cookie publicitaire. Suppression du compte et des données à tout moment (page « Supprimer mon compte »). |
| **« Encore une app ? »** | Une seule, pour tous vos animaux et tout leur suivi. | Captivia remplace le carnet papier, les post-it sur le frigo, les alarmes du téléphone et les onglets de forum ouverts. Elle fonctionne sans compte au départ : on juge sur pièce, on ne s'inscrit qu'ensuite. |
| « Ça remplace le vétérinaire ? » | Non : vous arrivez en consultation avec l'historique complet. | Captivia aide à ne rien oublier et indique ce qui doit amener à consulter ; le diagnostic reste celui du vétérinaire. |
| « Et si je crée un compte plus tard ? » | Votre animal et son carnet vous suivent. | Passage invité → compte sans perte : l'animal et tout son carnet sont rattachés au nouveau compte. |

## 5. FAQ (landing)

1. **C'est vraiment gratuit ?** — Oui, pour un animal : carnet de santé, rappels, agenda et fiches
   espèces compris. Premium devient utile quand vous suivez plusieurs animaux ; il se souscrit dans
   l'application mobile, et son tarif y est affiché avant tout achat.
2. **Faut-il créer un compte ?** — Non. Vous commencez tout de suite, sans compte. Un compte gratuit
   sert à sauvegarder vos données et à les retrouver sur un autre appareil.
3. **Si je crée un compte plus tard, je perds ce que j'ai noté ?** — Non. Votre animal et son carnet
   sont rattachés à votre nouveau compte, sans rien ressaisir.
4. **Quels animaux puis-je suivre ?** — Chiens, chats, lapins et rongeurs, oiseaux, reptiles,
   amphibiens, poissons, chevaux, volailles… Les fiches s'appuient sur GBIF, la base mondiale de
   la biodiversité, et s'enrichissent régulièrement.
5. **Captivia remplace-t-il mon vétérinaire ?** — Non, et ce n'est pas son rôle. Captivia vous aide
   à ne rien oublier et à arriver en consultation avec un historique complet. Les fiches santé
   indiquent ce qui doit vous amener à consulter.
6. **Où sont stockées les données de mon animal ?** — Sur un serveur et une base de données situés
   à Francfort, en Allemagne. Elles ne sont ni vendues ni louées, et vous pouvez les supprimer à
   tout moment.
7. **Sur quels appareils fonctionne Captivia ?** — Sur ordinateur, tablette et téléphone, dans le
   navigateur. Les applications Android et iOS utilisent le même compte.

## 6. Micro-copies des boutons et liens

| Contexte | Texte | Destination |
| --- | --- | --- |
| Bouton principal (haut de page, offre) | **Commencer gratuitement** | `/mes-animaux` (l'app propose l'essai sans compte) |
| Bouton principal (bas de page, étapes) | **Ajouter mon premier animal** | `/mes-animaux` |
| Lien secondaire | J'ai déjà un compte | `/login` |
| Sous le bouton principal | Sans compte, sans carte bancaire. Gratuit pour un animal. | — |
| Offre, colonne Premium | Tarif affiché dans l'app avant tout achat | — |
| Invité → compte (dans l'app) | Sauvegardez vos données : créez un compte, rien n'est perdu. | `/register` |
| Recherche d'espèce | Rechercher · Ex. gecko léopard | fiche espèce |

## 7. Sections de la landing (titres publiés)

| Ordre | Titre affiché | Rôle (note interne, jamais affichée) |
| --- | --- | --- |
| 1 | Vous les aimez. Captivia se souvient du reste. | accroche + aperçu réel de l'écran « Aujourd'hui » |
| 2 | Chaque soin noté. Chaque date tenue. | 4 aperçus réels (carnet, agenda, fiche, communauté) |
| 3 | Du chat du salon au gecko du terrarium. | diversité des espèces, photos |
| 4 | Trois étapes, et c'est parti. | mise en route |
| 5 | Gratuit pour un animal. Premium quand la famille s'agrandit. | offre Sans compte / Gratuit / Premium |
| 6 | Le carnet de votre animal ne regarde que vous. | confiance : vie privée, Europe, sources |
| 7 | Une espèce en tête ? | recherche de fiches (fonction réelle, secondaire) |
| 8 | Les questions qu'on nous pose | FAQ |
| 9 | Commencez par celui qui dort sur le canapé. | dernier appel à l'action |

## 8. Fiches stores (même idée, formats contraints)

Titre ≤ 30 caractères (App Store et Google Play), sous-titre ≤ 30 (App Store), description courte
≤ 80 (Google Play). Longueurs comptées en caractères Unicode.

| Langue | Titre | Sous-titre | Description courte |
| --- | --- | --- | --- |
| fr | Captivia : santé des animaux (28) | Carnet, vaccins et rappels (26) | Le carnet de santé de vos animaux, avec les rappels au bon moment. (66) |
| en | Captivia: Pet Health Log (24) | Vaccines, care and reminders (28) | Your pets' health record, with reminders right when they're due. (64) |
| es | Captivia: salud de mascotas (27) | Cartilla, vacunas y avisos (26) | La cartilla de salud de tus animales, con avisos en el momento justo. (69) |
| de | Captivia: Tiergesundheit (24) | Impfungen, Pflege, Erinnerung (29) | Das Gesundheitsheft Ihrer Tiere – mit Erinnerungen genau zur rechten Zeit. (74) |
| it | Captivia: salute animali (24) | Libretto, vaccini e promemoria (30) | Il libretto sanitario dei tuoi animali, con promemoria al momento giusto. (73) |
| pt | Captivia: saúde dos animais (27) | Boletim, vacinas e lembretes (28) | O boletim de saúde dos seus animais, com lembretes na hora certa. (65) |

Description longue (Google Play / App Store), français :

> Vous les aimez. Captivia se souvient du reste.
>
> Vaccins, vermifuges, pesées, visites chez le vétérinaire : notez-les une fois, Captivia vous
> prévient le moment venu.
>
> • Un carnet de santé complet : vaccins, traitements, pesées avec courbe, comptes rendus de
> visite, photos. Imprimable et partageable avant la consultation.
> • Des rappels qui tombent juste : soins du jour, traitements, rappels de vaccin et rendez-vous à
> prendre, par notification ou par e-mail, et dans l'agenda de votre téléphone.
> • Des fiches espèces sourcées : alimentation, habitat, comportement, santé, réglementation, avec
> leurs sources (Wikipédia, GBIF, Liste rouge UICN, CITES).
> • Bientôt : une communauté pour partager les photos de vos animaux et poser vos questions.
>
> Gratuit pour un animal, sans compte pour commencer. Premium pour suivre plusieurs animaux.
> Vos données de santé restent privées, hébergées à Francfort (Allemagne), jamais vendues.

## 9. English translation (reference)

- **One-liner** — Captivia remembers everything that matters for your pets and tells you when it's
  time.
- **Headline** — You love them. Captivia remembers the rest.
- **Sub-headline** — Vaccines, dewormers, weigh-ins, vet visits: log them once and Captivia
  reminds you when they're due. For a cat, a dog, a rabbit… or a leopard gecko.
- **Under the button** — No account, no credit card. Free for one pet.
- **Four reasons** — Everything your vet will ask for, already written down. / The right reminder,
  right on time. / Sourced answers, not hearsay. / Coming soon: fellow pet people.
- **Objections** — *Is it paid?* Free for one pet, full health record included; Premium (in-app,
  monthly or yearly, price shown before purchase) is for several pets. *What about my pet's
  health data?* Your pet's record is nobody's business but yours: private by default, server and
  database in Frankfurt (Germany), never sold or rented, no advertising cookies, delete at any
  time. *Yet another app?* One app for all your pets and all their care, and you can try it
  without signing up.
- **Buttons** — Start for free · Add my first pet · I already have an account.
- **Sections** — Every treatment logged. Every date kept. / From the sofa cat to the terrarium
  gecko. / Three steps and you're set. / Free for one pet. Premium when the family grows. / Your
  pet's record is nobody's business but yours. / Got a species in mind? / Questions people ask us
  / Start with the one asleep on the sofa.

Les traductions complètes (es, de, it, pt) des textes publiés sont dans `frontend/messages/`.
