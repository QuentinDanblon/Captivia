# CONTRAT SOUS-AGENTS — Fiches races Captivia (348 races)

Tu produis des fiches races COMPLÈTES et SOURCÉES pour la plateforme Captivia
(carnet de santé, rappels et fiches espèces pour les particuliers).

## RÈGLE D'OR ABSOLUE — SOURCING

- **AUCUNE donnée inventée.** Chaque section (description, alimentation, santé,
  législation, habitat, comportement, reproduction) DOIT être sourcée par des
  URLs réelles que tu as VÉRIFIÉES via tes outils web (web_search / web_extract).
- **Ne JAMAIS inventer une URL.** Toute URL listée dans `sources` doit avoir été
  consultée (HTTP 200) ou au minimum confirmée par les résultats de recherche.
- Sources recommandées par domaine :
  - Description : Wikipédia FR (fr.wikipedia.org/wiki/<Nom>) — toujours vérifiée.
  - Alimentation : sites vétérinaires et fabricants (royalcanin.com, purina.fr,
    vcahospitals.com, petmd.com, wamiz.com, santévet…), guides spécialisés
    (terrariophilie, aquariophilie, perroquets…).
  - Santé : vcahospitals.com, petmd.com, wamiz.com, sites vétérinaires FR.
  - Législation FR : legifrance.gouv.fr (Arrêté du 21 novembre 1997 pour les
    NAC), INPN (inpn.mnhn.fr), préfectures.
  - Habitat/Comportement : guides spécialisés, sites d'élevage reconnus,
    Wikipédia FR.
  - Reproduction : fiches d'élevage, Wikipédia FR, sites spécialisés.
- Si une recherche échoue ou ne donne rien de fiable pour un champ : écris
  `null` / liste vide pour CE champ (ne comble jamais avec du contenu inventé).
- Chaque `sources` = tableau de `{ "type": "vet"|"guide"|"manufacturer"|"wikipedia"|"official", "url": "<URL réelle>", "title": "<titre de la page>" }`.
- Au minimum 1 source par section ; 2-3 pour l'alimentation et la santé.

## FORMAT DE SORTIE

Un seul fichier JSON par lot : `<OUT_DIR>/lot-<N>.json`, contenant un tableau
de fiches. Chaque fiche respecte EXACTEMENT ce schéma :

```json
{
  "speciesId": 2000000001,
  "commonNameFr": "Berger allemand",
  "scientificName": "Canis lupus familiaris",
  "category": "mammifère",
  "subcategory": "Chien de berger",
  "domesticationType": "domestique",
  "description": "Chien de grande taille... (2-4 phrases, max 500 chars, factuel, sourcé)",
  "sourceUrl": "https://fr.wikipedia.org/wiki/Berger_allemand",
  "feeding": {
    "dietType": "carnivore",
    "recommendedFoods": [
      { "name": "Croquettes premium chien adulte", "frequency": "quotidienne", "notes": "2 repas/jour, adaptées à la taille" },
      { "name": "Viande maigre cuite", "frequency": "hebdomadaire", "notes": "Poulet ou bœuf, sans sel ni épices" }
    ],
    "foodsToAvoid": [
      { "name": "Chocolat", "reason": "Théobromine toxique pour les chiens" },
      { "name": "Raisins et raisins secs", "reason": "Insuffisance rénale aiguë" }
    ],
    "mealFrequency": "daily",
    "specificNeeds": "Protéines animales en tête de liste des ingrédients, oméga-3 pour la peau et le pelage...",
    "sources": [{ "type": "vet", "url": "https://...", "title": "..." }]
  },
  "habitat": {
    "habitatType": "libre",
    "tempMin": 15,
    "tempMax": 28,
    "humidityMin": null,
    "humidityMax": null,
    "minSpaceSize": "Maison avec accès extérieur sécurisé",
    "lightNeeds": "Lumière naturelle, éviter exposition prolongée au soleil",
    "activityEnrichment": "2 promenades quotidiennes, jeux de rapport, stimulation mentale",
    "hygieneNotes": "Brossage 2x/semaine, bain 1x/mois",
    "costEstimate": "moyen",
    "sources": [{ "type": "guide", "url": "https://...", "title": "..." }]
  },
  "behavior": {
    "generalBehavior": "Chien de travail intelligent, loyal, protecteur...",
    "sociability": "semi-grégaire",
    "difficultyLevel": "intermédiaire",
    "compatibilityWithChildren": "Bon avec les enfants si socialisé tôt...",
    "compatibilityWithOtherAnimals": "Coexiste avec d'autres chiens si bien socialisé...",
    "sources": [{ "type": "wikipedia", "url": "https://...", "title": "..." }]
  },
  "health": {
    "diseases": [
      { "name": "Dysplasie de la hanche", "symptoms": "Boiterie, difficulté à se lever", "prevention": "Croissance contrôlée, dépistage radiographique", "whenToConsult": "Dès boiterie persistante" }
    ],
    "sources": [{ "type": "vet", "url": "https://...", "title": "..." }]
  },
  "legislation": {
    "country": "FR",
    "status": "allowed",
    "details": { "citesAppendix": null, "euAnnex": null, "permits": [], "restrictions": [] },
    "sources": [{ "type": "official", "url": "https://...", "title": "..." }]
  },
  "reproduction": {
    "season": "toute l'année",
    "gestationDays": 63,
    "incubationDays": null,
    "litterSizeMin": 4,
    "litterSizeMax": 9,
    "sexualMaturityMonths": 12,
    "breedingDifficulty": "facile",
    "notes": "2 portées max par an recommandées...",
    "sources": [{ "type": "guide", "url": "https://...", "title": "..." }]
  }
}
```

## VALEURS AUTORISÉES (cohérence avec la base)

- `category` : `mammifère` | `oiseau` | `reptile` | `amphibien` | `poisson` | `insecte` | `arachnide`
- `domesticationType` : `domestique` | `semi-domestique` | `NAC`
- `habitat.habitatType` : `libre` | `cage` | `terrarium` | `aquarium` | `enclos` | `volière`
- `habitat.costEstimate` : `faible` | `moyen` | `élevé`
- `behavior.sociability` : `solitaire` | `grégaire` | `semi-grégaire`
- `behavior.difficultyLevel` : `débutant` | `intermédiaire` | `expert`
- `feeding.mealFrequency` : `daily` | `every_2_days` | `weekly` | `variable`
- `health.diseases[]` : 3+ maladies réalistes pour l'espèce (avec symptômes, prévention, quand consulter)
- `legislation.status` : `allowed` | `permit_required` | `prohibited`
- `reproduction.breedingDifficulty` : `facile` | `modere` | `avance`
- Pour les races de chiens/chats : `subcategory` = groupe (ex: « Chien de berger », « Chien de compagnie », « Chat à poil long »)
- Pour les autres : `subcategory` = famille (ex: « Serpent constricteur », « Perroquet », « Tétra »)

## ATTENTION AUX CAS PARTICULIERS

- **Législation** : la plupart des chiens/chats/rongeurs = `allowed`. Les reptiles
  et NAC = souvent `permit_required` (Arrêté du 21/11/1997) avec les espèces
  concernées listées en annexes ; les espèces interdites (ex: certains serpents
  venimeux, loutre, pangolin...) = `prohibited`. Pour les espèces exotiques
  protégées CITES, renseigne `citesAppendix` (I/II/III) et `euAnnex` (A/B).
  Si tu n'es pas sûr : `allowed` avec `restrictions: []` plutôt que d'inventer
  une interdiction. (L'INPN et la DREAL sont des sources fiables.)
- **Poissons** : `habitat.habitatType` = `aquarium`, `minSpaceSize` = volume
  (ex: « 60L pour un banc de 6 »), températures de l'eau.
- **Reptiles/amphibiens** : températures précises (point chaud/point froid),
  hygrométrie, UVB obligatoire pour la plupart.
- **Arachnides/insectes** : `domesticationType` = `NAC`.
- **Amphibiens** : peau perméable → `hygieneNotes` sur l'eau déchlorée, mains
  propres.
- Les oiseaux ont `incubationDays` (pas gestation), les mammifères l'inverse.

## RAPPEL PRATIQUE

- Chaque fiche = 7 sections remplies (sauf champ sans source fiable → null).
- Travaille une race à la fois : recherche → rédige → vérifie les URLs → passe à la suivante.
- Le fichier de sortie doit être du JSON **valide** (teste-le mentalement : pas de
  virgule traînante, pas de commentaires).
- Tu as 15 races à traiter dans ce lot. Priorité à la complétude et au sourcing
  sur la vitesse.
