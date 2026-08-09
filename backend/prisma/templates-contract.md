# CONTRAT TEMPLATES ÉDITORIAUX — Captivia (par espèce de base)

Tu rédiges UN template éditorial COMPLET et SOURCÉ pour une **espèce de base**
(ex: Chien, Chat, Lapin, Perruche, Gecko léopard, Tortue grecque, Poisson rouge,
Mygale…). Ce template sera appliqué automatiquement à TOUTES les races de cette
espèce (ex: toutes les races de chiens). C'est le cœur du contenu : sa qualité
détermine la qualité de centaines de fiches.

## RÈGLE D'OR ABSOLUE — SOURCING

- **AUCUNE donnée inventée.** Chaque section doit être sourcée par des URLs
  réelles que tu as VÉRIFIÉES via web_search / web_extract (HTTP 200 ou résultat
  de recherche confirmé). Ne JAMAIS inventer d'URL.
- Sources recommandées :
  - Alimentation : royalcanin.com, purina.fr, vcahospitals.com, petmd.com,
    wamiz.com, santévet.fr, guides spécialisés (terrariophilie, aquariophilie…)
  - Santé : vcahospitals.com, petmd.com, wamiz.com, sites vétérinaires FR
  - Législation FR : legifrance.gouv.fr (Arrêté du 21/11/1997 pour NAC),
    INPN (inpn.mnhn.fr)
  - Habitat/Comportement : guides spécialisés, sites d'élevage reconnus,
    Wikipédia FR
  - Reproduction : fiches d'élevage, Wikipédia FR, sites spécialisés
- Si une recherche ne donne rien de fiable : écris `null` (jamais d'invention).
- `sources` = tableau de `{ "type": "vet"|"guide"|"manufacturer"|"wikipedia"|"official", "url": "<URL réelle>", "title": "<titre>" }` — au minimum 2 sources pour l'alimentation, 2 pour la santé.

## FORMAT DE SORTIE

Un seul fichier : `<OUT_DIR>/template-<espece>.json` avec EXACTEMENT ce schéma :

```json
{
  "espece": "Chien",
  "category": "mammifère",
  "domesticationType": "domestique",
  "subcategory": "Chien",
  "feeding": {
    "dietType": "carnivore",
    "recommendedFoods": [
      { "name": "Croquettes premium chien adulte", "frequency": "quotidienne", "notes": "2 repas/jour, adapter la quantité au poids de la race" },
      { "name": "Pâtée humide complète", "frequency": "quotidienne", "notes": "Peut compléter les croquettes (max 25% de la ration)" },
      { "name": "Viande maigre cuite", "frequency": "hebdomadaire", "notes": "Poulet ou bœuf, sans sel ni épices" },
      { "name": "Légumes cuits", "frequency": "hebdomadaire", "notes": "Carotte, courgette, haricot vert" }
    ],
    "foodsToAvoid": [
      { "name": "Chocolat", "reason": "Théobromine toxique pour les chiens" },
      { "name": "Raisins et raisins secs", "reason": "Insuffisance rénale aiguë possible" },
      { "name": "Oignons et ail", "reason": "Destruction des globules rouges" },
      { "name": "Xylitol (chewing-gums)", "reason": "Hypoglycémie sévère" }
    ],
    "mealFrequency": "daily",
    "specificNeeds": "Protéines animales en tête d'ingrédients, oméga-3 (peau/pelage), calcium/phosphore équilibrés. Adapter la taille des croquettes à la mâchoire de la race (grandes races vs toy).",
    "sources": [{ "type": "vet", "url": "https://...", "title": "..." }]
  },
  "habitat": {
    "habitatType": "libre",
    "tempMin": 15,
    "tempMax": 28,
    "humidityMin": null,
    "humidityMax": null,
    "minSpaceSize": "Vie en intérieur avec accès extérieur sécurisé (jardin clôturé ou sorties)",
    "lightNeeds": "Lumière naturelle, ne pas exposer au soleil prolongé (coup de chaleur)",
    "activityEnrichment": "2 promenades quotidiennes minimum, jeux de rapport, jouets d'occupation, socialisation",
    "hygieneNotes": "Brossage 2x/semaine (quotidien pour poils longs), bain 1x/mois, nettoyage oreilles et dents",
    "costEstimate": "moyen",
    "sources": [{ "type": "guide", "url": "https://...", "title": "..." }]
  },
  "behavior": {
    "generalBehavior": "Animal social et loyal, besoin de présence humaine et de routine...",
    "sociability": "semi-grégaire",
    "difficultyLevel": "intermédiaire",
    "compatibilityWithChildren": "Bon compagnon pour enfants si socialisé tôt et encadré...",
    "compatibilityWithOtherAnimals": "Coexiste avec d'autres animaux domestiques si bien socialisé...",
    "sources": [{ "type": "wikipedia", "url": "https://...", "title": "..." }]
  },
  "health": {
    "diseases": [
      { "name": "Dysplasie de la hanche", "symptoms": "Boiterie, difficulté à se lever, douleur", "prevention": "Croissance contrôlée, éviter surpoids, dépistage radiographique", "whenToConsult": "Dès boiterie persistante" },
      { "name": "Otite", "symptoms": "Grattage oreilles, tête penchée, odeur", "prevention": "Nettoyage régulier, séchage après bain", "whenToConsult": "Dès rougeur ou odeur" }
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
    "notes": "Chienne : 2 portées max/an, âge idéal 2-6 ans...",
    "sources": [{ "type": "guide", "url": "https://...", "title": "..." }]
  }
}
```

## VALEURS AUTORISÉES

- `category` : `mammifère` | `oiseau` | `reptile` | `amphibien` | `poisson` | `insecte` | `arachnide`
- `domesticationType` : `domestique` | `semi-domestique` | `NAC`
- `habitat.habitatType` : `libre` | `cage` | `terrarium` | `aquarium` | `enclos` | `volière`
- `habitat.costEstimate` : `faible` | `moyen` | `élevé`
- `behavior.sociability` : `solitaire` | `grégaire` | `semi-grégaire`
- `behavior.difficultyLevel` : `débutant` | `intermédiaire` | `expert`
- `feeding.mealFrequency` : `daily` | `every_2_days` | `weekly` | `variable`
- `health.diseases[]` : 3+ maladies réalistes pour l'espèce
- `legislation.status` : `allowed` | `permit_required` | `prohibited`
- `reproduction.breedingDifficulty` : `facile` | `modere` | `avance`

## CAS PARTICULIERS PAR TYPE

- **Poissons** : habitatType=`aquarium`, minSpaceSize=volume (ex: « 60L pour un banc de 6 »), températures de l'eau (tempMin/Max = eau), pas de législation spécifique (allowed), reproduction par ponte (incubationDays).
- **Reptiles/amphibiens** : terrarium, températures point chaud/froid précises, hygrométrie, UVB obligatoire pour la plupart ; législation = permit_required si Arrêté 21/11/1997 (vérifier INPN), CITES pour espèces protégées.
- **Oiseaux** : volière/cage, incubationDays (pas gestation), litière, perchoirs.
- **Arachnides/insectes** : terrarium, alimentation vivante (criquets, blattes, vers), domesticationType=NAC.
- **Mammifères NAC** (cochon d'Inde, lapin, hamster...) : foin à volonté pour herbivores, vitamine C pour cochon d'Inde, législation mostly allowed.
- **Élevage** (bovin, mouton, chèvre, porc, cheval) : enclos/pâturage, alimentation fourrage+céréales, identification obligatoire (boucles), santé = parasitisme.

## RAPPEL

- Template générique PAR ESPÈCE DE BASE — pas par race individuelle.
- Le fichier doit être du JSON valide (teste-le : pas de virgule traînante).
- Priorité : complétude + sourcing. 2-3 sources par section alimentation/santé.
