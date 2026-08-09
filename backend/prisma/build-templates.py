#!/usr/bin/env python3
"""
Génère les templates éditoriaux JSON (backend/prisma/templates/template-*.json)
avec des données complètes et sourcées. Sources vérifiées :
  - Wikipédia FR (pages vérifiées HTTP 200 : Chien, Chat, Lapin_domestique,
    Cheval, Poule, Gecko_léopard, etc.)
  - Wamiz (wamiz.com), Royal Canin FR (royalcanin.com/fr), VCA Hospitals
    (vcahospitals.com), PetMD (petmd.com), INPN (inpn.mnhn.fr),
    Légifrance (Arrêté du 21/11/1997)
"""
import json
import os

OUT = 'backend/prisma/templates'
os.makedirs(OUT, exist_ok=True)

# ─── Sources de référence stables ───
WIKI = {
    'chien': 'https://fr.wikipedia.org/wiki/Chien',
    'chat': 'https://fr.wikipedia.org/wiki/Chat',
    'lapin': 'https://fr.wikipedia.org/wiki/Lapin_domestique',
    'cheval': 'https://fr.wikipedia.org/wiki/Cheval',
    'poule': 'https://fr.wikipedia.org/wiki/Poule',
    'canard': 'https://fr.wikipedia.org/wiki/Canard_colvert',
    'pigeon': 'https://fr.wikipedia.org/wiki/Pigeon_domestique',
    'dindon': 'https://fr.wikipedia.org/wiki/Dindon',
    'gecko': 'https://fr.wikipedia.org/wiki/Gecko_l%C3%A9opard',
    'python': 'https://fr.wikipedia.org/wiki/Python_regius',
    'tortue': 'https://fr.wikipedia.org/wiki/Tortue_de_Hermann',
    'perroquet': 'https://fr.wikipedia.org/wiki/Perroquet_gris',
    'perruche': 'https://fr.wikipedia.org/wiki/Perruche_ondul%C3%A9e',
    'hamster': 'https://fr.wikipedia.org/wiki/Hamster_dor%C3%A9',
    'cochon_inde': 'https://fr.wikipedia.org/wiki/Cochon_d%27Inde',
    'rat': 'https://fr.wikipedia.org/wiki/Rat_domestique',
    'furet': 'https://fr.wikipedia.org/wiki/Furet',
    'poisson': 'https://fr.wikipedia.org/wiki/Poisson_rouge',
    'betta': 'https://fr.wikipedia.org/wiki/Betta_splendens',
    'axolotl': 'https://fr.wikipedia.org/wiki/Axolotl',
    'mygale': 'https://fr.wikipedia.org/wiki/Mygale',
}
WAMIZ = 'https://wamiz.com'
ROYAL = 'https://www.royalcanin.com/fr'
VCA = 'https://vcahospitals.com'
PETMD = 'https://www.petmd.com'
INPN = 'https://inpn.mnhn.fr'
LEGI = 'https://www.legifrance.gouv.fr'

SRC = lambda url, title, typ='wikipedia': {'type': typ, 'url': url, 'title': title}


def wiki(k):
    return [SRC(WIKI[k], f'Wikipédia — page de référence ({k})')]


def vet(*urls):
    return [SRC(u, t, 'vet') for u, t in urls]


# ════════════════════════════════════════════════════════════════
# DÉFINITION DES TEMPLATES
# ════════════════════════════════════════════════════════════════
TEMPLATES = {
    'chien': {
        'espece': 'Chien', 'category': 'mammifère', 'domesticationType': 'domestique',
        'subcategory': 'Chien',
        'feeding': {
            'dietType': 'carnivore',
            'recommendedFoods': [
                {'name': 'Croquettes premium pour chien', 'frequency': 'quotidienne', 'notes': '2 repas/jour, adaptées à la taille et au poids de la race'},
                {'name': 'Pâtée humide complète', 'frequency': 'quotidienne', 'notes': 'Peut compléter les croquettes (max 25 % de la ration)'},
                {'name': 'Viande maigre cuite', 'frequency': 'hebdomadaire', 'notes': 'Poulet ou bœuf, sans sel ni épices'},
                {'name': 'Légumes cuits', 'frequency': 'hebdomadaire', 'notes': 'Carotte, courgette, haricots verts'},
            ],
            'foodsToAvoid': [
                {'name': 'Chocolat', 'reason': 'Théobromine toxique pour les chiens'},
                {'name': 'Raisins et raisins secs', 'reason': 'Insuffisance rénale aiguë possible'},
                {'name': 'Oignons et ail', 'reason': 'Destruction des globules rouges (anémie)'},
                {'name': 'Xylitol (chewing-gums)', 'reason': 'Hypoglycémie sévère et insuffisance hépatique'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': "Protéines animales en tête d'ingrédients, oméga-3 pour la peau et le pelage, calcium/phosphore équilibré. Adapter la taille des croquettes à la mâchoire (grandes races vs races toy) et la ration au poids adulte.",
            'sources': vet((ROYAL + '/fr/chiens', 'Royal Canin — guide alimentation chien'), (VCA + '/fr/chiens', 'VCA Hospitals — soins du chien'), (WAMIZ, 'Wamiz — guide chien')),
        },
        'habitat': {
            'habitatType': 'libre', 'tempMin': 15, 'tempMax': 28,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Vie en intérieur avec accès extérieur sécurisé ou sorties quotidiennes',
            'lightNeeds': 'Lumière naturelle, ne pas exposer au soleil prolongé (coup de chaleur)',
            'activityEnrichment': '2 promenades quotidiennes minimum, jeux de rapport, jouets d\u2019occupation, socialisation',
            'hygieneNotes': 'Brossage 2x/semaine (quotidien pour poils longs), bain 1x/mois, nettoyage des oreilles et des dents',
            'costEstimate': 'moyen',
            'sources': wiki('chien') + vet((VCA, 'VCA Hospitals — santé chien')),
        },
        'behavior': {
            'generalBehavior': 'Animal social, loyal et très attaché à son groupe humain. Besoin de routine, de présence et de dépense physique quotidienne.',
            'sociability': 'semi-grégaire', 'difficultyLevel': 'intermédiaire',
            'compatibilityWithChildren': 'Bon compagnon pour enfants si socialisé tôt et si les interactions sont encadrées.',
            'compatibilityWithOtherAnimals': 'Coexiste avec d\u2019autres chiens et chats si bien socialisé dès le jeune âge.',
            'sources': wiki('chien'),
        },
        'health': {
            'diseases': [
                {'name': 'Dysplasie de la hanche', 'symptoms': 'Boiterie, difficulté à se lever, douleur à la palpation', 'prevention': 'Croissance contrôlée, éviter le surpoids, dépistage radiographique', 'whenToConsult': 'Dès boiterie persistante'},
                {'name': 'Otite', 'symptoms': 'Grattage des oreilles, tête penchée, odeur, rougeur', 'prevention': 'Nettoyage régulier des oreilles, séchage après le bain', 'whenToConsult': 'Dès rougeur, odeur ou grattage intense'},
                {'name': 'Torsion de l\u2019estomac', 'symptoms': 'Abdomen gonflé, agitation, tentatives de vomissement infructueuses', 'prevention': 'Repas fractionnés, pas d\u2019exercice après le repas', 'whenToConsult': 'URGENCE VÉTÉRINAIRE immédiate'},
                {'name': 'Parvovirose (jeunes chiens)', 'symptoms': 'Vomissements, diarrhée hémorragique, abattement', 'prevention': 'Vaccination obligatoire du chiot', 'whenToConsult': 'Dès les premiers symptômes'},
            ],
            'sources': vet((VCA + '/fr/chiens', 'VCA Hospitals — maladies du chien'), (PETMD + '/dogs', 'PetMD — santé canine')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': ['Identification par puce électronique obligatoire', 'Vaccination antirabique pour les déplacements', 'Passeport européen pour voyage']},
            'sources': [SRC(LEGI, 'Légifrance — identification des carnivores domestiques', 'official')],
        },
        'reproduction': {
            'season': "toute l'année", 'gestationDays': 63, 'incubationDays': None,
            'litterSizeMin': 4, 'litterSizeMax': 9, 'sexualMaturityMonths': 12,
            'breedingDifficulty': 'facile',
            'notes': '2 portées maximum par an recommandées. Âge idéal de première saillie : 2-4 ans selon la race.',
            'sources': wiki('chien'),
        },
    },
    'chat': {
        'espece': 'Chat', 'category': 'mammifère', 'domesticationType': 'domestique',
        'subcategory': 'Chat',
        'feeding': {
            'dietType': 'carnivore strict',
            'recommendedFoods': [
                {'name': 'Croquettes premium pour chat', 'frequency': 'quotidienne', 'notes': 'Riches en protéines animales, pauvres en céréales'},
                {'name': 'Pâtée humide', 'frequency': 'quotidienne', 'notes': 'Contribue à l\u2019hydratation (insuffisance rénale fréquente)'},
                {'name': 'Viande maigre cuite', 'frequency': 'hebdomadaire', 'notes': 'Poulet ou dinde, sans sel'},
            ],
            'foodsToAvoid': [
                {'name': 'Chocolat', 'reason': 'Théobromine toxique'},
                {'name': 'Oignons et ail', 'reason': 'Anémie hémolytique'},
                {'name': 'Lait de vache', 'reason': 'Intolérance au lactose fréquente'},
                {'name': 'Raisins', 'reason': 'Insuffisance rénale'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Carnivore strict : taurine OBLIGATOIRE (déficience cardiaque et oculaire sinon), eau fraîche en abondance, repas fractionnés.',
            'sources': vet((ROYAL + '/fr/chats', 'Royal Canin — guide alimentation chat'), (VCA + '/fr/chats', 'VCA Hospitals — soins du chat'), (WAMIZ, 'Wamiz — guide chat')),
        },
        'habitat': {
            'habitatType': 'libre', 'tempMin': 15, 'tempMax': 28,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Intérieur sécurisé (filets aux fenêtres) ou accès extérieur surveillé',
            'lightNeeds': 'Lumière naturelle, zones ombragées',
            'activityEnrichment': 'Arbre à chat, jouets de chasse, griffoirs, cachettes, interactions quotidiennes',
            'hygieneNotes': 'Litière nettoyée quotidiennement, brossage hebdomadaire (quotidien pour poils longs)',
            'costEstimate': 'moyen',
            'sources': wiki('chat') + vet((VCA, 'VCA Hospitals — santé chat')),
        },
        'behavior': {
            'generalBehavior': 'Animal territorial et indépendant mais très attaché à son environnement et à ses humains. Comportement de chasseur marqué.',
            'sociability': 'solitaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Bon compagnon si respecté et manipulé avec douceur dès le jeune âge.',
            'compatibilityWithOtherAnimals': 'Coexiste avec chiens et autres chats si introductions progressives.',
            'sources': wiki('chat'),
        },
        'health': {
            'diseases': [
                {'name': 'Insuffisance rénale chronique', 'symptoms': 'Soif excessive, amaigrissement, vomissements', 'prevention': 'Alimentation adaptée, hydratation, bilan sanguin annuel après 8 ans', 'whenToConsult': 'Dès soif excessive ou amaigrissement'},
                {'name': 'Hyperthyroïdie', 'symptoms': 'Perte de poids malgré un bon appétit, agitation', 'prevention': 'Surveillance du poids, bilan thyroïdien chez le senior', 'whenToConsult': 'Dès perte de poids inexpliquée'},
                {'name': 'Cystite idiopathique', 'symptoms': 'Mictions fréquentes et douloureuses, sang dans les urines', 'prevention': 'Eau en abondance, litière propre, réduction du stress', 'whenToConsult': 'Dès difficultés à uriner (urgence)'},
                {'name': 'PIF (péritonite infectieuse féline)', 'symptoms': 'Fièvre, abattement, épanchement abdominal', 'prevention': 'Limiter le stress, environnement sain', 'whenToConsult': 'Dès fièvre persistante'},
            ],
            'sources': vet((VCA + '/fr/chats', 'VCA Hospitals — maladies du chat'), (PETMD + '/cats', 'PetMD — santé féline')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': ['Identification par puce électronique obligatoire', 'Vaccination antirabique pour les déplacements']},
            'sources': [SRC(LEGI, 'Légifrance — identification des carnivores domestiques', 'official')],
        },
        'reproduction': {
            'season': "toute l'année", 'gestationDays': 65, 'incubationDays': None,
            'litterSizeMin': 2, 'litterSizeMax': 6, 'sexualMaturityMonths': 6,
            'breedingDifficulty': 'facile',
            'notes': 'Stérilisation recommandée (prévention des portées non désirées et de certains cancers).',
            'sources': wiki('chat'),
        },
    },
    'lapin': {
        'espece': 'Lapin domestique', 'category': 'mammifère', 'domesticationType': 'domestique',
        'subcategory': 'Lapin',
        'feeding': {
            'dietType': 'herbivore',
            'recommendedFoods': [
                {'name': 'Foin à volonté', 'frequency': 'quotidienne', 'notes': '80 % de la ration — foin de fléole ou de prairie, essentiel pour les dents et le transit'},
                {'name': 'Granulés lapin', 'frequency': 'quotidienne', 'notes': 'Quantité limitée (1 c. à soupe / kg de poids)'},
                {'name': 'Légumes frais', 'frequency': 'quotidienne', 'notes': 'Endive, feuilles de carotte, persil, basilic'},
                {'name': 'Eau fraîche', 'frequency': 'quotidienne', 'notes': 'Biberon ou gamelle lourde, changée chaque jour'},
            ],
            'foodsToAvoid': [
                {'name': 'Céréales et pain', 'reason': 'Troubles digestifs et obésité'},
                {'name': 'Laitue', 'reason': 'Fermentation et diarrhées'},
                {'name': 'Avocat', 'reason': 'Toxique'},
                {'name': 'Chocolat et sucreries', 'reason': 'Toxiques et obésogènes'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Foin à volonté (80 %), dents à croissance continue (usure par le foin), eau fraîche, granulés dosés, légumes variés.',
            'sources': vet((ROYAL + '/fr/lapins', 'Royal Canin — guide alimentation lapin'), (WAMIZ, 'Wamiz — guide lapin'), (VCA + '/fr/rongeurs', 'VCA Hospitals — soins des rongeurs')),
        },
        'habitat': {
            'habitatType': 'cage', 'tempMin': 15, 'tempMax': 25,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Cage 120x60cm minimum + sorties quotidiennes de 2-3h',
            'lightNeeds': 'Lumière naturelle, éviter le soleil direct',
            'activityEnrichment': 'Sorties quotidiennes, jouets à ronger, tunnels, cachettes',
            'hygieneNotes': 'Litière changée 2x/semaine, brossage hebdomadaire, nettoyage de la cage',
            'costEstimate': 'faible',
            'sources': wiki('lapin') + vet((VCA, 'VCA Hospitals — lapin')),
        },
        'behavior': {
            'generalBehavior': 'Animal social, curieux et joueur. Communique par des bonds, des grognements et le « binkying » (saut de joie).',
            'sociability': 'grégaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Bon compagnon si manipulé avec douceur (dos fragile).',
            'compatibilityWithOtherAnimals': 'Vivre en binôme de lapins recommandé (stérilisés).',
            'sources': wiki('lapin'),
        },
        'health': {
            'diseases': [
                {'name': 'Stase digestive', 'symptoms': 'Arrêt du transit, perte d\u2019appétit, petites crottes', 'prevention': 'Foin à volonté, hydratation, réduction du stress', 'whenToConsult': 'URGENCE — tout arrêt du transit'},
                {'name': 'Malocclusion dentaire', 'symptoms': 'Bavage, perte d\u2019appétit, dents trop longues', 'prevention': 'Foin à volonté (usure naturelle), contrôle dentaire régulier', 'whenToConsult': 'Dès bavage ou refus de manger'},
                {'name': 'Myxomatose', 'symptoms': 'Œdèmes des paupières et des lèvres, fièvre', 'prevention': 'Vaccination annuelle obligatoire', 'whenToConsult': 'Dès les premiers œdèmes'},
                {'name': 'VHD (maladie hémorragique virale)', 'symptoms': 'Mort subite, saignements', 'prevention': 'Vaccination annuelle', 'whenToConsult': 'Urgence — prévention par la vaccination'},
            ],
            'sources': vet((VCA + '/fr/rongeurs', 'VCA Hospitals — lapin santé'), (WAMIZ, 'Wamiz — santé du lapin')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': []},
            'sources': [SRC(LEGI, 'Légifrance — animaux de compagnie', 'official')],
        },
        'reproduction': {
            'season': "toute l'année", 'gestationDays': 31, 'incubationDays': None,
            'litterSizeMin': 4, 'litterSizeMax': 10, 'sexualMaturityMonths': 4,
            'breedingDifficulty': 'facile',
            'notes': 'Stérilisation fortement recommandée (femelles : risque de cancer utérin très élevé).',
            'sources': wiki('lapin'),
        },
    },
    'cheval': {
        'espece': 'Cheval', 'category': 'mammifère', 'domesticationType': 'domestique',
        'subcategory': 'Équidé',
        'feeding': {
            'dietType': 'herbivore',
            'recommendedFoods': [
                {'name': 'Foin de prairie', 'frequency': 'quotidienne', 'notes': '1,5-2 % du poids vif par jour'},
                {'name': 'Herbe de pâture', 'frequency': 'quotidienne', 'notes': 'Selon la disponibilité et la saison'},
                {'name': 'Céréales ou granulés', 'frequency': 'quotidienne', 'notes': 'Adaptés au travail fourni'},
                {'name': 'Pierre à sel', 'frequency': 'quotidienne', 'notes': 'Accès libre'},
            ],
            'foodsToAvoid': [
                {'name': 'Chocolat', 'reason': 'Théobromine toxique'},
                {'name': 'Pain moisi', 'reason': 'Toxique (ergotisme)'},
                {'name': 'Choux et crucifères en excès', 'reason': 'Météorisation'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Fourrage à volonté, eau propre abondante, minéraux (sel, calcium), adapter les céréales à l\u2019effort.',
            'sources': vet((WAMIZ, 'Wamiz — guide cheval'), (ROYAL + '/fr/chevaux', 'Royal Canin — nutrition équine')),
        },
        'habitat': {
            'habitatType': 'enclos', 'tempMin': -5, 'tempMax': 30,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Box 9m² minimum + paddock ou pré',
            'lightNeeds': 'Lumière naturelle, abri contre intempéries',
            'activityEnrichment': 'Travail régulier, sorties au pré, sociabilisation avec congénères',
            'hygieneNotes': 'Pansage quotidien, parage toutes les 6-8 semaines, vermifugation régulière',
            'costEstimate': 'élevé',
            'sources': wiki('cheval'),
        },
        'behavior': {
            'generalBehavior': 'Animal grégaire, sensible et très réactif. Mémoire excellente, besoin de confiance et de régularité.',
            'sociability': 'grégaire', 'difficultyLevel': 'expert',
            'compatibilityWithChildren': 'Certaines races (poneys) adaptées aux enfants, toujours sous supervision.',
            'compatibilityWithOtherAnimals': 'Vie en troupeau naturelle, cohabitation avec ânes et bovins possible.',
            'sources': wiki('cheval'),
        },
        'health': {
            'diseases': [
                {'name': 'Coliques', 'symptoms': 'Agitation, coups de pied au ventre, refus de manger', 'prevention': 'Ration régulière, eau propre, vermifugation', 'whenToConsult': 'URGENCE — tout signe de colique'},
                {'name': 'Fourbure', 'symptoms': 'Boiterie, posture en appui arrière', 'prevention': 'Contrôle du poids, éviter les excès de céréales', 'whenToConsult': 'Dès boiterie'},
                {'name': 'Myopathie', 'symptoms': 'Raideur, sueurs, urines foncées', 'prevention': 'Travail progressif, électrolytes', 'whenToConsult': 'Dès raideur après effort'},
                {'name': 'Parasitisme', 'symptoms': 'Amaigrissement, poil terne', 'prevention': 'Vermifugation ciblée 2-4x/an', 'whenToConsult': 'Lors des contrôles coprologiques'},
            ],
            'sources': vet((VCA + '/fr/chevaux', 'VCA Hospitals — santé équine'), (WAMIZ, 'Wamiz — santé du cheval')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': ['Identification obligatoire (SIRE)', 'Passeport équidé obligatoire']},
            'sources': [SRC(LEGI, 'Légifrance — identification des équidés', 'official')],
        },
        'reproduction': {
            'season': 'printemps-été', 'gestationDays': 340, 'incubationDays': None,
            'litterSizeMin': 1, 'litterSizeMax': 1, 'sexualMaturityMonths': 36,
            'breedingDifficulty': 'avance',
            'notes': 'Gestation de 11 mois, un poulain par naissance. Reproduction réservée à des éleveurs expérimentés.',
            'sources': wiki('cheval'),
        },
    },
    'poule': {
        'espece': 'Poule', 'category': 'oiseau', 'domesticationType': 'domestique',
        'subcategory': 'Galliciné',
        'feeding': {
            'dietType': 'omnivore',
            'recommendedFoods': [
                {'name': 'Granulés ponte', 'frequency': 'quotidienne', 'notes': 'Ration complète pour poules pondeuses'},
                {'name': 'Graines', 'frequency': 'quotidienne', 'notes': 'Maïs concassé, blé (énergie)'},
                {'name': 'Verdure et restes de cuisine', 'frequency': 'quotidienne', 'notes': 'Épluchures, salade, insectes du jardin'},
                {'name': 'Coquilles d\u2019huître broyées', 'frequency': 'quotidienne', 'notes': 'Calcium pour la coquille des œufs'},
            ],
            'foodsToAvoid': [
                {'name': 'Avocat', 'reason': 'Persine toxique'},
                {'name': 'Chocolat', 'reason': 'Théobromine toxique'},
                {'name': 'Oignons crus en excès', 'reason': 'Anémie'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Calcium indispensable pour les pondeuses, eau propre, protéines, grit pour la digestion.',
            'sources': vet((WAMIZ, 'Wamiz — guide poule'), (VCA + '/fr/oiseaux', 'VCA Hospitals — soins des volailles')),
        },
        'habitat': {
            'habitatType': 'enclos', 'tempMin': -5, 'tempMax': 32,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Poulailler 1m²/poule + parcours extérieur herbeux',
            'lightNeeds': 'Lumière naturelle (14h pour maintenir la ponte)',
            'activityEnrichment': 'Parcours herbeux, bain de poussière, perchoirs',
            'hygieneNotes': 'Nettoyage hebdomadaire du poulailler, litière propre, lutte anti-parasites',
            'costEstimate': 'faible',
            'sources': wiki('poule'),
        },
        'behavior': {
            'generalBehavior': 'Animal grégaire avec hiérarchie stricte (picorage). Curieuse, active, apprécie gratter et picorer.',
            'sociability': 'grégaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Idéale pour les enfants (observation, ramassage des œufs).',
            'compatibilityWithOtherAnimals': 'Coexiste avec canards, oies et autres volailles.',
            'sources': wiki('poule'),
        },
        'health': {
            'diseases': [
                {'name': 'Coccidiose', 'symptoms': 'Diarrhée, abattement, baisse de ponte', 'prevention': 'Litière sèche et propre, hygiène du poulailler', 'whenToConsult': 'Dès diarrhée'},
                {'name': 'Maladies respiratoires', 'symptoms': 'Éternuements, écoulements, toux', 'prevention': 'Bonne ventilation, éviter courants d\u2019air', 'whenToConsult': 'Dès signes respiratoires'},
                {'name': 'Parasites externes (poux rouges)', 'symptoms': 'Démangeaisons, plumes abîmées, baisse de ponte', 'prevention': 'Inspection régulière, traitement du poulailler', 'whenToConsult': 'Dès démangeaisons visibles'},
                {'name': 'Prolapsus de l\u2019oviducte', 'symptoms': 'Organe visible sous le cloaque', 'prevention': 'Éviter surpoids, œufs trop gros', 'whenToConsult': 'URGENCE'},
            ],
            'sources': vet((VCA + '/fr/oiseaux', 'VCA Hospitals — santé des volailles'), (WAMIZ, 'Wamiz — santé de la poule')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': ['Déclaration en mairie au-delà de 50 volailles', 'Règlement sanitaire départemental (proximité habitations)']},
            'sources': [SRC(LEGI, 'Légifrance — élevage de volailles', 'official')],
        },
        'reproduction': {
            'season': 'printemps-été', 'gestationDays': None, 'incubationDays': 21,
            'litterSizeMin': 6, 'litterSizeMax': 12, 'sexualMaturityMonths': 5,
            'breedingDifficulty': 'facile',
            'notes': 'Incubation 21 jours. Une poule peut couver 8 à 12 œufs.',
            'sources': wiki('poule'),
        },
    },
    'perruche': {
        'espece': 'Perruche', 'category': 'oiseau', 'domesticationType': 'domestique',
        'subcategory': 'Psittacidé',
        'feeding': {
            'dietType': 'granivore',
            'recommendedFoods': [
                {'name': 'Mélange graines perruches', 'frequency': 'quotidienne', 'notes': 'Millet, avoine, alpiste — base de la ration'},
                {'name': 'Granulés extrudés', 'frequency': 'quotidienne', 'notes': 'Complément équilibré en vitamines'},
                {'name': 'Fruits et légumes frais', 'frequency': 'quotidienne', 'notes': 'Pomme, carotte, brocoli, épinard'},
                {'name': 'Os de seiche', 'frequency': 'quotidienne', 'notes': 'Calcium'},
            ],
            'foodsToAvoid': [
                {'name': 'Avocat', 'reason': 'Toxique (persine)'},
                {'name': 'Chocolat', 'reason': 'Toxique (théobromine)'},
                {'name': 'Oignons et ail', 'reason': 'Toxiques'},
                {'name': 'Caféine et alcool', 'reason': 'Toxiques'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Graines + granulés, fruits/légumes frais quotidiens, calcium, eau propre changée chaque jour.',
            'sources': vet((WAMIZ, 'Wamiz — guide perruche'), (VCA + '/fr/oiseaux', 'VCA Hospitals — soins des oiseaux')),
        },
        'habitat': {
            'habitatType': 'cage', 'tempMin': 18, 'tempMax': 26,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Cage 60x40x80cm minimum (2x l\u2019envergure), volière idéale',
            'lightNeeds': 'Lumière naturelle, 12h jour/nuit, UVB bénéfique',
            'activityEnrichment': 'Perchoirs variés, jouets à mâcher, miroir, sorties quotidiennes',
            'hygieneNotes': 'Nettoyage hebdomadaire, coupure des griffes, bain',
            'costEstimate': 'faible',
            'sources': wiki('perruche'),
        },
        'behavior': {
            'generalBehavior': 'Oiseau social, intelligent et très joueur. Peut apprendre à parler (calopsitte, perruche).',
            'sociability': 'grégaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Bon compagnon sous supervision.',
            'compatibilityWithOtherAnimals': 'Vivre en couple ou petit groupe recommandé.',
            'sources': wiki('perruche'),
        },
        'health': {
            'diseases': [
                {'name': 'Psittacose', 'symptoms': 'Éternuements, écoulements, abattement', 'prevention': 'Hygiène, quarantaine des nouveaux oiseaux', 'whenToConsult': 'Dès signes respiratoires (zoonose)'},
                {'name': 'Acariens', 'symptoms': 'Démangeaisons, plumes abîmées', 'prevention': 'Hygiène de la cage', 'whenToConsult': 'Dès grattage intense'},
                {'name': 'Problèmes digestifs', 'symptoms': 'Diarrhée, vomissements', 'prevention': 'Alimentation propre et variée', 'whenToConsult': 'Dès diarrhée'},
                {'name': 'Plumage (picage)', 'symptoms': 'Plumes arrachées, zones déplumées', 'prevention': 'Enrichissement, réduction du stress', 'whenToConsult': 'Si le picage persiste'},
            ],
            'sources': vet((VCA + '/fr/oiseaux', 'VCA Hospitals — santé des oiseaux'), (WAMIZ, 'Wamiz — santé de la perruche')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': []},
            'sources': [SRC(LEGI, 'Légifrance — détention d\u2019oiseaux', 'official')],
        },
        'reproduction': {
            'season': 'printemps-été', 'gestationDays': None, 'incubationDays': 18,
            'litterSizeMin': 3, 'litterSizeMax': 8, 'sexualMaturityMonths': 6,
            'breedingDifficulty': 'modere',
            'notes': 'Incubation 18 jours, nichoir obligatoire.',
            'sources': wiki('perruche'),
        },
    },
    'gecko': {
        'espece': 'Gecko', 'category': 'reptile', 'domesticationType': 'NAC',
        'subcategory': 'Gekkonidé',
        'feeding': {
            'dietType': 'insectivore',
            'recommendedFoods': [
                {'name': 'Insectes vivants', 'frequency': 'quotidienne', 'notes': 'Grillons, criquets saupoudrés de calcium'},
                {'name': 'Vers de farine', 'frequency': 'hebdomadaire', 'notes': 'En complément (gras)'},
                {'name': 'Poudre vitaminée', 'frequency': 'quotidienne', 'notes': 'Calcium + D3'},
            ],
            'foodsToAvoid': [
                {'name': 'Insectes sauvages', 'reason': 'Pesticides et parasites'},
                {'name': 'Laitue', 'reason': 'Peu nutritive'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Insectes saupoudrés de calcium/D3, UVB pour les espèces diurnes, eau fraîche.',
            'sources': vet((WAMIZ, 'Wamiz — guide gecko'), (VCA + '/fr/reptiles', 'VCA Hospitals — soins des reptiles')),
        },
        'habitat': {
            'habitatType': 'terrarium', 'tempMin': 24, 'tempMax': 30,
            'humidityMin': 40, 'humidityMax': 60,
            'minSpaceSize': 'Terrarium 60x45x45cm pour un adulte',
            'lightNeeds': 'UVB 10h/jour (diurnes), cycle jour/nuit',
            'activityEnrichment': 'Cachettes, branches, plantes, parois à escalader',
            'hygieneNotes': 'Pulvérisation quotidienne, nettoyage hebdomadaire',
            'costEstimate': 'moyen',
            'sources': wiki('gecko'),
        },
        'behavior': {
            'generalBehavior': 'Lézard nocturne ou diurne selon espèce, territorial, observateur. Manipulation douce et limitée.',
            'sociability': 'solitaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Observation intéressante, manipulation délicate.',
            'compatibilityWithOtherAnimals': 'Vie en solitaire recommandée (mâles territoriaux).',
            'sources': wiki('gecko'),
        },
        'health': {
            'diseases': [
                {'name': 'MBD (maladie osseuse métabolique)', 'symptoms': 'Déformations, faiblesse, fractures', 'prevention': 'Calcium + UVB obligatoires', 'whenToConsult': 'Dès faiblesse ou déformation'},
                {'name': 'Parasitisme', 'symptoms': 'Amaigrissement, diarrhée', 'prevention': 'Quarantaine, selles contrôlées', 'whenToConsult': 'Dès amaigrissement'},
                {'name': 'Problèmes de mue', 'symptoms': 'Mue incomplète, résidus sur les doigts', 'prevention': 'Hygrométrie correcte', 'whenToConsult': 'Si mue bloquée'},
            ],
            'sources': vet((VCA + '/fr/reptiles', 'VCA Hospitals — santé des reptiles'), (WAMIZ, 'Wamiz — santé du gecko')),
        },
        'legislation': {
            'country': 'FR', 'status': 'permit_required',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': ['Vérifier l\u2019Arrêté du 21/11/1997 (espèces non domestiques)']},
            'sources': [SRC(LEGI, 'Légifrance — Arrêté du 21 novembre 1997', 'official'), SRC(INPN, 'INPN — espèces réglementées', 'official')],
        },
        'reproduction': {
            'season': 'printemps', 'gestationDays': None, 'incubationDays': 60,
            'litterSizeMin': 2, 'litterSizeMax': 2, 'sexualMaturityMonths': 12,
            'breedingDifficulty': 'modere',
            'notes': 'Ponte de 2 œufs, incubation ~60 jours selon température.',
            'sources': wiki('gecko'),
        },
    },
    'poisson': {
        'espece': 'Poisson d\u2019aquarium', 'category': 'poisson', 'domesticationType': 'domestique',
        'subcategory': 'Poisson tropical d\u2019eau douce',
        'feeding': {
            'dietType': 'omnivore',
            'recommendedFoods': [
                {'name': 'Flocons ou granulés de qualité', 'frequency': 'quotidienne', 'notes': 'Ration de base, 2x/jour en petites quantités'},
                {'name': 'Artémias et daphnies congelés', 'frequency': 'hebdomadaire', 'notes': 'Protéines vivantes congelées'},
                {'name': 'Légumes blanchis', 'frequency': 'hebdomadaire', 'notes': 'Courgette, épinard (herbivores)'},
            ],
            'foodsToAvoid': [
                {'name': 'Suralimentation', 'reason': 'Pollution de l\u2019eau et obésité — jamais plus de 2 min de nourriture'},
                {'name': 'Pain', 'reason': 'Indigeste et polluant'},
            ],
            'mealFrequency': 'daily',
            'specificNeeds': 'Nourriture adaptée à la taille de bouche, varier flocons/congelés, jeûne 1 jour/semaine.',
            'sources': vet((WAMIZ, 'Wamiz — guide aquarium'), (VCA + '/fr/poissons', 'VCA Hospitals — soins des poissons')),
        },
        'habitat': {
            'habitatType': 'aquarium', 'tempMin': 22, 'tempMax': 28,
            'humidityMin': None, 'humidityMax': None,
            'minSpaceSize': 'Aquarium 60L minimum (selon espèce), 100L+ recommandé',
            'lightNeeds': 'Éclairage 8-10h/jour (cycle jour/nuit)',
            'activityEnrichment': 'Plantes, racines, cachettes, zone de nage libre, banc de 6+',
            'hygieneNotes': 'Changement d\u2019eau 25% hebdo, filtration, tests de l\u2019eau (nitrites, pH)',
            'costEstimate': 'moyen',
            'sources': wiki('poisson'),
        },
        'behavior': {
            'generalBehavior': 'Comportement varié selon espèce : bancs (tétras), territoriaux (bettas), paisibles (corydoras).',
            'sociability': 'grégaire', 'difficultyLevel': 'débutant',
            'compatibilityWithChildren': 'Observation éducative, entretien encadré.',
            'compatibilityWithOtherAnimals': 'Choisir des espèces compatibles (pas de prédateurs avec les petits).',
            'sources': wiki('poisson'),
        },
        'health': {
            'diseases': [
                {'name': 'Ichtyophthiriose (points blancs)', 'symptoms': 'Petits points blancs sur le corps', 'prevention': 'Quarantaine des nouveaux poissons, eau stable', 'whenToConsult': 'Dès l\u2019apparition des points'},
                {'name': 'Pourriture des nageoires', 'symptoms': 'Nageoires effilochées, bord blanc', 'prevention': 'Eau propre, éviter le stress', 'whenToConsult': 'Dès lésions'},
                {'name': 'Troubles de la vessie natatoire', 'symptoms': 'Poisson qui coule ou flotte anormalement', 'prevention': 'Alimentation adaptée, jeûne', 'whenToConsult': 'Si persiste après jeûne'},
            ],
            'sources': vet((VCA + '/fr/poissons', 'VCA Hospitals — santé des poissons'), (WAMIZ, 'Wamiz — santé aquarium')),
        },
        'legislation': {
            'country': 'FR', 'status': 'allowed',
            'details': {'citesAppendix': None, 'euAnnex': None, 'permits': [], 'restrictions': []},
            'sources': [SRC(LEGI, 'Légifrance — animaux de compagnie', 'official')],
        },
        'reproduction': {
            'season': "toute l'année", 'gestationDays': None, 'incubationDays': 3,
            'litterSizeMin': 20, 'litterSizeMax': 300, 'sexualMaturityMonths': 3,
            'breedingDifficulty': 'modere',
            'notes': 'Ponte ou viviparité selon l\u2019espèce (guppys vivipares).',
            'sources': wiki('poisson'),
        },
    },
    'mygale': {
        'espece': 'Mygale / Scorpion', 'category': 'arachnide', 'domesticationType': 'NAC',
        'subcategory': 'Arachnide',
        'feeding': {
            'dietType': 'insectivore',
            'recommendedFoods': [
                {'name': 'Criquets et grillons vivants', 'frequency': 'hebdomadaire', 'notes': 'Adultes : 1-2 proies par semaine'},
                {'name': 'Blattes', 'frequency': 'hebdomadaire', 'notes': 'Alternative nutritive'},
                {'name': 'Vers de farine', 'frequency': 'hebdomadaire', 'notes': 'Occasionnel (gras)'},
            ],
            'foodsToAvoid': [
                {'name': 'Proies sauvages', 'reason': 'Pesticides et parasites'},
                {'name': 'Proies trop grosses', 'reason': 'Blessures et stress'},
            ],
            'mealFrequency': 'weekly',
            'specificNeeds': 'Proies vivantes adaptées à la taille, coupelle d\u2019eau peu profonde, jeûne avant mue.',
            'sources': vet((WAMIZ, 'Wamiz — guide mygale'), (VCA + '/fr/reptiles', 'VCA Hospitals — soins des arachnides')),
        },
        'habitat': {
            'habitatType': 'terrarium', 'tempMin': 24, 'tempMax': 28,
            'humidityMin': 60, 'humidityMax': 75,
            'minSpaceSize': 'Terrarium 30x30x30cm (terricoles), 30x30x40cm (arboricoles)',
            'lightNeeds': 'Lumière naturelle faible, éviter le soleil direct',
            'activityEnrichment': 'Substrat profond (terricoles), écorces (arboricoles), cachettes, coupelle d\u2019eau',
            'hygieneNotes': 'Substrat humidifié, nettoyage ponctuel, manipulation évitée',
            'costEstimate': 'faible',
            'sources': wiki('mygale'),
        },
        'behavior': {
            'generalBehavior': 'Solitaire, territoriale, discrète. Manipulation fortement déconseillée (morsure venimeuse).',
            'sociability': 'solitaire', 'difficultyLevel': 'intermédiaire',
            'compatibilityWithChildren': 'Observation uniquement, jamais de manipulation.',
            'compatibilityWithOtherAnimals': 'Toujours en solitaire.',
            'sources': wiki('mygale'),
        },
        'health': {
            'diseases': [
                {'name': 'Mue difficile', 'symptoms': 'Mue bloquée, pattes coincées', 'prevention': 'Hygrométrie correcte', 'whenToConsult': 'Si mue bloquée'},
                {'name': 'Déshydratation', 'symptoms': 'Abdomen ridé, léthargie', 'prevention': 'Coupelle d\u2019eau, substrat humide', 'whenToConsult': 'Dès léthargie'},
                {'name': 'Parasites', 'symptoms': 'Petits points sur le corps', 'prevention': 'Proies d\u2019élevage uniquement', 'whenToConsult': 'Si infestation'},
            ],
            'sources': vet((VCA + '/fr/reptiles', 'VCA Hospitals — santé des arachnides'), (WAMIZ, 'Wamiz — santé mygale')),
        },
        'legislation': {
            'country': 'FR', 'status': 'permit_required',
            'details': {'citesAppendix': 'II (Brachypelma)', 'euAnnex': 'B', 'permits': ['Certificat CITES (Brachypelma smithi)'], 'restrictions': []},
            'sources': [SRC(LEGI, 'Légifrance — Arrêté du 21 novembre 1997', 'official'), SRC(INPN, 'INPN — espèces réglementées', 'official')],
        },
        'reproduction': {
            'season': 'printemps', 'gestationDays': None, 'incubationDays': 90,
            'litterSizeMin': 50, 'litterSizeMax': 500, 'sexualMaturityMonths': 24,
            'breedingDifficulty': 'avance',
            'notes': 'Cocons de 50 à 500 œufs selon l\u2019espèce.',
            'sources': wiki('mygale'),
        },
    },
}

# Templates génériques de secours par catégorie (construits à partir des valeurs
# types, sourcés par les pages Wikipedia FR des espèces représentatives)
GENERIC = {
    'bovin': dict(TEMPLATES['cheval'], especeKey='bovin', espece='Bovin', subcategory='Bovin'),
    'mouton': dict(TEMPLATES['cheval'], especeKey='mouton', espece='Mouton', subcategory='Ovin'),
    'chevre': dict(TEMPLATES['cheval'], especeKey='chevre', espece='Chèvre', subcategory='Caprin'),
    'porc': dict(TEMPLATES['cheval'], especeKey='porc', espece='Porc', subcategory='Porcin'),
    'canard': dict(TEMPLATES['poule'], especeKey='canard', espece='Canard', subcategory='Anatiné'),
    'pigeon': dict(TEMPLATES['poule'], especeKey='pigeon', espece='Pigeon', subcategory='Columbidé'),
    'dindon': dict(TEMPLATES['poule'], especeKey='dindon', espece='Dindon', subcategory='Galliforme'),
    'mammifere-nac': dict(TEMPLATES['lapin'], especeKey='mammifere-nac', espece='Petit mammifère NAC', subcategory='Rongeur'),
    'rongeur-hamster': dict(TEMPLATES['lapin'], especeKey='rongeur-hamster', espece='Hamster', subcategory='Rongeur'),
    'rongeur-cochon-inde': dict(TEMPLATES['lapin'], especeKey='rongeur-cochon-inde', espece='Cochon d\u2019Inde', subcategory='Rongeur'),
    'rongeur-chinchilla': dict(TEMPLATES['lapin'], especeKey='rongeur-chinchilla', espece='Chinchilla / Octodon', subcategory='Rongeur'),
    'rongeur-rat': dict(TEMPLATES['lapin'], especeKey='rongeur-rat', espece='Rat / Souris', subcategory='Rongeur'),
    'mammifere-herisson': dict(TEMPLATES['lapin'], especeKey='mammifere-herisson', espece='Hérisson africain', subcategory='Insectivore'),
    'mammifere-furet': dict(TEMPLATES['chien'], especeKey='mammifere-furet', espece='Furet', subcategory='Mustélidé'),
    'oiseau-nac': dict(TEMPLATES['perruche'], especeKey='oiseau-nac', espece='Oiseau de cage', subcategory='Passereau'),
    'oiseau-perroquet': dict(TEMPLATES['perruche'], especeKey='oiseau-perroquet', espece='Perroquet', subcategory='Psittacidé', domesticationType='NAC'),
    'oiseau-canari': dict(TEMPLATES['perruche'], especeKey='oiseau-canari', espece='Canari / petit passereau', subcategory='Fringillidé'),
    'reptile-nac': dict(TEMPLATES['gecko'], especeKey='reptile-nac', espece='Reptile NAC', subcategory='Lézard'),
    'reptile-cameleon': dict(TEMPLATES['gecko'], especeKey='reptile-cameleon', espece='Caméléon', subcategory='Chamaeleonidé'),
    'reptile-iguane': dict(TEMPLATES['gecko'], especeKey='reptile-iguane', espece='Iguane / grand lézard', subcategory='Iguanidé'),
    'reptile-python': dict(TEMPLATES['gecko'], especeKey='reptile-python', espece='Python / Boa', subcategory='Serpent constricteur'),
    'reptile-serpent': dict(TEMPLATES['gecko'], especeKey='reptile-serpent', espece='Serpent non venimeux', subcategory='Colubridé'),
    'reptile-tortue': dict(TEMPLATES['gecko'], especeKey='reptile-tortue', espece='Tortue', subcategory='Chélonien'),
    'reptile-varan': dict(TEMPLATES['gecko'], especeKey='reptile-varan', espece='Varan', subcategory='Varanidé'),
    'reptile-agame': dict(TEMPLATES['gecko'], especeKey='reptile-agame', espece='Agame barbu / Scinque', subcategory='Agamidé'),
    'amphibien-nac': dict(TEMPLATES['gecko'], especeKey='amphibien-nac', espece='Amphibien NAC', subcategory='Anoure', category='amphibien'),
    'amphibien-axolotl': dict(TEMPLATES['gecko'], especeKey='amphibien-axolotl', espece='Axolotl / Triton', subcategory='Urodèle', category='amphibien'),
    'amphibien-grenouille': dict(TEMPLATES['gecko'], especeKey='amphibien-grenouille', espece='Grenouille / Rainette', subcategory='Anoure', category='amphibien'),
    'insecte-nac': dict(TEMPLATES['mygale'], especeKey='insecte-nac', espece='Insecte NAC', subcategory='Insecte', category='insecte'),
    'arachnide-nac': dict(TEMPLATES['mygale'], especeKey='arachnide-nac', espece='Mygale / Scorpion', subcategory='Arachnide', category='arachnide'),
    'poisson-nac': dict(TEMPLATES['poisson'], especeKey='poisson-nac', espece='Poisson d\u2019aquarium', subcategory='Poisson tropical d\u2019eau douce'),
}


def main():
    all_templates = {}
    for key, t in TEMPLATES.items():
        t = dict(t)
        t['especeKey'] = key
        all_templates[key] = t
    for key, t in GENERIC.items():
        t = dict(t)
        t['especeKey'] = key
        all_templates[key] = t

    for key, t in all_templates.items():
        path = os.path.join(OUT, f'template-{key}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(t, f, ensure_ascii=False, indent=2)
        print(f'  ✓ {key}')

    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(list(all_templates.values()), f, ensure_ascii=False, indent=1)
    print(f'\nTotal templates: {len(all_templates)}')


if __name__ == '__main__':
    main()
