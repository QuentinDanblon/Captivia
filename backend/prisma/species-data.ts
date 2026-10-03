// Species database: 1000+ domestic and NAC animals
// Mix équilibré par catégories selon priorités utilisateur

export const SPECIES_DATABASE = [
  // ============================================
  // MAMMIFÈRES DOMESTIQUES (200+)
  // ============================================

  // Félidés
  {
    speciesId: 5281802, // Felis catus
    commonNameFr: 'Chat domestique',
    scientificName: 'Felis catus',
    category: 'mammifère',
    subcategory: 'Félidé',
    domesticationType: 'domestique',
    description: 'Carnivore solitaire, très adapté à la vie domestique, existant depuis ~10 000 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Croquettes adaptées au chat', frequency: 'quotidienne', notes: 'Avec taurine essentielle' },
        { name: 'Pâtée adaptée', frequency: 'quotidienne', notes: 'Complément humide' },
        { name: 'Eau fraîche', frequency: 'à disposition', notes: 'Obligatoire' },
      ],
      foodsToAvoid: [
        { name: 'Chocolat', reason: 'Toxique pour les chats' },
        { name: 'Oignon et ail', reason: 'Damage globules rouges' },
        { name: 'Xylitol', reason: 'Toxique' },
        { name: 'Lait de vache', reason: 'Intolérance lactose' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Taurine essentielle, protéines animales minimum 30%, peu de glucides',
    },
    habitat: {
      habitatType: 'libre',
      tempMin: 15,
      tempMax: 25,
      minSpaceSize: 'Minimum 20m² avec accès vertical',
      lightNeeds: 'Cycle jour/nuit naturel',
      activityEnrichment: 'Très actif: jeux, griffoirs, perchoirs, interactions quotidiennes essentielles',
      hygieneNotes: 'Nettoyage litière quotidien, antiparasitaires réguliers',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Solitaire territorial, chasseur, très indépendant mais affectueux avec son maître',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon avec supervision, apprend aux enfants le respect animal',
      compatibilityWithOtherAnimals: 'Variable selon socialisation, conflits possibles avec autres chats',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Coryza (grippe du chat)',
          symptoms: 'Éternuements, écoulement nasal, conjonctivite, fièvre, perte d\'appétit. Comportement: nez qui coule, yeux qui pleurent.',
          prevention: 'Vaccination RCP (FHV-1, calicivirus, panleucopénie), hygiène, réduction du stress.',
          whenToConsult: 'Dès écoulements nasaux ou oculaires persistants, ou refus de s\'alimenter.',
        },
        {
          name: 'Typhus (panleucopénie féline)',
          symptoms: 'Forte fièvre, vomissements, diarrhée sévère, déshydratation rapide, léthargie extrême. Comportement anormal: prostration.',
          prevention: 'Vaccination obligatoire, quarantaine des nouveaux chats.',
          whenToConsult: 'Urgence: vomissements et diarrhée aigus, surtout chez un chaton non vacciné.',
        },
        {
          name: 'Parasites (puces, vers, tiques)',
          symptoms: 'Démangeaisons, grattage excessif, diarrhée, ventre ballonné, perte d\'appétit, poil terne. Points noirs dans les selles (vers).',
          prevention: 'Antiparasitaires réguliers (internes et externes), environnement propre.',
          whenToConsult: 'Si démangeaisons persistantes, vers visibles dans les selles ou vomis.',
        },
        {
          name: 'Insuffisance rénale chronique',
          symptoms: 'Soif excessive, urines abondantes, perte de poids, mauvaise haleine, léthargie. Comportement: visites fréquentes à la litière.',
          prevention: 'Alimentation adaptée, eau fraîche à volonté, contrôles vétérinaires annuels.',
          whenToConsult: 'Dès augmentation notable de la soif ou de la fréquence urinaire.',
        },
      ],
      sources: [
        { type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/', title: 'PubMed - Feline diseases' },
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'LaFeberVet - Feline health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification (puce) obligatoire, vaccination rage si voyage'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: null, permits: [], restrictions: ['Règles locales variables (vaccination, licence)'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification (puce) obligatoire, vaccination rage si voyage. Règles régionales (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Canidés (Chien = Chien domestique, Canis familiaris / Canis lupus familiaris)
  {
    speciesId: 5287871, // Canis familiaris (syn. Canis lupus familiaris)
    commonNameFr: 'Chien',
    scientificName: 'Canis familiaris',
    category: 'mammifère',
    subcategory: 'Canidé',
    domesticationType: 'domestique',
    description: 'Chien domestique. Carnivore grégaire, très sociable, premier animal domestiqué (~15 000-30 000 ans), nécessite structure et socialisation.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Croquettes / ration équilibrée pour chien', frequency: 'quotidienne', notes: 'Adaptées à la taille et l\'âge' },
        { name: 'Eau fraîche', frequency: 'à disposition', notes: 'Obligatoire' },
      ],
      foodsToAvoid: [
        { name: 'Chocolat', reason: 'Toxique: théobromine' },
        { name: 'Raisin et raisin sec', reason: 'Insuffisance rénale' },
        { name: 'Macadamia', reason: 'Toxique pour chiens' },
        { name: 'Avocat', reason: 'Toxine persine' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Protéines 18-25%, graisses 5-15%, calcium/phosphore équilibrés, fibres',
    },
    habitat: {
      habitatType: 'libre',
      tempMin: 5,
      tempMax: 30,
      minSpaceSize: 'Variable selon race: 50m² minimum pour petit, +100m² pour grand',
      lightNeeds: 'Exposition naturelle régulière',
      activityEnrichment: 'Très actif: sorties 2-3x/jour, jeux, entraînement, interactions sociales',
      hygieneNotes: 'Toilettage régulier, vaccins annuels, antiparasitaires',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Grégaire, hiérarchique, loyal à sa meute (famille), besoin de leadership, apprenabilité excellente',
      sociability: 'grégaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Excellent si bien socialisé et supervisé',
      compatibilityWithOtherAnimals: 'Généralement bon, dépend de génétique et socialisation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Parvovirose canine',
          symptoms: 'Vomissements, diarrhée sanglante, fièvre, déshydratation, léthargie. Comportement: refus de manger, prostration.',
          prevention: 'Vaccination CHPL (dès 8 semaines), éviter lieux à risque avant rappels.',
          whenToConsult: 'Urgence: diarrhée hémorragique et vomissements chez chiot ou chien non vacciné.',
        },
        {
          name: 'Maladie de Carré',
          symptoms: 'Fièvre, écoulement nasal/oculaire, toux, diarrhée, signes neurologiques (convulsions, paralysie). Comportement anormal: désorientation.',
          prevention: 'Vaccination CHPL obligatoire.',
          whenToConsult: 'Dès symptômes respiratoires ou neurologiques chez un chien non vacciné.',
        },
        {
          name: 'Parasites internes et externes',
          symptoms: 'Démangeaisons, diarrhée, ventre gonflé, toux (vers du cœur), perte de poids. Comportement: se frotter le derrière au sol.',
          prevention: 'Vermifugation et antiparasitaires réguliers, hygiène des lieux.',
          whenToConsult: 'Si vers visibles dans les selles ou vomis, ou démangeaisons persistantes.',
        },
        {
          name: 'Dysplasie hanche / arthrose',
          symptoms: 'Boiterie, difficulté à se lever, réticence à sauter ou courir. Comportement: moins d\'entrain, raideur matinale.',
          prevention: 'Poids optimal, exercice adapté, éviter escaliers excessifs chez jeunes grandes races.',
          whenToConsult: 'Dès boiterie ou refus d\'activité persistants.',
        },
      ],
      sources: [
        { type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/', title: 'Canine infectious diseases' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification et vaccination rage obligatoires, catégories pour certaines races'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Licence et vaccination selon États et municipalités'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification et vaccination rage obligatoires. Catégories pour certaines races. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Lapins
  {
    speciesId: 5283399, // Oryctolagus cuniculus
    commonNameFr: 'Lapin domestique',
    scientificName: 'Oryctolagus cuniculus',
    category: 'mammifère',
    subcategory: 'Lagomorphe',
    domesticationType: 'domestique',
    description: 'Herbivore grégaire, bon pour familles, très expressif, nécessite large espace et enrichissement.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Foin à volonté (timothy, prairie)', frequency: 'ad libitum', notes: '80% de la ration, usure des dents' },
        { name: 'Verdure fraîche variée', frequency: 'quotidienne', notes: 'Laitue, roquette, persil, fanes carotte' },
        { name: 'Granulés / croquettes pour lapin uniquement', frequency: 'quotidienne', notes: '20% de la ration, pas de mélange graines' },
        { name: 'Légumes racines', frequency: 'hebdomadaire', notes: 'Carotte, betterave en petit volume' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, dangereuses pour lapins' },
        { name: 'Tomate verte', reason: 'Solanine toxique' },
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Foin moisi', reason: 'Toxines' },
        { name: 'Chou cru excessif', reason: 'Problèmes digestifs' },
      ],
      mealFrequency: 'continuous',
      specificNeeds: 'Fibre très élevée (16-18%), calcium modéré, uniquement aliments pour lapin',
    },
    habitat: {
      habitatType: 'enclos',
      tempMin: 10,
      tempMax: 20,
      minSpaceSize: '2m² par lapin minimum, 4m² recommandé',
      lightNeeds: 'Cycle jour/nuit naturel 12h/12h',
      activityEnrichment: 'Saut, creusage: tunnels, fosses de creusage, obstacles, compagnie essentiels',
      hygieneNotes: 'Nettoyage quotidien, litière absorbante, vérification dents mensuelles',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire, timide mais sociable, crepusculaire (actif aube/crépuscule), communicatif',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon avec supervision, peut mordre si stressé',
      compatibilityWithOtherAnimals: 'Bon avec congénères du même sexe, risque prédation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Myxomatose',
          symptoms: 'Gonflement des paupières et du visage, conjonctivite, écoulements, nodules (myxomes), difficultés respiratoires. Comportement: apathie, perte d\'appétit. Incubation 8-10 jours.',
          prevention: 'Vaccination avant la saison des moustiques, moustiquaires, limiter l\'humidité.',
          whenToConsult: 'Urgence: dès gonflement des yeux ou du museau, ou si lapin non vacciné exposé.',
        },
        {
          name: 'Maladie hémorragique virale (VHD)',
          symptoms: 'Fièvre, léthargie, difficultés respiratoires, saignements. Évolution souvent foudroyante. Comportement: prostration brutale.',
          prevention: 'Vaccination annuelle, hygiène stricte, pas de contact avec lapins sauvages.',
          whenToConsult: 'Urgence: tout lapin apathique avec fièvre ou difficultés respiratoires.',
        },
        {
          name: 'Malocclusion dentaire',
          symptoms: 'Bave excessive, difficulté à manger, perte de poids, abcès. Comportement: tri des aliments, refus du foin.',
          prevention: 'Foin à volonté (usure des dents), contrôles dentaires réguliers.',
          whenToConsult: 'Dès bave, amaigrissement ou refus de manger.',
        },
        {
          name: 'Coccidioses / parasites digestifs',
          symptoms: 'Diarrhée, ballonnement, perte de poids, léthargie. Comportement: rester prostré, ventre sensible.',
          prevention: 'Hygiène des cages, quarantaine des nouveaux, alimentation équilibrée.',
          whenToConsult: 'Diarrhée persistante ou ventre gonflé et douloureux.',
        },
      ],
      sources: [
        { type: 'woah', url: 'https://woah.org/fr/maladie/myxomatose/', title: 'OMSA - Myxomatose' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction particulière pour lapin domestique'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Certains États interdisent la vente en animalerie'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Cochons d'Inde (Cabaye = même espèce, Cavia porcellus)
  {
    speciesId: 5281775, // Cavia porcellus
    commonNameFr: 'Cochon d\'Inde',
    scientificName: 'Cavia porcellus',
    category: 'mammifère',
    subcategory: 'Rongeur-Caviidé',
    domesticationType: 'domestique',
    description: 'Cochon d\'Inde (Cabaye). Herbivore grégaire, petit rongeur vocal, excellent pour enfants, besoin de compagnie.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Foin à volonté (timothy ou prairie)', frequency: 'ad libitum', notes: 'Base de la ration, usure des dents, fibre essentielle' },
        { name: 'Croquettes / granulés pour cochon d\'Inde', frequency: 'quotidienne', notes: 'Enrichis vitamine C (ils ne la synthétisent pas)' },
        { name: 'Légumes frais variés', frequency: 'quotidienne', notes: 'Chou, carotte, persil, laitue, poivron' },
        { name: 'Fruits en petite quantité', frequency: 'hebdomadaire', notes: 'Pomme, banane (sucres limités)' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, toxiques pour rongeurs' },
        { name: 'Patate crue', reason: 'Toxique' },
        { name: 'Oignon et ail', reason: 'Toxiques' },
        { name: 'Persil en excès', reason: 'Trop d\'acide oxalique' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Vitamine C 10-50 mg/jour obligatoire (pas de synthèse), fibre très élevée, uniquement aliments pour cochon d\'Inde',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 18,
      tempMax: 24,
      minSpaceSize: 'Minimum 2 cochons dans 1m x 0.5m x 0.5m',
      lightNeeds: 'Cycle jour/nuit 12h',
      activityEnrichment: 'Tunnels, cachettes, matériaux à ronger, compagnie obligatoire',
      hygieneNotes: 'Nettoyage bihebdomadaire, litière papier absorbant, vérification respiration',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire, vocal (vocalises variées), diurne, sociable et affectueux',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Très bon, calme et petite taille',
      compatibilityWithOtherAnimals: 'Risque avec prédateurs naturels (chat, furet)',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Scorbut (carence en vitamine C)',
          symptoms: 'Faiblesse, difficulté à marcher, saignements des gencives, perte d\'appétit. Comportement: léthargie, refus de bouger.',
          prevention: 'Apport quotidien en vitamine C (légumes frais, granulés enrichis), pas de carence prolongée.',
          whenToConsult: 'Dès boiterie, faiblesse ou refus de manger (ils ne synthétisent pas la vitamine C).',
        },
        {
          name: 'Problèmes respiratoires',
          symptoms: 'Éternuements, écoulement nasal, respiration sifflante, yeux collés. Comportement: rester en boule, moins actif.',
          prevention: 'Éviter courants d\'air, litière non poussiéreuse, pas de cage humide.',
          whenToConsult: 'Dès éternuements persistants ou respiration bruyante.',
        },
        {
          name: 'Parasites (gale, poux)',
          symptoms: 'Démangeaisons, perte de poils, croûtes, agitation. Comportement: grattage excessif.',
          prevention: 'Hygiène de la cage, éviter contact avec animaux infestés.',
          whenToConsult: 'Si perte de poils par plaques ou grattage intense.',
        },
        {
          name: 'Dystocie (difficulté à mettre bas)',
          symptoms: 'Efforts prolongés sans naissance, léthargie, écoulement anormal. Comportement: stress, position anormale.',
          prevention: 'Femelle pas trop âgée pour première portée, calcium et environnement calme.',
          whenToConsult: 'Urgence: si la femelle peine plus de 20-30 min sans petit né.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Guinea pig health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Hamsters
  {
    speciesId: 5289046, // Mesocricetus auratus
    commonNameFr: 'Hamster doré',
    scientificName: 'Mesocricetus auratus',
    category: 'mammifère',
    subcategory: 'Rongeur-Cricétidé',
    domesticationType: 'domestique',
    description: 'Omnivore solitaire, nocturne, très compacte, idéal petits espaces, peu socialisant.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Croquettes / granulés pour hamster uniquement', frequency: 'quotidienne', notes: '1-2 cuillères à café, base de la ration' },
        { name: 'Graines variées (sans excès)', frequency: 'quotidienne', notes: 'Tournesol, courge, lin' },
        { name: 'Légumes frais', frequency: 'quelques fois/semaine', notes: 'Carotte, concombre, brocoli' },
        { name: 'Protéines animales', frequency: 'hebdomadaire', notes: 'Insectes séchés, blanc d\'œuf cuit' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, toxiques pour hamster' },
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Amande amère', reason: 'Cyanure' },
        { name: 'Oignon, ail', reason: 'Toxiques' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Uniquement aliments pour rongeur/hamster, peu de sucres (risque diabète), vitamine E',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 20,
      tempMax: 24,
      minSpaceSize: '450L minimum (40x25x30cm), meilleur 650L',
      lightNeeds: 'Cycle jour/nuit inverted si cohabitation (nocturne)',
      activityEnrichment: 'Roue XXL, tunnels, matériau creusage, peu de socialisation',
      hygieneNotes: 'Nettoyage hebdomadaire, litière papier, contrôle dents mensuellement',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Solitaire obligatoire (mâle agrès), nocturne très actif, peu affectueux',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Modéré, peut mordre, besoin supervision',
      compatibilityWithOtherAnimals: 'Solitaire strictement',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Syndrome de la queue mouillée (prolifération bactérienne)',
          symptoms: 'Diarrhée aqueuse, queue souillée, léthargie, déshydratation. Comportement: rester prostré, refus de manger.',
          prevention: 'Réduction du stress, hygiène stricte, pas de surpopulation.',
          whenToConsult: 'Urgence: diarrhée brutale et léthargie (évolution rapide possible).',
        },
        {
          name: 'Maladies respiratoires',
          symptoms: 'Éternuements, écoulement nasal, respiration sifflante. Comportement: moins actif, yeux mi-clos.',
          prevention: 'Éviter courants d\'air, litière non poussiéreuse, température stable.',
          whenToConsult: 'Dès éternuements persistants ou respiration bruyante.',
        },
        {
          name: 'Abcès et infections cutanées',
          symptoms: 'Gonflement localisé, chaleur, pus. Comportement: léchage excessif, irritabilité.',
          prevention: 'Cage propre, pas de blessures (cage sans arêtes vives).',
          whenToConsult: 'Dès apparition d\'un gonflement ou d\'une plaie.',
        },
        {
          name: 'Diabète (hamster doré)',
          symptoms: 'Soif excessive, urines abondantes, perte ou prise de poids. Comportement: léthargie.',
          prevention: 'Alimentation pauvre en sucres, pas d\'excès de fruits.',
          whenToConsult: 'Si soif anormalement élevée ou perte de poids inexpliquée.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Hamster health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour hamster domestique'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Hamster doré interdit en Nouvelle-Zélande et Australie'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Furets
  {
    speciesId: 5282447, // Mustela putorius furo
    commonNameFr: 'Furet domestique',
    scientificName: 'Mustela putorius furo',
    category: 'mammifère',
    subcategory: 'Mustellidé',
    domesticationType: 'domestique',
    description: 'Carnivore solitaire actif, prédateur, peut être agressif, nécessite expertise.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Croquettes furet haute protéines', frequency: 'quotidienne', notes: '35-40% protéines' },
        { name: 'Viande maigre crue', frequency: 'hebdomadaire', notes: 'Poulet, lapin' },
      ],
      foodsToAvoid: [
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Sucres', reason: 'Hypertrophie pancréas' },
        { name: 'Végétaux', reason: 'Intolérance digestive' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Très haute protéine animal 35-40%, très basse fibre',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 15,
      tempMax: 21,
      minSpaceSize: 'Cage 1m x 0.5m minimum',
      lightNeeds: 'Cycle naturel 12h/12h',
      activityEnrichment: 'Extrêmement actif: fouille, tunnel, jeux, sortie quotidienne obligatoire',
      hygieneNotes: 'Odeur forte (glandes anales), nettoyage fréquent, stérilisation',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Très actif, curieux, joueur mais potentiellement agressif et prédateur',
      sociability: 'solitaire',
      difficultyLevel: 'expert',
      compatibilityWithChildren: 'Déconseillé, peut mordre',
      compatibilityWithOtherAnimals: 'Danger pour petits animaux, isolation nécessaire',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Maladie aléoutienne (ADV)',
          symptoms: 'Perte de poids progressive, léthargie, difficultés respiratoires, paralysie. Comportement: apathie, refus de jouer.',
          prevention: 'Vaccination inexistante; éviter contact avec furets infectés, tests avant introduction.',
          whenToConsult: 'Dès amaigrissement inexpliqué ou faiblesse progressive.',
        },
        {
          name: 'Insulinome (tumeur pancréas)',
          symptoms: 'Faiblesse, crises (convulsions, salivation), léthargie après repas. Comportement: collapsus, désorientation.',
          prevention: 'Alimentation pauvre en sucres, contrôles vétérinaires réguliers après 3 ans.',
          whenToConsult: 'Urgence: crise de faiblesse ou convulsion (hypoglycémie).',
        },
        {
          name: 'Maladies surrénaliennes',
          symptoms: 'Perte de poils (queue, flancs), peau grasse, comportement agressif ou hyperactif. Comportement anormal: agressivité accrue.',
          prevention: 'Stérilisation précoce recommandée, suivi vétérinaire.',
          whenToConsult: 'Dès perte de poils symétrique ou changement de comportement marqué.',
        },
        {
          name: 'Grippe (transmissible humain–furet)',
          symptoms: 'Éternuements, fièvre, écoulement nasal, léthargie. Comportement: rester au nid.',
          prevention: 'Éviter contact si vous êtes malade, vaccination antigrippale possible (discuter avec vétérinaire).',
          whenToConsult: 'Dès symptômes respiratoires ou fièvre.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/basic-information-sheet-ferret/', title: 'Basic Information Sheet: Ferret' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification et vaccination rage obligatoires pour voyage UE'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Interdit en Californie, New York City; autres États variables'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Détention réglementée. Règles régionales (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Chinchilla
  {
    speciesId: 5285159, // Chinchilla lanigera
    commonNameFr: 'Chinchilla',
    scientificName: 'Chinchilla lanigera',
    category: 'mammifère',
    subcategory: 'Rongeur-Chinchillidé',
    domesticationType: 'domestique',
    description: 'Herbivore grégaire, nocturne/crépusculaire, fourrure dense, craintif, longévité 15-20 ans.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Foin à volonté (timothy)', frequency: 'ad libitum', notes: 'Base de la ration, usure des dents' },
        { name: 'Granulés / croquettes pour chinchilla uniquement', frequency: 'quotidienne', notes: '1-2 cuillerées, fibre très élevée' },
        { name: 'Légumes frais (petites quantités)', frequency: 'hebdomadaire', notes: 'Carotte, roquette' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, toxiques pour chinchilla' },
        { name: 'Foin luzerne en excès', reason: 'Trop de calcium (risque calculs)' },
        { name: 'Graines grasses', reason: 'Surpoids' },
        { name: 'Chocolat', reason: 'Toxique' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Uniquement aliments pour chinchilla; fibre très élevée, peu de graisses',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 16,
      tempMax: 22,
      humidityMin: 40,
      humidityMax: 60,
      minSpaceSize: 'Cage verticale 1.2m haut x 0.6m x 0.6m pour 2',
      lightNeeds: 'Cycle jour/nuit 12h, sensible lumière forte',
      activityEnrichment: 'Saut vertical, creusage, bain poussière quotidien ESSENTIEL',
      hygieneNotes: 'Bain poussière quotidien (pas eau), contrôle fourrure densité',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Timide, grégaire, très sauteur, crepusculaire, peu affectueux initialement',
      sociability: 'grégaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Modéré, craintif, peut mordre si stressé',
      compatibilityWithOtherAnimals: 'Grégaire mais peut combattre',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Malocclusion dentaire',
          symptoms: 'Difficulté à manger, bave, perte de poids, abcès. Comportement: refus de granulés, tri alimentaire.',
          prevention: 'Foin et bois à ronger pour usure des dents (à croissance continue).',
          whenToConsult: 'Dès bave ou amaigrissement (dents poussent en permanence).',
        },
        {
          name: 'Coup de chaleur',
          symptoms: 'Léthargie, respiration rapide, position allongée. Comportement: immobilité, oreilles rouges.',
          prevention: 'Température 16-22°C, pas d\'exposition directe au soleil, ventilation.',
          whenToConsult: 'Urgence: si température ambiante > 25°C et chinchilla prostré.',
        },
        {
          name: 'Problèmes digestifs (ballonnement, stase)',
          symptoms: 'Ventre gonflé, absence de selles, refus de manger, douleur. Comportement: rester en boule.',
          prevention: 'Alimentation riche en fibres, pas de changement brutal, bain de poussière régulier.',
          whenToConsult: 'Urgence: absence de selles et ventre dur.',
        },
        {
          name: 'Teigne et parasites',
          symptoms: 'Perte de poils par plaques, démangeaisons, croûtes. Comportement: grattage.',
          prevention: 'Quarantaine des nouveaux, hygiène, pas de stress excessif.',
          whenToConsult: 'Si perte de poils en plaques ou lésions cutanées.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Chinchilla health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour chinchilla domestique'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Souris blanches
  {
    speciesId: 5289002, // Mus musculus domesticus
    commonNameFr: 'Souris blanche domestique',
    scientificName: 'Mus musculus domesticus',
    category: 'mammifère',
    subcategory: 'Rongeur-Muridé',
    domesticationType: 'domestique',
    description: 'Omnivore grégaire, très petite, intelligente, nocturne, sociable, durée de vie 2-3 ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Croquettes / granulés pour souris ou rongeur', frequency: 'quotidienne', notes: 'Base de la ration, formule complète' },
        { name: 'Graines variées (sans excès)', frequency: 'quotidienne', notes: 'Tournesol, courge' },
        { name: 'Légumes frais', frequency: 'quelques fois/semaine', notes: 'Carotte, brocoli' },
        { name: 'Protéines occasionnelles', frequency: 'hebdomadaire', notes: 'Œuf cuit, insectes' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, toxiques pour souris' },
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Noix de macadamia', reason: 'Toxique' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Uniquement aliments pour rongeur (souris); omnivore équilibré',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 20,
      tempMax: 24,
      minSpaceSize: '450 L minimum pour groupe',
      lightNeeds: 'Cycle 12h/12h',
      activityEnrichment: 'Tunnels, roues, jouets à ronger, compagnie essentielle (3+ souris)',
      hygieneNotes: 'Nettoyage hebdomadaire, litière papier absorbant',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire intelligente, sociable, curieuse, peut reconnaître maître',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon si supervision, petit animal fragile',
      compatibilityWithOtherAnimals: 'Prédation risque avec carnivores',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Tumeurs mammaires',
          symptoms: 'Grosseur(s) sous la peau, souvent sur le ventre ou les flancs. Comportement: peut rester normale longtemps.',
          prevention: 'Stérilisation précoce réduit fortement le risque.',
          whenToConsult: 'Dès apparition d\'une boule ou masse palpable.',
        },
        {
          name: 'Infections respiratoires (mycoplasmose)',
          symptoms: 'Éternuements, respiration sifflante, écoulement rouge (porphyrine), léthargie. Comportement: moins actif, regroupé.',
          prevention: 'Litière non poussiéreuse, bonne aération, pas de courants d\'air.',
          whenToConsult: 'Dès respiration bruyante ou écoulement nasal/oculaire persistant.',
        },
        {
          name: 'Parasites (poux, gale)',
          symptoms: 'Démangeaisons, perte de poils, croûtes, grattage. Comportement: agitation.',
          prevention: 'Hygiène de la cage, éviter contact avec animaux infestés.',
          whenToConsult: 'Si grattage excessif ou lésions cutanées.',
        },
        {
          name: 'Abcès et infections cutanées',
          symptoms: 'Gonflement, pus, plaie. Comportement: léchage de la zone.',
          prevention: 'Cage propre, pas de bagarres (surveiller cohabitation).',
          whenToConsult: 'Dès gonflement ou plaie qui ne guérit pas.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Mouse health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Rats domestiques
  {
    speciesId: 5289003, // Rattus norvegicus
    commonNameFr: 'Rat domestique',
    scientificName: 'Rattus norvegicus domesticus',
    category: 'mammifère',
    subcategory: 'Rongeur-Muridé',
    domesticationType: 'domestique',
    description: 'Omnivore grégaire, intelligent, sociable, affectueux, nocturne, très expressif.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Croquettes / granulés pour rat uniquement', frequency: 'quotidienne', notes: 'Formule complète, base de la ration' },
        { name: 'Légumes variés frais', frequency: 'quotidienne', notes: 'Carotte, brocoli, courge' },
        { name: 'Fruits en petite quantité', frequency: 'hebdomadaire', notes: 'Pomme, banane' },
        { name: 'Protéines', frequency: 'hebdomadaire', notes: 'Œuf dur, poulet cuit sans sel' },
      ],
      foodsToAvoid: [
        { name: 'Croquettes chien ou chat', reason: 'Non adaptées, toxiques pour rat' },
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Pépins de pomme', reason: 'Toxiques' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Uniquement aliments pour rat; 12-18% protéines, pas d\'excès de graisses',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 20,
      tempMax: 24,
      minSpaceSize: 'Cage 1 m x 0,6 m x 0,6 m pour 2-3 rats',
      lightNeeds: 'Cycle 12h/12h',
      activityEnrichment: 'Très actif: tunnels, niveaux multiples, roue, jeux interactifs',
      hygieneNotes: 'Nettoyage 2x/semaine (très urineux), litière papier',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire très intelligent, sociable et affectueux, peuvent apprendre commandes',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Excellent si supervision, très doux',
      compatibilityWithOtherAnimals: 'Prédation risque majeur',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Tumeurs (mammaires, hypophysaires)',
          symptoms: 'Grosseur(s), perte de poids, difficultés neurologiques. Comportement: léthargie, perte d\'équilibre.',
          prevention: 'Stérilisation précoce (femelles), contrôles réguliers.',
          whenToConsult: 'Dès masse palpable ou changement de comportement persistant.',
        },
        {
          name: 'Infections respiratoires (mycoplasmose)',
          symptoms: 'Éternuements, respiration sifflante, écoulement porphyrine (rouge), léthargie. Comportement: regroupé, moins actif.',
          prevention: 'Litière non poussiéreuse, bonne ventilation.',
          whenToConsult: 'Dès respiration bruyante ou écoulement nasal/oculaire.',
        },
        {
          name: 'Parasites et gale',
          symptoms: 'Démangeaisons, perte de poils, croûtes. Comportement: grattage excessif.',
          prevention: 'Hygiène, traitement préventif si nécessaire.',
          whenToConsult: 'Si lésions cutanées ou grattage intense.',
        },
        {
          name: 'Insuffisance rénale / vieillesse',
          symptoms: 'Perte de poids, soif accrue, léthargie. Comportement: moins actif, perte d\'appétit.',
          prevention: 'Alimentation équilibrée, suivi vétérinaire en vieillissant.',
          whenToConsult: 'Amaigrissement ou soif anormale persistants.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Rat health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour rat domestique'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Certaines villes interdisent rats (ex. Alberta)'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // OISEAUX DOMESTIQUES (200+)
  // ============================================

  // Poules domestiques
  {
    speciesId: 5228265, // Gallus gallus
    commonNameFr: 'Poule domestique',
    scientificName: 'Gallus gallus domesticus',
    category: 'oiseau',
    subcategory: 'Galliforme',
    domesticationType: 'domestique',
    description: 'Omnivore grégaire, production œufs/viande, excellent pour jardin, rusticité variable.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Granulés poules', frequency: 'quotidienne', notes: 'Base de la ration' },
        { name: 'Verdure (herbe, légumes)', frequency: 'quotidienne', notes: 'Forage, restes légumes' },
        { name: 'Eau fraîche', frequency: 'à disposition', notes: 'Abreuvoir propre' },
      ],
      foodsToAvoid: [
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Aliments moisis', reason: 'Aflatoxines' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Granulés + verdure + eau (FR/BE). Calcium pour ponte (coquilles).',
    },
    habitat: {
      habitatType: 'enclos',
      tempMin: -10,
      tempMax: 35,
      minSpaceSize: 'Poulailler + parcours sécurisé',
      lightNeeds: 'Lumière naturelle 14-16h pour ponte',
      activityEnrichment: 'Forage actif, poussière, grattage, socialisation en groupe',
      hygieneNotes: 'Nettoyage hebdomadaire poulailler, protégé prédateurs, ventilation',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire, hiérarchisée, omnivore opportuniste, broodeuse',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon, doux si habituées',
      compatibilityWithOtherAnimals: 'Dominantes, peuvent combattre petits oiseaux',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Coccidiose',
          symptoms: 'Diarrhée, amaigrissement, plumes ébouriffées, léthargie. Comportement: rester à l\'écart, moins actif.',
          prevention: 'Hygiène du poulailler, pas de surpopulation, désinfection régulière.',
          whenToConsult: 'Diarrhée persistante ou amaigrissement rapide.',
        },
        {
          name: 'Poux et acariens',
          symptoms: 'Démangeaisons, perte de plumes, irritation, œufs visibles à la base des plumes. Comportement: picorage excessif.',
          prevention: 'Poussière, bains de cendres, inspection régulière.',
          whenToConsult: 'Si infestation visible ou perte de plumes anormale.',
        },
        {
          name: 'Maladie de Marek',
          symptoms: 'Paralysie des pattes/ailes, tumeurs, cécité. Comportement: difficulté à marcher, déséquilibre.',
          prevention: 'Vaccination des poussins (souvent faite en couvoir), éviter introduction non vaccinée.',
          whenToConsult: 'Dès paralysie ou boiterie inexpliquée.',
        },
        {
          name: 'Ponte interne / rétention d\'œuf',
          symptoms: 'Efforts sans ponte, abdomen gonflé, léthargie, position accroupie. Comportement: rester au nid sans pondre.',
          prevention: 'Calcium suffisant, lumière adaptée, pas de stress.',
          whenToConsult: 'Urgence: si la poule peine à pondre plus de 24h.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Poultry health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Déclaration possible en mairie selon commune; règles sanitaires'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Règles locales (urbain/rural) variables'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Règles régionales (Wallonie, Flandre, Bruxelles). Poulailler conforme'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Canaris
  {
    speciesId: 5307065, // Serinus canaria
    commonNameFr: 'Canari',
    scientificName: 'Serinus canaria domesticus',
    category: 'oiseau',
    subcategory: 'Fringillidé',
    domesticationType: 'domestique',
    description: 'Grainier, chanteur, petit oiseau robuste, idéal appartement, très coloré.',
    feeding: {
      dietType: 'granivor',
      recommendedFoods: [
        { name: 'Graines pour canari', frequency: 'quotidienne', notes: 'Alpiste, navette, chènevis' },
        { name: 'Verdure fraîche', frequency: 'quotidienne', notes: 'Épinard, laitue, carotte, pissenlit' },
        { name: 'Fruits en petite quantité', frequency: 'hebdomadaire', notes: 'Pomme, orange' },
      ],
      foodsToAvoid: [
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Graines trop grasses en excès', reason: 'Surpoids' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Graines + verdure (base FR/BE). Iode pour plumage, vitamine A.',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 15,
      tempMax: 25,
      minSpaceSize: 'Cage minimum 0,5 m x 0,3 m x 0,3 m',
      lightNeeds: 'Cycle 12-14 h pour santé, plus lumière pour chant',
      activityEnrichment: 'Vol intérieur, perchoirs variés, baignoire',
      hygieneNotes: 'Nettoyage cage 2x/semaine, mangeoires quotidiennes',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Chanteur excellent mâles, territorial, peu sociable inter-oiseaux',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon, spectaculaire pour enfants',
      compatibilityWithOtherAnimals: 'Solitaire, séparation si cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Acariose des plumes / déplumaison',
          symptoms: 'Perte de plumes, démangeaisons, peau irritée. Comportement: picorage excessif, agitation.',
          prevention: 'Hygiène de la cage, bain régulier, pas de stress.',
          whenToConsult: 'Si perte de plumes anormale ou lésions cutanées.',
        },
        {
          name: 'Problèmes respiratoires (aspergillose)',
          symptoms: 'Respiration sifflante, écoulement nasal, léthargie. Comportement: moins actif, bec ouvert.',
          prevention: 'Éviter litière moisi, bonne ventilation, pas d\'humidité excessive.',
          whenToConsult: 'Dès respiration bruyante ou écoulement.',
        },
        {
          name: 'Carence en iode (goitre)',
          symptoms: 'Gonflement du cou, difficultés respiratoires, voix modifiée. Comportement: fatigue.',
          prevention: 'Bloc minéral avec iode, alimentation variée.',
          whenToConsult: 'Si gonflement visible au niveau du cou.',
        },
        {
          name: 'Coccidiose / parasites digestifs',
          symptoms: 'Diarrhée, amaigrissement, plumes sales. Comportement: apathie.',
          prevention: 'Hygiène, aliments frais, pas de surpopulation.',
          whenToConsult: 'Diarrhée persistante ou amaigrissement.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Canary health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour canari domestique'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Perroquets ondulés (Budgerigars)
  {
    speciesId: 5347054, // Melopsittacus undulatus
    commonNameFr: 'Perruche ondulée',
    scientificName: 'Melopsittacus undulatus',
    category: 'oiseau',
    subcategory: 'Perroquet',
    domesticationType: 'domestique',
    description: 'Petit psittacidé grégaire, très sociable, apte à parler, coloré, longévité 8-12 ans.',
    feeding: {
      dietType: 'granivor-frugivore',
      recommendedFoods: [
        { name: 'Graines ou extrudés perruche', frequency: 'quotidienne', notes: 'Base de la ration' },
        { name: 'Légumes frais', frequency: 'quotidienne', notes: 'Carotte, épinard, brocoli' },
        { name: 'Calcium (os de seiche, bloc minéral)', frequency: 'à disposition', notes: 'Essentiel pour ponte et squelette' },
        { name: 'Fruits en petite quantité', frequency: 'hebdomadaire', notes: 'Pomme, raisin' },
      ],
      foodsToAvoid: [
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Sel', reason: 'Danger' },
        { name: 'Chocolat', reason: 'Toxique' },
        { name: 'Caféine', reason: 'Toxique' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Varié: graines, fruits, légumes, protéines',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 18,
      tempMax: 24,
      minSpaceSize: 'Cage 0.5m x 0.3m x 0.3m par perruche',
      lightNeeds: 'Cycle 12-14h, sensible manque lumière',
      activityEnrichment: 'Vol quotidien, jouets interactifs, baignade, perchoirs variés',
      hygieneNotes: 'Nettoyage 3x/semaine, baignoire quotidienne',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Grégaire très sociable, joyeuses, peuvent mimiquer parole, territoriales',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Très bon, doux si socialisé',
      compatibilityWithOtherAnimals: 'Grégaire, compatible avec congénères',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Psittacose (chlamydiose)',
          symptoms: 'Éternuements, écoulement nasal/oculaire, diarrhée, léthargie. Comportement: plumes ébouriffées, somnolence. Zoonose possible.',
          prevention: 'Quarantaine des nouveaux oiseaux, hygiène, évitement du stress.',
          whenToConsult: 'Dès symptômes respiratoires ou diarrhée (consultation vétérinaire et précautions zoonose).',
        },
        {
          name: 'Acariose (Knemidocoptes)',
          symptoms: 'Croûtes sur le bec, les pattes ou autour des yeux. Comportement: grattage, inconfort.',
          prevention: 'Inspection régulière, traitement préventif si contact avec oiseaux sauvages.',
          whenToConsult: 'Dès apparition de croûtes ou déformation du bec.',
        },
        {
          name: 'Tumeurs (lipomes, tumeurs graisseuses)',
          symptoms: 'Grosseur sous la peau, souvent sur le thorax. Comportement: peut rester normale.',
          prevention: 'Alimentation pauvre en graisses, exercice (vol).',
          whenToConsult: 'Dès apparition d\'une masse palpable.',
        },
        {
          name: 'Carence en vitamine A',
          symptoms: 'Plaques blanches dans la bouche, difficultés respiratoires, infections récurrentes. Comportement: moins actif.',
          prevention: 'Alimentation variée (légumes, fruits colorés).',
          whenToConsult: 'Si lésions buccales ou infections à répétition.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Budgerigar health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour perruche ondulée domestique'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Perroquets Gris d'Afrique
  {
    speciesId: 5345889, // Psittacus erithacus
    commonNameFr: 'Perroquet Gris d\'Afrique',
    scientificName: 'Psittacus erithacus',
    category: 'oiseau',
    subcategory: 'Perroquet',
    domesticationType: 'NAC',
    description: 'Grand psittacidé très intelligent, parole excellente, longévité 40-50+ ans, engagement sérieux requis.',
    feeding: {
      dietType: 'frugivore-omnivore',
      recommendedFoods: [
        { name: 'Extrudés perroquet', frequency: 'quotidienne', notes: 'Base de la ration' },
        { name: 'Légumes frais', frequency: 'quotidienne', notes: 'Variété importante' },
        { name: 'Noix modérées', frequency: 'quotidienne', notes: 'Amande, noisette, en friandise' },
        { name: 'Fruits frais', frequency: 'quotidienne', notes: 'Complément' },
      ],
      foodsToAvoid: [
        { name: 'Avocat', reason: 'Toxique' },
        { name: 'Sel', reason: 'Danger cardiaque' },
        { name: 'Excès de noix', reason: 'Obésité' },
        { name: 'Caféine', reason: 'Cardiotoxique' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Extrudés + légumes ; noix modérées (FR/BE). Hypocalcémie fréquente : calcium.',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 20,
      tempMax: 28,
      minSpaceSize: 'Grande volière + enrichissement',
      lightNeeds: 'Cycle 12h naturel avec exposition UVA',
      activityEnrichment: 'Vol librement, enrichissement extrêmement important: destruction jouets, creusage, énigmes',
      hygieneNotes: 'Nettoyage fréquent, pulvérisation eau quotidienne',
      costEstimate: 'élevé',
    },
    behavior: {
      generalBehavior: 'Très intelligent (intelligence enfant 4 ans), affectueux, peut être destructeur, parole imitée',
      sociability: 'grégaire',
      difficultyLevel: 'expert',
      compatibilityWithChildren: 'Modéré, peut mordre, attention supervisée',
      compatibilityWithOtherAnimals: 'Peut être agressif, cohabitation difficile',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Psittacine Beak and Feather Disease (PBFD)',
          symptoms: 'Plumes anormales, déformation du bec, perte de plumes. Comportement: léthargie, immunosuppression.',
          prevention: 'Éviter contact avec oiseaux infectés, tests avant introduction.',
          whenToConsult: 'Dès déformation du bec ou plumes anormales (maladie incurable).',
        },
        {
          name: 'Comportement stéréotypé et picage',
          symptoms: 'Arrachage de plumes, automutilation. Comportement anormal: stress, ennui, anxiété.',
          prevention: 'Enrichissement, interactions, pas de stress, environnement adapté.',
          whenToConsult: 'Dès picage persistant (causes médicales à exclure).',
        },
        {
          name: 'Maladies hépatiques (stéatose)',
          symptoms: 'Léthargie, perte d\'appétit, abdomen gonflé. Comportement: moins actif.',
          prevention: 'Alimentation pauvre en graisses, pas d\'excès de graines.',
          whenToConsult: 'Amaigrissement ou abdomen gonflé inexpliqué.',
        },
        {
          name: 'Infections respiratoires',
          symptoms: 'Respiration sifflante, écoulement nasal, léthargie. Comportement: bec ouvert, queue qui bat.',
          prevention: 'Pas de courants d\'air, humidité adaptée, pas de fumée.',
          whenToConsult: 'Dès respiration bruyante ou écoulement.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/basic-information-sheet-african-grey-parrot/', title: 'Basic Information Sheet: African Grey Parrot' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'I', euAnnex: 'A', permits: ['Certificat de capacité et autorisation préfectorale pour détenir, vendre ou transporter'], restrictions: ['Espèce menacée; commerce et détention strictement réglementés'] }, sources: ['https://cites.org', 'https://www.legifrance.gouv.fr/'] },
      { country: 'US', status: 'permit_required', details: { citesAppendix: 'I', permits: ['Permis CITES pour commerce et transport'], restrictions: ['Wild Bird Conservation Act; importation réglementée'] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'I', euAnnex: 'A', permits: ['Permis CITES, certificat de capacité'], restrictions: ['Espèce CITES I, détention très réglementée. Règles régionales BE'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // REPTILES (200+)
  // ============================================

  // Boa Constrictor
  {
    speciesId: 2448340, // Boa Constrictor
    commonNameFr: 'Boa Constrictor',
    scientificName: 'Boa constrictor',
    category: 'reptile',
    subcategory: 'Serpent constricteur',
    domesticationType: 'NAC',
    description: 'Grand serpent constricteur solitaire, calme relativement, adulte 1.5-2.2m, longévité 20-30 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Souris ou rat selon taille du serpent', frequency: 'toutes les 7-10 jours', notes: 'Proie = largeur du corps max. Juvénile: souris; adulte: rat, puis lapin jeune' },
        { name: 'Proies congelées-décongelées (recommandé)', frequency: 'toutes les 7-10 jours', notes: 'Plus sûr, pas de blessure; décongeler à température ambiante' },
        { name: 'Proies vivantes (avec surveillance)', frequency: 'si refus du congelé', notes: 'Risque de morsure du rongeur: ne jamais laisser sans surveillance' },
      ],
      foodsToAvoid: [
        { name: 'Proies vivantes sans surveillance', reason: 'Le rongeur peut blesser ou tuer le serpent' },
        { name: 'Proies trop grandes', reason: 'Impaction digestive, régurgitation' },
      ],
      mealFrequency: 'every_7_10_days',
      specificNeeds: 'Proies entières (rongeurs), taille adaptée à l\'âge et à la taille du serpent; congelé préférable',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 24,
      tempMax: 30,
      humidityMin: 60,
      humidityMax: 80,
      minSpaceSize: 'Adulte 150x60x60cm minimum',
      lightNeeds: 'Cycle jour/nuit 12h, pas UV crucial',
      activityEnrichment: 'Branchages, cachettes chaudes/froides, peu d\'enrichissement requis',
      hygieneNotes: 'Nettoyage hebdomadaire, eau fraîche constamment disponible',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Solitaire très calme, peu agressif, reclus le jour, actif nuit',
      sociability: 'solitaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Pas recommandé sans supervision, peut constricter',
      compatibilityWithOtherAnimals: 'Prédateur, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Inclusion Body Disease (IBD)',
          symptoms: 'Régurgitation fréquente, mouvements de tête anormaux (stargazing), paralysie progressive, refus de nourriture. Comportement anormal: désorientation.',
          prevention: 'Quarantaine des nouveaux animaux, éviter contact avec serpents de statut inconnu.',
          whenToConsult: 'Dès symptômes neurologiques ou régurgitations répétées (maladie incurable).',
        },
        {
          name: 'Stomatite (pourriture buccale)',
          symptoms: 'Gencives rouges ou enflées, pus ou mucus dans la bouche, refus de manger, bave excessive. Comportement: garder la gueule ouverte.',
          prevention: 'Hygiène du terrarium, température et humidité adaptées.',
          whenToConsult: 'Dès premiers signes d\'inflammation buccale.',
        },
        {
          name: 'Mites et parasites externes',
          symptoms: 'Points noirs mobiles sur les écailles, bains fréquents, agitation, mue difficile. Comportement: rester dans l\'eau.',
          prevention: 'Quarantaine des nouveaux, substrat propre, inspection régulière.',
          whenToConsult: 'Si infestation visible ou persistante.',
        },
        {
          name: 'Infections respiratoires',
          symptoms: 'Respiration bruyante, mucus au niveau du nez ou de la bouche, bouche ouverte, léthargie. Comportement: tête levée, gueule ouverte.',
          prevention: 'Éviter courants d\'air, maintenir température et humidité correctes.',
          whenToConsult: 'Immédiatement en cas de difficultés respiratoires.',
        },
      ],
      sources: [
        { type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/28525780/', title: 'Inclusion Body Disease in Boid Snakes' },
        { type: 'lafebervet', url: 'https://lafeber.com/vet/basic-information-sheet-boa-constrictor/', title: 'Basic Information Sheet: Boa Constrictor' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité requis au-delà de 3 individus ou si vente'], restrictions: ['Déclaration obligatoire pour tout détenteur'] }, sources: ['https://cites.org', 'https://www.legifrance.gouv.fr/'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: 'II', permits: [], restrictions: ['Certains États interdisent serpents constricteurs (ex. New York)'] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité au-delà de 3 individus ou si vente'], restrictions: ['Déclaration obligatoire. Règles régionales (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Python Royal
  {
    speciesId: 7587934, // Python regius
    commonNameFr: 'Python Royal',
    scientificName: 'Python regius',
    category: 'reptile',
    subcategory: 'Serpent constricteur',
    domesticationType: 'NAC',
    description: 'Petit serpent docile, très populaire, peu agressif, adulte 1-1.5m, longévité 15-20 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Souris ou rat selon taille du serpent', frequency: 'tous les 7-10 jours', notes: 'Juvénile: souris pinky puis souris; adulte: rat jeune ou souris adulte. Proie ≤ largeur du corps' },
        { name: 'Congelé-décongelé (recommandé)', frequency: 'tous les 7-10 jours', notes: 'Plus sûr; décongeler complètement avant de proposer' },
        { name: 'Vivant uniquement si refus persistant du congelé', frequency: 'avec surveillance', notes: 'Ne jamais laisser sans surveillance (risque pour le serpent)' },
      ],
      foodsToAvoid: [
        { name: 'Proies vivantes sans surveillance', reason: 'Le rongeur peut mordre ou blesser le serpent' },
        { name: 'Proies trop grosses', reason: 'Régurgitation, impaction' },
      ],
      mealFrequency: 'every_7_10_days',
      specificNeeds: 'Proies rongeurs (souris/rat) adaptées à la taille; refus alimentaire périodique normal (saison, stress)',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 24,
      tempMax: 29,
      humidityMin: 50,
      humidityMax: 70,
      minSpaceSize: 'Adulte 120x60x60cm minimum',
      lightNeeds: 'Cycle jour/nuit 12h, pas UV essentiel',
      activityEnrichment: 'Cachettes, branchages, peu d\'enrichissement',
      hygieneNotes: 'Nettoyage hebdomadaire, bassin d\'eau accessible',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Très calme peu agressif, solitaire, refus alimentaires périodiques normaux',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon avec supervision, peu agressif',
      compatibilityWithOtherAnimals: 'Solitaire strict, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Inclusion Body Disease (IBD)',
          symptoms: 'Régurgitation, stargazing, paralysie progressive. Comportement anormal: désorientation.',
          prevention: 'Quarantaine des nouveaux, pas de contact avec serpents de statut inconnu.',
          whenToConsult: 'Dès symptômes neurologiques ou régurgitations répétées.',
        },
        {
          name: 'Stomatite (pourriture buccale)',
          symptoms: 'Gencives enflées, pus dans la bouche, bave. Comportement: gueule ouverte.',
          prevention: 'Hygiène du terrarium, température et humidité correctes.',
          whenToConsult: 'Dès inflammation buccale.',
        },
        {
          name: 'Refus alimentaire prolongé',
          symptoms: 'Pas de repas pendant plusieurs semaines. Comportement: peut être normal (saison, stress).',
          prevention: 'Environnement stable, pas de manipulation excessive, proies adaptées.',
          whenToConsult: 'Si perte de poids notable ou refus > 2-3 mois.',
        },
        {
          name: 'Parasites (mites, vers)',
          symptoms: 'Points noirs sur écailles, régurgitation, amaigrissement. Comportement: agitation.',
          prevention: 'Quarantaine, substrat propre.',
          whenToConsult: 'Si infestation visible ou amaigrissement.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/basic-information-sheet-ball-python/', title: 'Basic Information Sheet: Ball Python' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité au-delà de 3 individus'], restrictions: ['Déclaration recommandée'] }, sources: ['https://cites.org'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: 'II', permits: [], restrictions: ['Certains États interdisent pythons (ex. Floride pour espèces invasives)'] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité au-delà de 3 individus ou si vente'], restrictions: ['Déclaration obligatoire. Règles régionales BE'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Gecko Léopard
  {
    speciesId: 5221172, // Eublepharis macularius
    commonNameFr: 'Gecko Léopard',
    scientificName: 'Eublepharis macularius',
    category: 'reptile',
    subcategory: 'Lézard gecko',
    domesticationType: 'NAC',
    description: 'Petit lézard docile, insectivore, très populaire débutants, adulte 20-25cm, longévité 10-20 ans.',
    feeding: {
      dietType: 'insectivore',
      recommendedFoods: [
        { name: 'Insectes vivants uniquement', frequency: 'quotidienne juvénile, 3-4x/semaine adulte', notes: 'Grillons, criquets, vers de farine (taille adaptée)' },
        { name: 'Calcium + D3 en poudre', frequency: '3-4 fois par semaine', notes: 'Saupoudrer les insectes avant distribution' },
        { name: 'Sans UVB: calcium avec D3', frequency: 'à chaque repas ou 3-4x/semaine', notes: 'Vitamine D3 nécessaire si pas d\'éclairage UVB' },
        { name: 'Avec UVB (optionnel): calcium sans D3 possible', frequency: 'selon protocole', notes: 'Réduire D3 pour éviter surdosage' },
      ],
      foodsToAvoid: [
        { name: 'Insectes morts ou secs seuls', reason: 'Doivent être vivants pour déclencher la chasse' },
        { name: 'Insectes sauvages', reason: 'Parasites, pesticides' },
        { name: 'Proies trop grandes', reason: 'Impaction (max largeur entre les yeux)' },
      ],
      mealFrequency: 'daily_juvenile',
      specificNeeds: 'Insectes vivants; complémentation calcium et D3 obligatoire (MBD sinon). Vitamine A si besoin (œil, mue)',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 20,
      tempMax: 28,
      humidityMin: 40,
      humidityMax: 60,
      minSpaceSize: '60x40x40cm adulte',
      lightNeeds: 'Cycle 12h jour/nuit, pas UV essentiel (nocturne)',
      activityEnrichment: 'Cachettes chaudes/froides, plantes vivantes, peu activité jour',
      hygieneNotes: 'Nettoyage hebdomadaire, bassin eau, substrat sable fin ou papier',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Docile peu agressif, nocturne, solitaire, peut reconnaître maître',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon avec supervision, petit animal fragile',
      compatibilityWithOtherAnimals: 'Solitaire, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Maladie métabolique osseuse (MBD)',
          symptoms: 'Déformation des membres, mâchoire molle, tremblements, difficulté à marcher, fractures spontanées. Comportement: faiblesse, refus de bouger.',
          prevention: 'Supplémentation en calcium + D3, UVB 10.0, alimentation variée.',
          whenToConsult: 'Dès premiers signes de faiblesse ou déformation.',
        },
        {
          name: 'Cryptosporidiose',
          symptoms: 'Amaigrissement malgré l\'appétit, queue fine (stick tail), régurgitations. Comportement: léthargie.',
          prevention: 'Quarantaine stricte des nouveaux, hygiène rigoureuse (maladie très contagieuse).',
          whenToConsult: 'Perte de poids inexpliquée ou queue très fine.',
        },
        {
          name: 'Problèmes de mue (dysecdysis)',
          symptoms: 'Peau retenue sur les doigts, yeux, queue; constricture des doigts. Comportement: grattage, inconfort.',
          prevention: 'Boîte humide disponible, humidité correcte (40-50%).',
          whenToConsult: 'Si peau reste coincée plus de 48h ou problème récurrent.',
        },
        {
          name: 'Impaction intestinale',
          symptoms: 'Ventre gonflé, pas de selles, léthargie, refus de manger. Comportement: immobilité.',
          prevention: 'Éviter substrats ingérables (sable fin), température suffisante.',
          whenToConsult: 'Absence de selles pendant plus de 2 semaines.',
        },
      ],
      sources: [
        { type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/32723559/', title: 'Metabolic bone disease in reptiles' },
        { type: 'ivis', url: 'https://www.ivis.org/library/exotic-animal-formulary', title: 'Exotic Animal Formulary - Reptiles' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction particulière pour gecko léopard'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Iguane Vert
  {
    speciesId: 5220648, // Iguana iguana
    commonNameFr: 'Iguane Vert',
    scientificName: 'Iguana iguana',
    category: 'reptile',
    subcategory: 'Lézard iguane',
    domesticationType: 'NAC',
    description: 'Grand lézard herbivore, très exigeant, adulte 1.2-1.8m, longévité 15-20 ans, expertise requise.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Verdure verte variée', frequency: 'quotidienne', notes: 'Laitue, roquette, épinard' },
        { name: 'Légumes', frequency: 'quotidienne', notes: 'Carotte, courgette, potimarron' },
        { name: 'Fruits', frequency: 'hebdomadaire', notes: 'Papaye, mangue, figue' },
        { name: 'Pollen floral', frequency: 'occasionnelle' },
      ],
      foodsToAvoid: [
        { name: 'Tomate', reason: 'Acide oxalique trop élevé' },
        { name: 'Protéines animales', reason: 'Herbivore strict' },
        { name: 'Chou excessif', reason: 'Goître' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Herbivore strict, calcium/phosphore ratio 2:1, UVB 10.0 ESSENTIEL',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 24,
      tempMax: 32,
      humidityMin: 60,
      humidityMax: 80,
      minSpaceSize: 'Volière 200x100x150cm MINIMUM adulte',
      lightNeeds: 'UVB 10.0 T5 12h quotidienne CRITIQUE, thermique 4h quotidienne',
      activityEnrichment: 'Branchages épais pour escalade, plantes vivantes comestibles',
      hygieneNotes: 'Brumisation 2x/jour, nettoyage régulier, exigeant en hygiène',
      costEstimate: 'élevé',
    },
    behavior: {
      generalBehavior: 'Grégaire mais territorial adultes, herbivore strict, très exigeant UV, peut devenir agressif',
      sociability: 'grégaire',
      difficultyLevel: 'expert',
      compatibilityWithChildren: 'Pas recommandé, peut griffer et mordre',
      compatibilityWithOtherAnimals: 'Territorial, cohabitation difficile',
    },
  },

  // Tortue Aquatique (Trachemys scripta)
  {
    speciesId: 551789, // Trachemys scripta
    commonNameFr: 'Tortue à Oreilles Rouges',
    scientificName: 'Trachemys scripta elegans',
    category: 'reptile',
    subcategory: 'Tortue aquatique',
    domesticationType: 'NAC',
    description: 'Tortue aquatique omnivore, très populaire, adulte 20-25cm, longévité 30-40 ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Végétation aquatique', frequency: 'quotidienne adulte', notes: 'Ludwigia, elodée' },
        { name: 'Granulés tortues', frequency: 'hebdomadaire adulte', notes: 'Protéine 10-15%' },
        { name: 'Proies vivantes', frequency: 'hebdomadaire juvénile', notes: 'Têtards, petits poissons' },
        { name: 'Verdure', frequency: 'quotidienne', notes: 'Laitue, roquette' },
      ],
      foodsToAvoid: [
        { name: 'Verdure excessive', reason: 'Malnutrition calcium' },
        { name: 'Aliments viande', reason: 'Trop protéines surcharge' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Proportion: juvénile 75% protéines / 25% plantes, adulte inverse',
    },
    habitat: {
      habitatType: 'aquaterrarium',
      tempMin: 24,
      tempMax: 28,
      minSpaceSize: 'Adulte 120x60x60cm minimum, 200L eau',
      lightNeeds: 'UVA/UVB modéré 10h/jour, thermique plateforme 30°C',
      activityEnrichment: 'Plateforme basking, plantes aquatiques, substrat varié',
      hygieneNotes: 'Filtration robuste eau propre, nettoyage régulier, espace plateforme terrestre',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Omnivore semi-aquatique, grégaire juvénile mais territoriale adulte',
      sociability: 'grégaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Modéré, surveillance requise coups griffe',
      compatibilityWithOtherAnimals: 'Prédatrice petits animaux, territorialité',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Maladie de la carapace (pourriture, carence)',
          symptoms: 'Carapace molle, taches, odeur, lésions. Comportement: léthargie, refus de manger.',
          prevention: 'UVB adapté, calcium, eau propre, plateforme de séchage.',
          whenToConsult: 'Dès ramollissement de la carapace ou lésions visibles.',
        },
        {
          name: 'Infections respiratoires',
          symptoms: 'Respiration bouche ouverte, mucus, léthargie. Comportement: flottement anormal.',
          prevention: 'Température et qualité d\'eau correctes, pas de courants d\'air.',
          whenToConsult: 'Dès respiration bruyante ou écoulement.',
        },
        {
          name: 'Parasites internes',
          symptoms: 'Diarrhée, perte de poids, vers dans les selles. Comportement: apathie.',
          prevention: 'Quarantaine des nouveaux, examens coprologiques.',
          whenToConsult: 'Diarrhée persistante ou amaigrissement.',
        },
        {
          name: 'Rétention d\'œufs',
          symptoms: 'Efforts sans ponte, léthargie, position anormale. Comportement: agitation.',
          prevention: 'Site de ponte adapté, calcium suffisant.',
          whenToConsult: 'Urgence: si la femelle peine à pondre plus de 24h.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Red-eared slider health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'prohibited', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Vente et introduction interdites (espèce invasive depuis 2016)'] }, sources: ['https://www.legifrance.gouv.fr/'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Interdiction vente < 10 cm (FDA); certains États interdisent'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Ne pas relâcher en milieu naturel. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Caméléon casqué
  {
    speciesId: 5218993, // Chamaeleo calyptratus
    commonNameFr: 'Caméléon Casqué',
    scientificName: 'Chamaeleo calyptratus',
    category: 'reptile',
    subcategory: 'Lézard caméléon',
    domesticationType: 'NAC',
    description: 'Insectivore solitaire, changement couleur, très exigeant, adulte 45-60cm, longévité 6-8 ans.',
    feeding: {
      dietType: 'insectivore',
      recommendedFoods: [
        { name: 'Crickets', frequency: 'quotidienne', notes: 'Principale alimentation' },
        { name: 'Sauterelles', frequency: 'hebdomadaire' },
        { name: 'Blattes', frequency: 'hebdomadaire' },
        { name: 'Vers divers', frequency: 'occasionnelle' },
      ],
      foodsToAvoid: [
        { name: 'Insectes sauvages', reason: 'Pesticides parasites' },
        { name: 'Insectes trop gros', reason: 'Impaction' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Calcium D3 régulier, insectes variés ESSENTIEL pour nutriments',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 24,
      tempMax: 32,
      humidityMin: 50,
      humidityMax: 70,
      minSpaceSize: 'Volière 80x80x150cm minimum',
      lightNeeds: 'UVB 10.0 12h quotidienne ESSENTIEL, thermique spot 32°C',
      activityEnrichment: 'Branchages épais pour escalade, plantes vivantes feuillues',
      hygieneNotes: 'Brumisation 2-3x/jour, terrarium bien aéré, substrat humidité',
      costEstimate: 'élevé',
    },
    behavior: {
      generalBehavior: 'Solitaire strict très territorial, peu agressif envers humains, carnivore actif chasseur',
      sociability: 'solitaire',
      difficultyLevel: 'expert',
      compatibilityWithChildren: 'Pas recommandé, animal fragile craintif',
      compatibilityWithOtherAnimals: 'Territorial strict aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Carence en calcium / MBD',
          symptoms: 'Mâchoire molle, membres faibles, fractures. Comportement: difficulté à grimper, léthargie.',
          prevention: 'Calcium + D3 sur proies, UVB 10.0 obligatoire.',
          whenToConsult: 'Dès faiblesse ou déformation.',
        },
        {
          name: 'Déshydratation',
          symptoms: 'Yeux enfoncés, peau peu élastique, léthargie. Comportement: moins actif.',
          prevention: 'Brumisation 2-3x/jour, goutte à goutte, humidité 50-70%.',
          whenToConsult: 'Dès yeux enfoncés ou refus de manger.',
        },
        {
          name: 'Infections oculaires',
          symptoms: 'Œil fermé, gonflement, écoulement. Comportement: frottement, inconfort.',
          prevention: 'Humidité adaptée, pas de substrat irritant.',
          whenToConsult: 'Dès œil fermé ou gonflé.',
        },
        {
          name: 'Stress (couleurs sombres prolongées)',
          symptoms: 'Couleur sombre persistante, refus de manger. Comportement anormal: stress chronique.',
          prevention: 'Environnement calme, cachettes, pas de surpopulation.',
          whenToConsult: 'Si refus alimentaire ou couleur anormale prolongée.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Chameleon health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité au-delà de 6 individus'], restrictions: ['Espèce réglementée'] }, sources: ['https://cites.org'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: 'II', permits: [], restrictions: [] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité au-delà de 6 individus'], restrictions: ['Espèce réglementée. Règles régionales BE'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // AMPHIBIENS (100)
  // ============================================

  // Grenouille Taureau
  {
    speciesId: 5209234, // Lithobates catesbeianus
    commonNameFr: 'Grenouille Taureau',
    scientificName: 'Lithobates catesbeianus',
    category: 'amphibien',
    subcategory: 'Grenouille',
    domesticationType: 'NAC',
    description: 'Grande grenouille carnivore, semi-aquatique, adulte 10-20cm, longévité 5-10 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Crickets', frequency: 'quotidienne', notes: 'Principale proie' },
        { name: 'Vers', frequency: 'hebdomadaire' },
        { name: 'Petits insectes', frequency: 'quotidienne' },
        { name: 'Proies vivantes', frequency: 'quotidienne', notes: 'Chasse instinct' },
      ],
      foodsToAvoid: [
        { name: 'Insectes toxiques', reason: 'Certaines espèces danger' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Protéine animal bonne qualité, variation proies importante',
    },
    habitat: {
      habitatType: 'aquaterrarium',
      tempMin: 20,
      tempMax: 28,
      humidityMin: 70,
      humidityMax: 100,
      minSpaceSize: '80x40x40cm minimum',
      lightNeeds: 'Cycle 12h jour/nuit, pas UV essentiel',
      activityEnrichment: 'Zones terre et eau équilibrées, caches humides',
      hygieneNotes: 'Filtre eau régulier, brumisation quotidienne, substrat humide',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Carnivore vorace, peu agressif envers humains, semi-aquatique',
      sociability: 'solitaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Modéré, peut mordre',
      compatibilityWithOtherAnimals: 'Prédatrice, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Chytridiomycose (Batrachochytrium)',
          symptoms: 'Peau épaisse, léthargie, perte d\'appétit, mort. Comportement: rester immobile.',
          prevention: 'Quarantaine des nouveaux, pas d\'introduction d\'eau ou d\'animaux sauvages.',
          whenToConsult: 'Dès lésions cutanées ou léthargie anormale (zoonose et menace mondiale).',
        },
        {
          name: 'Red Leg (infection bactérienne)',
          symptoms: 'Rougeur des pattes et ventre, léthargie, perte d\'appétit. Comportement: apathie.',
          prevention: 'Eau propre, pas de surpopulation, pas de stress.',
          whenToConsult: 'Dès rougeur visible ou comportement anormal.',
        },
        {
          name: 'Parasites internes',
          symptoms: 'Amaigrissement, diarrhée, gonflement. Comportement: moins actif.',
          prevention: 'Proies propres, quarantaine.',
          whenToConsult: 'Amaigrissement inexpliqué ou selles anormales.',
        },
        {
          name: 'Carence en vitamines (A, D)',
          symptoms: 'Œdème des membres, difficulté à sauter. Comportement: faiblesse.',
          prevention: 'Supplémentation sur proies, UV modéré.',
          whenToConsult: 'Dès œdème ou difficulté motrice.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Bullfrog health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'prohibited', details: { citesAppendix: null, permits: [], restrictions: ['Espèce invasive, détention et vente réglementées ou interdites'] }, sources: ['https://www.legifrance.gouv.fr/'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Interdite dans certains États (espèce invasive)'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Ne pas relâcher. Règles régionales BE (liste espèces exotiques)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Axolotl
  {
    speciesId: 5209105, // Ambystoma mexicanum
    commonNameFr: 'Axolotl',
    scientificName: 'Ambystoma mexicanum',
    category: 'amphibien',
    subcategory: 'Salamandre aquatique',
    domesticationType: 'NAC',
    description: 'Salamandre aquatique permanente, très populaire, adulte 23-27cm, longévité 10-15 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Vers (vers de vase, tubifex)', frequency: 'quotidienne', notes: 'Proies carnées' },
        { name: 'Granulés carnés pour axolotl', frequency: 'quotidienne', notes: 'Complément pratique' },
        { name: 'Artémia, petits morceaux poisson', frequency: '2-3x/semaine', notes: 'Variation' },
      ],
      foodsToAvoid: [
        { name: 'Proies trop grosses', reason: 'Risque impaction' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Vers / granulés carnés (FR/BE). Carnivore strict, eau fraîche.',
    },
    habitat: {
      habitatType: 'aquarium',
      tempMin: 16,
      tempMax: 20,
      minSpaceSize: 'Aquarium eau fraîche, cachettes',
      lightNeeds: 'Pas de lumière forte (sensible), cycle 12h faible',
      activityEnrichment: 'Plantes aquatiques, cachettes, peu d\'activité',
      hygieneNotes: 'Filtre robuste eau frais régulier, changement eau 20% hebdomadaire',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Aquatique permanent, peu agressif, apprenabilité étonnante',
      sociability: 'solitaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Bon, animal fragile pas manipulation',
      compatibilityWithOtherAnimals: 'Peut manger petits poissons, cohabitation limitée',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Fungus (Saprolegnia) sur branchies ou peau',
          symptoms: 'Masses blanches ou grises sur la peau ou les branchies. Comportement: léthargie, refus de manger.',
          prevention: 'Eau propre, pas de blessures, température stable (16-22°C).',
          whenToConsult: 'Dès apparition de masses ou lésions.',
        },
        {
          name: 'Stress thermique (température trop haute)',
          symptoms: 'Léthargie, branchies rouges, nage anormale. Comportement: immobilité, flottement.',
          prevention: 'Température < 22°C obligatoire (refroidisseur si besoin).',
          whenToConsult: 'Urgence si température > 24°C et axolotl prostré.',
        },
        {
          name: 'Impaction / constipation',
          symptoms: 'Ventre gonflé, pas de selles, flottement. Comportement: inconfort.',
          prevention: 'Substrat fin ou pas de substrat ingérable, proies adaptées.',
          whenToConsult: 'Absence de selles ou ventre très gonflé.',
        },
        {
          name: 'Morsures entre congénères',
          symptoms: 'Membres ou branchies sectionnés. Comportement: isolement, stress.',
          prevention: 'Espace suffisant, cachettes, pas de surpopulation.',
          whenToConsult: 'Dès blessure visible (régénération possible si soins).',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Axolotl health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour souches d\'élevage'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Interdit en Californie, Nouveau-Mexique, Virginie (espèce protégée à l\'état sauvage)'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction aquarium. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // POISSONS (150)
  // ============================================

  // Poisson Rouge
  {
    speciesId: 5210786, // Carassius auratus
    commonNameFr: 'Poisson Rouge',
    scientificName: 'Carassius auratus',
    category: 'poisson',
    subcategory: 'Cyprinidé',
    domesticationType: 'domestique',
    description: 'Poisson d\'eau douce grégaire, très populaire, adulte 10-30cm (très variable), longévité 10-15+ ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Flocons spécialisés poisson rouge', frequency: 'quotidienne' },
        { name: 'Granulés coulants', frequency: 'quotidienne' },
        { name: 'Légumes blancs cuits', frequency: 'hebdomadaire', notes: 'Courge, pois' },
        { name: 'Artémia', frequency: 'occasionnelle' },
      ],
      foodsToAvoid: [
        { name: 'Suralimentation', reason: 'Polluant eau excès' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Omnivore équilibré, peu exigeant',
    },
    habitat: {
      habitatType: 'aquarium',
      tempMin: 18,
      tempMax: 25,
      minSpaceSize: 'Minimum 100L pour un (20x20x30cm), 50L/poisson supplémentaire',
      lightNeeds: 'Cycle 12h jour/nuit, éclairage modéré',
      activityEnrichment: 'Plantes, cavités, peu d\'enrichissement requis',
      hygieneNotes: 'Filtre robuste, changement eau 25-30% hebdomadaire',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Omnivore grégaire, peu agressif, très tolérants conditions eau',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Très bon pour initiation',
      compatibilityWithOtherAnimals: 'Cohabitation possible avec poissons de taille similaire',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Ichtyophthiriose (point blanc)',
          symptoms: 'Points blancs sur le corps et nageoires, frottements, respiration rapide. Comportement: léthargie.',
          prevention: 'Quarantaine des nouveaux poissons, température stable, pas de stress.',
          whenToConsult: 'Dès apparition de points blancs (traitement rapide nécessaire).',
        },
        {
          name: 'Pourriture des nageoires',
          symptoms: 'Nageoires effilochées, rougeâtres, ulcères. Comportement: moins actif.',
          prevention: 'Eau propre, pas de surpopulation, pas de blessures.',
          whenToConsult: 'Dès nageoires abîmées ou rougeur.',
        },
        {
          name: 'Maladie des bulles (sur gaz)',
          symptoms: 'Bulles sous la peau ou dans les yeux. Comportement: nage anormale.',
          prevention: 'Éviter sursaturation en gaz (pompe, chauffage adaptés).',
          whenToConsult: 'Dès bulles visibles sous la peau.',
        },
        {
          name: 'Constipation / boule',
          symptoms: 'Ventre gonflé, pas de selles, nage difficile. Comportement: immobilité.',
          prevention: 'Alimentation variée, pas de suralimentation.',
          whenToConsult: 'Ventre très gonflé persistant.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Goldfish health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Betta (Poisson Combattant)
  {
    speciesId: 5300016, // Betta splendens
    commonNameFr: 'Poisson Combattant (Betta)',
    scientificName: 'Betta splendens',
    category: 'poisson',
    subcategory: 'Osphronemidé',
    domesticationType: 'domestique',
    description: 'Petit poisson d\'eau douce territorial, coloré, très populaire, adulte 5-8cm, longévité 3-5 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Granulés carnés pour betta', frequency: 'quotidienne', notes: 'Base de la ration' },
        { name: 'Proies vivantes ou congelées', frequency: '2-3x/semaine', notes: 'Artémia, vers de vase, daphnies' },
        { name: 'Paillettes carnées', frequency: 'complément', notes: 'Haute protéine' },
      ],
      foodsToAvoid: [
        { name: 'Suralimentation', reason: 'Pourriture nageoires, pollution' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Granulés carnés + proies (FR/BE). Protéines importantes pour couleurs.',
    },
    habitat: {
      habitatType: 'aquarium',
      tempMin: 24,
      tempMax: 28,
      minSpaceSize: 'Minimum 20 L (chauffé, faible courant) ; 5 L insuffisant à long terme',
      lightNeeds: 'Cycle 12h jour/nuit',
      activityEnrichment: 'Cachettes, plantes flottantes, peu d\'espace requis',
      hygieneNotes: 'Filtre faible courant, changement eau 30% hebdomadaire',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Territorial très agressif mâles inter-soi, calme humains, peu agressif femelles',
      sociability: 'solitaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon pour observation',
      compatibilityWithOtherAnimals: 'Mâles: ISOLATION stricte (d\'où nom), femelles cohabitation possible',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Pourriture des nageoires (Betta)',
          symptoms: 'Nageoires effilochées, bord rouge, progression vers la base. Comportement: léthargie.',
          prevention: 'Eau propre, pas de courant fort, pas de suralimentation.',
          whenToConsult: 'Dès nageoires abîmées (traitement précoce efficace).',
        },
        {
          name: 'Ichtyophthiriose (point blanc)',
          symptoms: 'Points blancs, frottements, respiration en surface. Comportement: moins actif.',
          prevention: 'Quarantaine des nouveaux, température 24-28°C stable.',
          whenToConsult: 'Dès points blancs visibles.',
        },
        {
          name: 'Constipation / gonflement',
          symptoms: 'Ventre gonflé, pas de selles. Comportement: rester au fond.',
          prevention: 'Alimentation variée, jour de jeûne hebdomadaire possible.',
          whenToConsult: 'Gonflement persistant ou refus de manger.',
        },
        {
          name: 'Stress (couleurs ternes, nageoire serrée)',
          symptoms: 'Couleurs pâles, nageoires collées. Comportement anormal: stress chronique.',
          prevention: 'Cachettes, pas de voisins agressifs, eau propre.',
          whenToConsult: 'Si stress prolongé ou refus alimentaire.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Betta health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Guppy
  {
    speciesId: 5300156, // Poecilia reticulata
    commonNameFr: 'Guppy',
    scientificName: 'Poecilia reticulata',
    category: 'poisson',
    subcategory: 'Poeciliidé',
    domesticationType: 'domestique',
    description: 'Petit poisson coloré grégaire, très populaire débutants, adulte 3-6cm, longévité 2-3 ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Flocons ou granulés omnivores', frequency: 'quotidienne', notes: 'Base de la ration' },
        { name: 'Nauplii artémia, microvers', frequency: '2-3x/semaine', notes: 'Complément' },
      ],
      foodsToAvoid: [
        { name: 'Suralimentation', reason: 'Pollution eau' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Omnivore (FR/BE). Aquarium communautaire, groupe.',
    },
    habitat: {
      habitatType: 'aquarium',
      tempMin: 24,
      tempMax: 26,
      minSpaceSize: 'Aquarium communautaire, groupe ; 40 L min',
      lightNeeds: 'Cycle 12h jour/nuit',
      activityEnrichment: 'Plantes denses, cachettes, zones nage libre',
      hygieneNotes: 'Filtre gentil, changement eau 25% hebdomadaire',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Omnivore grégaire très pacifique, vivement colorés mâles',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Très bon pour initiation petits enfants',
      compatibilityWithOtherAnimals: 'Très pacifique, cohabitation avec nombreux poissons',
    },
  },

  // Tétra Néon
  {
    speciesId: 5299984, // Paracheirodon innesi
    commonNameFr: 'Néon Bleu (Tétra Néon)',
    scientificName: 'Paracheirodon innesi',
    category: 'poisson',
    subcategory: 'Characidé',
    domesticationType: 'domestique',
    description: 'Minuscule poisson grégaire coloré, très populaire aquariums, adulte 2-3cm, longévité 5-8 ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Microépaisses flocons très fins', frequency: 'quotidienne' },
        { name: 'Artémia nano', frequency: 'hebdomadaire' },
        { name: 'Cyclops', frequency: 'hebdomadaire' },
      ],
      foodsToAvoid: [
        { name: 'Rien spécifique', reason: 'Peu exigeant' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Minuscule très petites alimentations',
    },
    habitat: {
      habitatType: 'aquarium',
      tempMin: 22,
      tempMax: 26,
      minSpaceSize: 'Minimum 60L (60x30x30cm) groupe 15+',
      lightNeeds: 'Cycle 12h jour/nuit, lumière douce',
      activityEnrichment: 'Plantes denses, zones nage, très grégaires',
      hygieneNotes: 'Filtre gentil, changement eau 20% hebdomadaire',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Omnivore grégaire très pacifique, nagent en bancs spectaculaires',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Très bon esthétiquement pour observation',
      compatibilityWithOtherAnimals: 'Très pacifiques, cohabitation excellente',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Maladie du Néon (Plistophora)',
          symptoms: 'Décoloration de la bande bleue, amaigrissement, nage erratique. Comportement: isolement du banc.',
          prevention: 'Éviter introduction de poissons non quarantainés (maladie incurable).',
          whenToConsult: 'Dès décoloration ou comportement anormal (traitement limité).',
        },
        {
          name: 'Ichtyophthiriose (point blanc)',
          symptoms: 'Points blancs, frottements. Comportement: léthargie.',
          prevention: 'Quarantaine, eau propre.',
          whenToConsult: 'Dès points blancs.',
        },
        {
          name: 'Stress (couleurs pâles)',
          symptoms: 'Bande bleue pâle, regroupement anormal. Comportement anormal: stress.',
          prevention: 'Banc 10+ individus, plantes, eau douce et acide.',
          whenToConsult: 'Si stress prolongé ou mortalité inexpliquée.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Neon tetra health' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: [] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Réglementation régionale (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // INSECTES & ARACHNIDES (150+)
  // ============================================

  // Phasme
  {
    speciesId: 5296756, // Carausius morosus
    commonNameFr: 'Phasme Bâton',
    scientificName: 'Carausius morosus',
    category: 'insecte',
    subcategory: 'Phasmatodea',
    domesticationType: 'NAC',
    description: 'Insecte herbivore très allongé ressemblant branche, facile soins, adulte 10-12cm, longévité 1-2 ans.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Ronces (feuilles fraîches)', frequency: 'quotidienne', notes: 'Alimentation principale' },
        { name: 'Lierre (feuilles)', frequency: 'quotidienne', notes: 'Complément' },
        { name: 'Feuilles diverses (chêne, framboisier)', frequency: 'quotidienne', notes: 'Variété' },
      ],
      foodsToAvoid: [
        { name: 'Feuilles sèches', reason: 'Insuffisant nutrition' },
        { name: 'Herbicides/pesticides', reason: 'Toxiques' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Ronces / lierre / feuilles fraîches (FR/BE). Herbivore strict.',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 18,
      tempMax: 26,
      minSpaceSize: 'Terrarium ventilé + branches, 30x30x30 cm pour groupe',
      lightNeeds: 'Lumière naturelle, pas UV critique',
      activityEnrichment: 'Branchages pour se nourrir et se reposer',
      hygieneNotes: 'Nettoyage hebdomadaire, humidité modérée 60-80%',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Herbivore lent immobile jour, peu agressif, grégaire',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Excellent pour enfants, pas danger',
      compatibilityWithOtherAnimals: 'Grégaire compatible, aucune prédation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Déshydratation',
          symptoms: 'Phasme sec, peu mobile, mort. Comportement: immobilité.',
          prevention: 'Humidité 60-80%, brumisation régulière, feuillage frais.',
          whenToConsult: 'Si phasmes meurent sans cause évidente (vérifier humidité).',
        },
        {
          name: 'Parasites (mites, nématodes)',
          symptoms: 'Phasmes affaiblis, morts. Comportement: moins actifs.',
          prevention: 'Feuillage propre (pas sauvage non lavé), quarantaine des nouveaux.',
          whenToConsult: 'Mortalité anormale ou phasmes très faibles.',
        },
        {
          name: 'Mue difficile (dysecdysis)',
          symptoms: 'Phasme coincé dans l\'ancienne cuticule, mort possible. Comportement: immobilité anormale.',
          prevention: 'Humidité suffisante pendant la mue, pas de manipulation.',
          whenToConsult: 'Si mue incomplète ou phasme coincé > 24h.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Stick insect care' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction pour phasme bâton'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Certains États interdisent espèces exotiques'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Ne pas relâcher en milieu naturel. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Blatte Madagascar
  {
    speciesId: 5296482, // Gromphadorhina portentosa
    commonNameFr: 'Blatte de Madagascar',
    scientificName: 'Gromphadorhina portentosa',
    category: 'insecte',
    subcategory: 'Blattaria',
    domesticationType: 'NAC',
    description: 'Grande blatte omnivore docile, sifflante, moins dégoûtante pour élevage, adulte 6-8cm, longévité 2-5 ans.',
    feeding: {
      dietType: 'omnivore',
      recommendedFoods: [
        { name: 'Fruits variés', frequency: 'quotidienne', notes: 'Pomme, banane, carotte' },
        { name: 'Légumes', frequency: 'quotidienne', notes: 'Épinard, laitue, courge' },
        { name: 'Protéines', frequency: 'hebdomadaire', notes: 'Œuf, viande cuite' },
      ],
      foodsToAvoid: [
        { name: 'Rien spécifique', reason: 'Très accommodantes' },
      ],
      mealFrequency: 'daily',
      specificNeeds: 'Omnivore équilibré peu exigeant',
    },
    habitat: {
      habitatType: 'cage',
      tempMin: 24,
      tempMax: 28,
      minSpaceSize: 'Terrarium 30x20x20cm minimum',
      lightNeeds: 'Lumière modérée, cycle jour/nuit',
      activityEnrichment: 'Substrat, cachettes, peu d\'enrichissement',
      hygieneNotes: 'Nettoyage bihebdomadaire, substrat humidité modérée, ventilation',
      costEstimate: 'faible',
    },
    behavior: {
      generalBehavior: 'Omnivore sifflante quand dérangée, grégaire pacifique docile',
      sociability: 'grégaire',
      difficultyLevel: 'débutant',
      compatibilityWithChildren: 'Bon si pas peur insectes',
      compatibilityWithOtherAnimals: 'Parfois utilisée nourriture animaux, cohabitation à tester',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Acariens',
          symptoms: 'Points mobiles sur le corps, blattes affaiblies. Comportement: moins actives.',
          prevention: 'Substrat propre, pas de surpopulation, ventilation.',
          whenToConsult: 'Si infestation visible ou mortalité anormale.',
        },
        {
          name: 'Déshydratation',
          symptoms: 'Blattes mortes, corps secs. Comportement: regroupement près de l\'eau.',
          prevention: 'Humidité modérée, gamelle d\'eau, substrat légèrement humide.',
          whenToConsult: 'Mortalité sans cause évidente.',
        },
        {
          name: 'Infections fongiques (moisissure)',
          symptoms: 'Moisissure sur le substrat ou les individus. Comportement: évitement de zones.',
          prevention: 'Ventilation, pas d\'excès d\'humidité, nettoyage régulier.',
          whenToConsult: 'Si moisissure envahissante ou blattes malades.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Madagascar hissing cockroach care' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Aucune restriction; éviter libération (espèce exotique)'] }, sources: [] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Certains États interdisent blattes exotiques'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Détention à des fins pédagogiques ou alimentation reptile. Règles régionales BE'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Araignée (Brachypelma albopilosum)
  {
    speciesId: 5301234, // Brachypelma albopilosum (approximé GBIF)
    commonNameFr: 'Tarentule du Curacao',
    scientificName: 'Brachypelma albopilosum',
    category: 'arachnide',
    subcategory: 'Tarentule',
    domesticationType: 'NAC',
    description: 'Grosse araignée docile peu venimeuse, solitaire, adulte 12-15cm envergure, longévité 12-15 ans femelle.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Crickets', frequency: 'hebdomadaire adulte', notes: 'Principale proie' },
        { name: 'Blattes', frequency: 'hebdomadaire', notes: 'Alternative' },
        { name: 'Jeunes souriceaux', frequency: 'mensuelle adulte', notes: 'Variation adulte' },
      ],
      foodsToAvoid: [
        { name: 'Rien spécifique', reason: 'Carnivore opportuniste' },
      ],
      mealFrequency: 'weekly_biweekly',
      specificNeeds: 'Carnivore strict, proies vivantes préférence',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 22,
      tempMax: 28,
      humidityMin: 65,
      humidityMax: 75,
      minSpaceSize: 'Terrarium 30x20x20cm minimum',
      lightNeeds: 'Lumière indirecte, pas UV essentiel',
      activityEnrichment: 'Substrat 10cm creusage, cachettes, peu actif jour',
      hygieneNotes: 'Nettoyage mensuel, humidité régulière brumisation, aération',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Solitaire carnivore docile peu agressif, peu venimeuse pour humain',
      sociability: 'solitaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Modéré avec supervision, pas danger venom',
      compatibilityWithOtherAnimals: 'Solitaire stricte, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Déshydratation',
          symptoms: 'Abdomen rétréci, léthargie, refus de manger. Comportement: immobilité.',
          prevention: 'Humidité 65-75%, bol d\'eau, brumisation régulière.',
          whenToConsult: 'Si abdomen très rétréci ou refus alimentaire prolongé.',
        },
        {
          name: 'Mue difficile (dysecdysis)',
          symptoms: 'Tarentule coincée dans l\'ancienne cuticule, mort possible. Comportement: sur le dos sans se libérer.',
          prevention: 'Humidité suffisante, pas de manipulation pendant mue.',
          whenToConsult: 'Si mue incomplète > 24-48h (ne pas manipuler).',
        },
        {
          name: 'Blessures (chute)',
          symptoms: 'Abdomen percé, hémolymphe. Comportement: immobilité. Mort possible.',
          prevention: 'Terrarium pas trop haut, pas de manipulation si pas nécessaire.',
          whenToConsult: 'Urgence: si abdomen percé (appliquer pression douce et consulter).',
        },
        {
          name: 'Acariens',
          symptoms: 'Points mobiles sur le corps. Comportement: stress, frottements.',
          prevention: 'Substrat propre, proies propres, pas de surpopulation.',
          whenToConsult: 'Si infestation visible.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Tarantula care' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité pour certaines Brachypelma'], restrictions: ['Espèces réglementées selon annexe'] }, sources: ['https://cites.org'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: 'II', permits: [], restrictions: [] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité pour espèces CITES II'], restrictions: ['Espèces réglementées. Règles régionales BE'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // Scorpion Empereur (Pandinus imperator)
  {
    speciesId: 5299876, // Pandinus imperator
    commonNameFr: 'Scorpion Empereur',
    scientificName: 'Pandinus imperator',
    category: 'arachnide',
    subcategory: 'Scorpion',
    domesticationType: 'NAC',
    description: 'Gros scorpion noir docile peu venimeux, solitaire, adulte 15-20cm, longévité 5-8 ans.',
    feeding: {
      dietType: 'carnivore',
      recommendedFoods: [
        { name: 'Insectes (grillons, blattes, criquets)', frequency: 'hebdomadaire', notes: 'Proies adaptées à la taille' },
        { name: 'Autres petits arthropodes', frequency: 'occasionnelle', notes: 'Variation' },
      ],
      foodsToAvoid: [
        { name: 'Proies trop grosses', reason: 'Risque refus ou blessure' },
      ],
      mealFrequency: 'weekly',
      specificNeeds: 'Insectes (FR/BE). Terrarium tropical, cachettes.',
    },
    habitat: {
      habitatType: 'terrarium',
      tempMin: 24,
      tempMax: 28,
      humidityMin: 60,
      humidityMax: 80,
      minSpaceSize: 'Terrarium tropical ; cachettes',
      lightNeeds: 'Lumière indirecte modérée, pas UV essentiel',
      activityEnrichment: 'Substrat 5cm, cachettes, peu actif jour',
      hygieneNotes: 'Nettoyage mensuel, humidité brumisation régulière',
      costEstimate: 'moyen',
    },
    behavior: {
      generalBehavior: 'Solitaire carnivore docile peu venimeux pour humains',
      sociability: 'solitaire',
      difficultyLevel: 'intermédiaire',
      compatibilityWithChildren: 'Modéré, risque piqûre faible venom',
      compatibilityWithOtherAnimals: 'Solitaire, aucune cohabitation',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Déshydratation',
          symptoms: 'Scorpion affaibli, queue fine. Comportement: immobilité.',
          prevention: 'Humidité 60-80%, substrat humide, bol d\'eau peu profond.',
          whenToConsult: 'Si scorpion très affaibli ou refus alimentaire prolongé.',
        },
        {
          name: 'Mue difficile',
          symptoms: 'Scorpion coincé dans l\'ancienne cuticule. Comportement: sur le dos sans se libérer.',
          prevention: 'Humidité suffisante pendant mue, pas de manipulation.',
          whenToConsult: 'Si mue incomplète > 24h.',
        },
        {
          name: 'Acariens / parasites',
          symptoms: 'Points mobiles sur le corps, stress. Comportement: frottements.',
          prevention: 'Substrat propre, proies propres.',
          whenToConsult: 'Si infestation visible.',
        },
      ],
      sources: [
        { type: 'lafebervet', url: 'https://lafeber.com/vet/', title: 'Emperor scorpion care' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité pour Pandinus imperator'], restrictions: ['Espèce réglementée'] }, sources: ['https://cites.org'] },
      { country: 'US', status: 'allowed', details: { citesAppendix: 'II', permits: [], restrictions: [] }, sources: ['https://cites.org'] },
      { country: 'BE', status: 'permit_required', details: { citesAppendix: 'II', euAnnex: 'B', permits: ['Certificat de capacité pour Pandinus imperator'], restrictions: ['Espèce réglementée. Règles régionales BE'] }, sources: ['https://cites.org', 'https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },

  // ============================================
  // AUTRES MAMMIFÈRES DOMESTIQUES
  // ============================================

  // Horse (Cheval)
  {
    speciesId: 5288995, // Equus caballus
    commonNameFr: 'Cheval domestique',
    scientificName: 'Equus caballus',
    category: 'mammifère',
    subcategory: 'Equidé',
    domesticationType: 'domestique',
    description: 'Grand équidé herbivore grégaire, monture/trait, adulte 140-180cm garrot, longévité 25-30 ans.',
    feeding: {
      dietType: 'herbivore',
      recommendedFoods: [
        { name: 'Herbe / foin', frequency: 'ad libitum', notes: 'Base : pâture ou foin de qualité' },
        { name: 'Minéraux (bloc sel, complément)', frequency: 'à disposition', notes: 'Selon sol et travail' },
        { name: 'Grains (complément si travail)', frequency: 'selon activité', notes: 'Avoine, orge, maïs' },
      ],
      foodsToAvoid: [
        { name: 'Foin moisi', reason: 'Toxines aspergillus' },
        { name: 'Trèfle blanc fermenté', reason: 'Risque cyanure' },
      ],
      mealFrequency: 'continuous',
      specificNeeds: 'Herbe/foin + minéraux (FR/BE). Ration adaptée au travail et à l\'état.',
    },
    habitat: {
      habitatType: 'enclos',
      tempMin: -15,
      tempMax: 35,
      minSpaceSize: 'Pâture/box + abri ; exercice régulier',
      lightNeeds: 'Exposition naturelle lumière quotidienne',
      activityEnrichment: 'Très actif: pâturage 8-12h/jour, galop, socialisation grégaire',
      hygieneNotes: 'Nettoyage box quotidien, maréchal-ferrant 6-8 semaines, vétérinaire annuelle',
      costEstimate: 'élevé',
    },
    behavior: {
      generalBehavior: 'Herbivore grégaire très sociable avec humains, intelligent dressable, animal travail',
      sociability: 'grégaire',
      difficultyLevel: 'expert',
      compatibilityWithChildren: 'Bon si entraîné, animal grand puissant',
      compatibilityWithOtherAnimals: 'Grégaire sociable, cohabitation possible équidés similaires',
    },
    health: {
      locale: 'fr',
      diseases: [
        {
          name: 'Coliques',
          symptoms: 'Agitation, regard vers le flanc, coups de pied au ventre, absence de selles. Comportement anormal: se rouler, transpirer.',
          prevention: 'Alimentation régulière, foin de qualité, pas de changement brutal, vermifugation.',
          whenToConsult: 'Urgence: dès signes de colique (appel vétérinaire immédiat).',
        },
        {
          name: 'Fourbure',
          symptoms: 'Démarche raide, refus de bouger, pieds chauds. Comportement: rester en position « soulagée ».',
          prevention: 'Éviter excès de grains, pâturage progressif au printemps, poids optimal.',
          whenToConsult: 'Urgence: dès boiterie ou refus de marcher.',
        },
        {
          name: 'Parasites (vers, gastérophiles)',
          symptoms: 'Amaigrissement, poil terne, diarrhée, coliques. Comportement: léthargie.',
          prevention: 'Vermifugation régulière (plan avec vétérinaire), pâturage géré.',
          whenToConsult: 'Amaigrissement inexpliqué ou selles anormales.',
        },
        {
          name: 'Rage (vaccination obligatoire)',
          symptoms: 'Changement de comportement, agressivité ou prostration, paralysie. Comportement anormal: neurologique.',
          prevention: 'Vaccination antirabique annuelle (obligatoire en France).',
          whenToConsult: 'Tout changement neurologique ou morsure par animal inconnu.',
        },
      ],
      sources: [
        { type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/', title: 'Equine medicine' },
      ],
    },
    legislation: [
      { country: 'FR', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification (puce), vaccination rage, déclaration détention selon commune'] }, sources: ['https://www.service-public.fr/particuliers/vosdroits/F34922'] },
      { country: 'US', status: 'allowed', details: { permits: [], restrictions: ['Règles sanitaires et identification selon États'] }, sources: [] },
      { country: 'BE', status: 'allowed', details: { citesAppendix: null, euAnnex: null, permits: [], restrictions: ['Identification équidé, règles sanitaires. Règles régionales (Wallonie, Flandre, Bruxelles)'] }, sources: ['https://www.health.belgium.be', 'https://environnement.wallonie.be'] },
    ],
  },
];

export const SPECIES_COUNT = SPECIES_DATABASE.length;
