/**
 * Correspondance éditoriale entre taxons exacts et photos déjà vérifiées dans `photos.ts`.
 * Les races partagent souvent un nom latin : elles ne reçoivent une photo que si leur nom
 * vernaculaire identifie exactement la race photographiée.
 */
import { PHOTOS, photoSources, type PhotoKey } from './photos';
import type { SpeciesPhoto } from '@/lib/species';

type CuratedTaxon = { latin: string; names: readonly string[]; photo: PhotoKey; nameMayBeMissing?: boolean };
type RemoteCuratedTaxon = {
  latin: string;
  names: readonly string[];
  photo: PhotoKey;
};

const TAXA: readonly CuratedTaxon[] = [
  { latin: 'Canis familiaris', names: ['chien', 'chien domestique'], photo: 'dogRiver', nameMayBeMissing: true },
  { latin: 'Canis lupus familiaris', names: ['golden retriever'], photo: 'dogGoldenRetriever' },
  { latin: 'Felis catus', names: ['chat domestique'], photo: 'catStraw', nameMayBeMissing: true },
  { latin: 'Oryctolagus cuniculus', names: ['lapin de garenne', 'lapin domestique'], photo: 'rabbitStraw', nameMayBeMissing: true },
  { latin: 'Nymphicus hollandicus', names: ['perruche calopsite', 'perruche calopsitte'], photo: 'cockatiels' },
  { latin: 'Melopsittacus undulatus', names: ['perruche ondulée'], photo: 'budgerigars' },
  { latin: 'Eublepharis macularius', names: ['gecko léopard'], photo: 'leopardGecko' },
  { latin: 'Pogona vitticeps', names: ['agame barbu', 'dragon barbu'], photo: 'beardedDragon' },
  { latin: 'Paracheirodon innesi', names: ['néon bleu (tétra néon)', 'tétra néon'], photo: 'neonTetra' },
  { latin: 'Equus caballus', names: ['cheval domestique'], photo: 'horse' },
  { latin: 'Gallus gallus domesticus', names: ['poule domestique'], photo: 'hen' },
  { latin: 'Cavia porcellus', names: ['cochon d\'inde'], photo: 'guineaPig' },
  { latin: 'Mesocricetus auratus', names: ['hamster doré'], photo: 'syrianHamster' },
  { latin: 'Mustela putorius furo', names: ['furet', 'furet domestique'], photo: 'ferret' },
  { latin: 'Chinchilla lanigera', names: ['chinchilla'], photo: 'chinchilla' },
  { latin: 'Mus musculus domesticus', names: ['souris blanche domestique'], photo: 'domesticMouse' },
  { latin: 'Rattus norvegicus domesticus', names: ['rat domestique'], photo: 'domesticRat' },
  { latin: 'Serinus canaria domesticus', names: ['canari'], photo: 'canary' },
  { latin: 'Psittacus erithacus', names: ['perroquet gris d\'afrique', 'perroquet gris du gabon'], photo: 'africanGrey' },
  { latin: 'Boa constrictor', names: ['boa constricteur', 'boa constrictor'], photo: 'boaConstrictor' },
  { latin: 'Python regius', names: ['python royal'], photo: 'ballPython' },
  { latin: 'Iguana iguana', names: ['iguane vert'], photo: 'greenIguana' },
  { latin: 'Trachemys scripta elegans', names: ['tortue à oreilles rouges'], photo: 'redEaredSlider' },
  { latin: 'Chamaeleo calyptratus', names: ['caméléon casqué'], photo: 'veiledChameleon' },
  { latin: 'Ambystoma mexicanum', names: ['axolotl'], photo: 'axolotl' },
  { latin: 'Carassius auratus', names: ['poisson rouge'], photo: 'goldfish' },
  { latin: 'Betta splendens', names: ['combattant (betta)', 'poisson combattant (betta)'], photo: 'betta' },
  { latin: 'Poecilia reticulata', names: ['guppy'], photo: 'guppy' },
  { latin: 'Carausius morosus', names: ['phasme bâton'], photo: 'stickInsect' },
  { latin: 'Gromphadorhina portentosa', names: ['blatte de madagascar'], photo: 'hissingCockroach' },
  { latin: 'Pandinus imperator', names: ['scorpion empereur'], photo: 'emperorScorpion' },
  { latin: 'Lithobates catesbeianus', names: ['grenouille taureau'], photo: 'bullfrog' },
  { latin: 'Phodopus sungorus', names: ['hamster russe'], photo: 'russianHamster' },
  { latin: 'Phodopus campbelli', names: ['hamster de campbell'], photo: 'campbellHamster' },
  { latin: 'Phodopus roborovskii', names: ['hamster roborovski'], photo: 'roborovskiHamster' },
  { latin: 'Correlophus ciliatus', names: ['gecko à crête'], photo: 'crestedGecko' },
  { latin: 'Furcifer pardalis', names: ['caméléon panthère'], photo: 'pantherChameleon' },
  { latin: 'Testudo hermanni', names: ['tortue hermann', 'tortue d\'hermann'], photo: 'hermannTortoise' },
  { latin: 'Psittacula krameri', names: ['perruche à collier'], photo: 'ringNeckedParakeet' },
  { latin: 'Agapornis fischeri', names: ['inséparable fischer', 'inséparable de fischer'], photo: 'fischerLovebird' },
  // Le catalogue nomme aussi cette espèce par son binôme : la normalisation retire ce doublon.
  { latin: 'Ara ararauna', names: ['ara ararauna'], photo: 'blueYellowMacaw', nameMayBeMissing: true },
  { latin: 'Pterophyllum scalare', names: ['scalaire'], photo: 'angelfish' },
  { latin: 'Danio rerio', names: ['danio zébré'], photo: 'zebrafish' },
  { latin: 'Mikrogeophagus ramirezi', names: ['cichlidé de ramirezi', 'ramirezi'], photo: 'ramirezi' },
  { latin: 'Agalychnis callidryas', names: ['rainette aux yeux rouges'], photo: 'redEyedTreeFrog' },
  { latin: 'Dendrobates tinctorius', names: ['dendrobate', 'dendrobate à tapirer'], photo: 'dyeingPoisonFrog' },
  { latin: 'Neocaridina davidi', names: ['crevette red cherry'], photo: 'cherryShrimp' },
  { latin: 'Caridina multidentata', names: ['crevette amano'], photo: 'amanoShrimp' },
  { latin: 'Ovis aries', names: ['mouton'], photo: 'sheep' },
  { latin: 'Equus asinus', names: ['âne'], photo: 'donkey' },
  { latin: 'Atelerix albiventris', names: ['hérisson africain'], photo: 'africanHedgehog' },
];

/**
 * Autres taxons exacts vérifiés visuellement sur leur page de fichier Wikimedia Commons.
 * Les photos sont hébergées localement ; chaque entrée conserve le crédit et la licence
 * explicite de la page source.
 */
const REMOTE_TAXA: readonly RemoteCuratedTaxon[] = [
  {
    latin: 'Brachypelma smithi', names: ['tarentule mexicaine à genoux rouges'],
    photo: 'tarantulaMexicanRedKnee',
  },
  {
    latin: 'Testudo graeca', names: ['tortue grecque'],
    photo: 'greekTortoise',
  },
  {
    latin: 'Testudo marginata', names: ['tortue bordée'],
    photo: 'marginatedTortoise',
  },
  {
    latin: 'Pantherophis guttatus', names: ['serpent des blés'],
    photo: 'cornSnake',
  },
  {
    latin: 'Lampropeltis getula', names: ['couleuvre royale'],
    photo: 'kingSnake',
  },
  {
    latin: 'Varanus exanthematicus', names: ['varan des steppes'],
    photo: 'savannahMonitor',
  },
  {
    latin: 'Corydoras panda', names: ['corydoras panda'],
    photo: 'pandaCorydoras',
  },
  {
    latin: 'Corydoras aeneus', names: ['corydoras bronze'],
    photo: 'bronzeCorydoras',
  },
  {
    latin: 'Xiphophorus maculatus', names: ['platy'],
    photo: 'platy',
  },
  {
    latin: 'Bombina orientalis', names: ['crapaud à ventre de feu'],
    photo: 'orientalFireBelliedToad',
  },
  {
    latin: 'Hymenopus coronatus', names: ['mante orchidée'],
    photo: 'orchidMantis',
  },
  { latin: 'Brachypelma albopilosum', names: ['tarentule du curacao'], photo: 'curlyHairTarantula' },
  { latin: 'Agapornis roseicollis', names: ['inséparable rosâtre'], photo: 'rosyFacedLovebird' },
  { latin: 'Taeniopygia guttata', names: ['diamant mandarin'], photo: 'zebraFinch' },
  { latin: 'Poecilia sphenops', names: ['molly noire'], photo: 'blackMolly' },
  { latin: 'Hyla cinerea', names: ['rainette arboricole verte'], photo: 'greenTreefrog' },
  { latin: 'Meriones unguiculatus', names: ['gerbille'], photo: 'mongolianGerbil' },
  { latin: 'Octodon degus', names: ['dègue du chili'], photo: 'chileanDegu' },
  { latin: 'Amazona aestiva', names: ['amazone à front bleu'], photo: 'blueFrontedAmazon' },
  { latin: 'Amazona albifrons', names: ['amazone à front blanc'], photo: 'whiteFrontedAmazon' },
  { latin: 'Cacatua alba', names: ['cacatoès blanc'], photo: 'whiteCockatoo' },
  { latin: 'Phelsuma grandis', names: ['gecko géant de madagascar'], photo: 'madagascarGiantDayGecko' },
  { latin: 'Litoria caerulea', names: ['rainette de white'], photo: 'whitesTreeFrog' },
  { latin: 'Hydrochoerus hydrochaeris', names: ['capybara'], photo: 'capybara' },
  { latin: 'Gekko gecko', names: ['gecko tokay'], photo: 'tokayGecko' },
  { latin: 'Suricata suricatta', names: ['suricate'], photo: 'meerkat' },
  { latin: 'Eclectus roratus', names: ['éclectus'], photo: 'eclectus' },
  { latin: 'Dromaius novaehollandiae', names: ['émeu'], photo: 'emu' },
  { latin: 'Pavo cristatus', names: ['paon bleu'], photo: 'bluePeafowl' },
  { latin: 'Chrysolophus pictus', names: ['faisan doré'], photo: 'goldenPheasant' },
  { latin: 'Chloebia gouldiae', names: ['gouldien'], photo: 'gouldianFinch' },
  { latin: 'Ceratophrys ornata', names: ['grenouille cornue'], photo: 'ornateHornedFrog' },
  { latin: 'Andrias japonicus', names: ['salamandre géante du japon'], photo: 'japaneseGiantSalamander' },
  { latin: 'Phyllium philippinicum', names: ['phasme feuille'], photo: 'leafInsect' },
  { latin: 'Achatina fulica', names: ['escargot géant africain'], photo: 'giantAfricanSnail' },
  { latin: 'Archispirostreptus gigas', names: ['mille-pattes géant'], photo: 'giantMillipede' },
  { latin: 'Salamandra salamandra', names: ['salamandre tachetée'], photo: 'fireSalamander' },
  { latin: 'Dyscophus antongilii', names: ['grenouille tomate'], photo: 'tomatoFrog' },
  { latin: 'Dendrobates leucomelas', names: ['dendrobate lépreux'], photo: 'bumblebeePoisonFrog' },
  { latin: 'Ceratophrys cranwelli', names: ['grenouille cornue de cranwell'], photo: 'cranwellsHornedFrog' },
  { latin: 'Phelsuma madagascariensis', names: ['gecko diurne de madagascar'], photo: 'phelsumaMadagascar' },
  { latin: 'Uroplatus phantasticus', names: ['gecko satanique'], photo: 'satanicLeafTailedGecko' },
  { latin: 'Iguana delicatissima', names: ['iguane des petites antilles'], photo: 'antillesIguana' },
  { latin: 'Anolis carolinensis', names: ['anole vert'], photo: 'greenAnole' },
  { latin: 'Anolis equestris', names: ['anole de cuba'], photo: 'knightAnole' },
  { latin: 'Basiliscus plumifrons', names: ['basilic vert'], photo: 'greenBasilisk' },
  { latin: 'Trioceros jacksonii', names: ['caméléon de jackson'], photo: 'jacksonsChameleon' },
  { latin: 'Calumma parsonii', names: ['caméléon de parson'], photo: 'parsonsChameleon' },
  { latin: 'Varanus komodoensis', names: ['varan de komodo'], photo: 'komodoDragon' },
  { latin: 'Salvator merianae', names: ['téju noir et blanc'], photo: 'argentineTegu' },
  { latin: 'Chlamydosaurus kingii', names: ['lézard à collerette'], photo: 'frillNeckedLizard' },
  { latin: 'Timon lepidus', names: ['lézard ocellé'], photo: 'ocellatedLizard' },
  { latin: 'Corallus caninus', names: ['boa émeraude'], photo: 'emeraldTreeBoa' },
  { latin: 'Lampropeltis triangulum', names: ['couleuvre faux-corail'], photo: 'milkSnake' },
  { latin: 'Heterodon nasicus', names: ['couleuvre à nez plat'], photo: 'hognoseSnake' },
  { latin: 'Hyphessobrycon herbertaxelrodi', names: ['néon noir'], photo: 'blackNeonTetra' },
  { latin: 'Hyphessobrycon pulchripinnis', names: ['tétra citron'], photo: 'lemonTetra' },
  { latin: 'Nematobrycon palmeri', names: ['tétra empereur'], photo: 'emperorTetra' },
  { latin: 'Phenacogrammus interruptus', names: ['tétra du congo'], photo: 'congoTetra' },
  { latin: 'Hyphessobrycon megalopterus', names: ['tétra fantôme noir'], photo: 'blackPhantomTetra' },
  { latin: 'Astronotus ocellatus', names: ['oscar'], photo: 'oscarCichlid' },
  { latin: 'Rocio octofasciata', names: ['cichlidé de jack dempsey'], photo: 'jackDempseyCichlid' },
  { latin: 'Amphilophus citrinellus', names: ['cichlidé perroquet'], photo: 'parrotCichlid' },
  { latin: 'Cyphotilapia frontosa', names: ['cichlidé frontosa'], photo: 'frontosaCichlid' },
  { latin: 'Metriaclima zebra', names: ['cichlidé zèbre'], photo: 'zebraCichlid' },
  { latin: 'Labidochromis caeruleus', names: ['cichlidé jaune'], photo: 'yellowLabCichlid' },
  { latin: 'Puntius titteya', names: ['barbu cerise'], photo: 'cherryBarb' },
  { latin: 'Puntigrus tetrazona', names: ['barbu de sumatra'], photo: 'tigerBarb' },
  { latin: 'Aonyx cinereus', names: ['loutre naine asiatique'], photo: 'smallClawedOtter' },
  { latin: 'Neovison vison', names: ['vison américain'], photo: 'americanMink' },
  { latin: 'Lagidium viscacia', names: ['viscache des andes'], photo: 'vizcacha' },
  { latin: 'Monodelphis domestica', names: ['opossum pygmée'], photo: 'pygmyOpossum' },
  { latin: 'Micromys minutus', names: ['souris des moissons'], photo: 'harvestMouse' },
  { latin: 'Callithrix jacchus', names: ['ouistiti'], photo: 'commonMarmoset' },
  { latin: 'Dasyprocta leporina', names: ['agouti'], photo: 'agouti' },
  { latin: 'Dolichotis patagonum', names: ['mara'], photo: 'mara' },
  { latin: 'Diopsittaca nobilis', names: ['ara noble'], photo: 'redShoulderedMacaw' },
  { latin: 'Pyrrhura molinae', names: ['conure à joues vertes'], photo: 'greenCheekedConure' },
  { latin: 'Aratinga solstitialis', names: ['conure soleil'], photo: 'sunConure' },
  { latin: 'Eolophus roseicapilla', names: ['cacatoès rosalbin'], photo: 'galah' },
  { latin: 'Lonchura oryzivora', names: ['padda de java'], photo: 'javaSparrow' },
  { latin: 'Cardinalis cardinalis', names: ['cardinal rouge'], photo: 'northernCardinal' },
  { latin: 'Aix galericulata', names: ['canard mandarin'], photo: 'mandarinDuck' },
  { latin: 'Sciurus vulgaris', names: ['écureuil roux européen'], photo: 'redSquirrel' },
  { latin: 'Procyon lotor', names: ['raton laveur'], photo: 'raccoon' },
  { latin: 'Nasua nasua', names: ['coati'], photo: 'coati' },
  { latin: 'Leptailurus serval', names: ['serval'], photo: 'serval' },
  { latin: 'Genetta genetta', names: ['genette'], photo: 'genet' },
  { latin: 'Lutra lutra', names: ['loutre'], photo: 'europeanOtter' },
  { latin: 'Petaurus breviceps', names: ['phalanger volant'], photo: 'sugarGlider' },
  { latin: 'Pteromys volans', names: ['écureuil volant'], photo: 'flyingSquirrel' },
  { latin: 'Manis pentadactyla', names: ['pangolin asiatique'], photo: 'chinesePangolin' },
  { latin: 'Vicugna pacos', names: ['alpaga'], photo: 'alpaca' },
  { latin: 'Ara macao', names: ['ara macao', 'ara rouge'], photo: 'scarletMacaw' },
  { latin: 'Ara militaris', names: ['ara militaire'], photo: 'militaryMacaw' },
  { latin: 'Cacatua galerita', names: ['cacatoès à huppe jaune'], photo: 'sulphurCrestedCockatoo' },
  { latin: 'Poicephalus senegalus', names: ['perroquet youyou'], photo: 'senegalParrot' },
  { latin: 'Bubo bubo', names: ['grand-duc d’europe', "grand-duc d'europe"], photo: 'europeanEagleOwl' },
  { latin: 'Paracheirodon axelrodi', names: ['néon cardinalis'], photo: 'cardinalTetra' },
  { latin: 'Symphysodon discus', names: ['discus'], photo: 'discus' },
  { latin: 'Amatitlania nigrofasciata', names: ['cichlidé convict'], photo: 'convictCichlid' },
  { latin: 'Pethia conchonius', names: ['barbu rosé'], photo: 'rosyBarb' },
  { latin: 'Devario aequipinnatus', names: ['danio géant'], photo: 'giantDanio' },
  { latin: 'Xiphophorus hellerii', names: ['xipho'], photo: 'swordtail' },
  { latin: 'Corydoras sterbai', names: ['corydoras sterbai'], photo: 'sterbaiCorydoras' },
  // Le fichier Commons utilise le nom générique accepté Macrotocinclus affinis, synonyme du nom
  // du catalogue Otocinclus affinis : il s’agit bien du même taxon.
  { latin: 'Otocinclus affinis', names: ['otocinclus'], photo: 'otocinclus' },
  { latin: 'Ancistrus cirrhosus', names: ['ancistrus'], photo: 'ancistrus' },
  { latin: 'Pantodon buchholzi', names: ['poisson-papillon'], photo: 'butterflyfish' },
  { latin: 'Toxotes jaculatrix', names: ['poisson-archer'], photo: 'archerfish' },
  { latin: 'Gnathonemus petersii', names: ['poisson éléphant'], photo: 'elephantnoseFish' },
  { latin: 'Lama glama', names: ['lama'], photo: 'llama' },
  { latin: 'Lemur catta', names: ['lemur catta'], photo: 'ringTailedLemur' },
  { latin: 'Notamacropus rufogriseus', names: ['wallaby de bennett'], photo: 'bennettsWallaby' },
  { latin: 'Ovibos moschatus', names: ['bœuf musqué'], photo: 'muskOx' },
  { latin: 'Cervus nippon', names: ['cerf sika'], photo: 'sikaDeer' },
  { latin: 'Dama dama', names: ['daim'], photo: 'fallowDeer' },
  { latin: 'Neopsephotus bourkii', names: ['perruche de bourke'], photo: 'bourkesParakeet' },
  { latin: 'Estrilda caerulescens', names: ['astrild à pointe'], photo: 'lavenderWaxbill' },
  { latin: 'Emberiza cioides', names: ['bruant du japon'], photo: 'japaneseBunting' },
  { latin: 'Geopelia cuneata', names: ['colombe diamant'], photo: 'diamondDove' },
  { latin: 'Anas platyrhynchos', names: ['canard colvert'], photo: 'mallard' },
  { latin: 'Aix sponsa', names: ['canard carolin'], photo: 'woodDuck' },
  { latin: 'Coturnix japonica', names: ['caille du japon'], photo: 'japaneseQuail' },
  { latin: 'Cygnus olor', names: ['cygne tuberculé'], photo: 'muteSwan' },
  { latin: 'Ramphastos toco', names: ['toucan toco'], photo: 'tocoToucan' },
  { latin: 'Orycteropus afer', names: ['oryctérope du cap'], photo: 'aardvark' },
  { latin: 'Potos flavus', names: ['kinkajou'], photo: 'kinkajou' },
  { latin: 'Sciurus carolinensis', names: ['écureuil gris'], photo: 'greySquirrel' },
  { latin: 'Saguinus oedipus', names: ['tamarin'], photo: 'cottontopTamarin' },
  { latin: 'Caracal caracal', names: ['caracal'], photo: 'caracal' },
  { latin: 'Leopardus pardalis', names: ['ocelot'], photo: 'ocelot' },
  { latin: 'Arctictis binturong', names: ['binturong'], photo: 'binturong' },
  { latin: 'Herpestes ichneumon', names: ['mangouste'], photo: 'egyptianMongoose' },
  { latin: 'Hystrix cristata', names: ['porc-épic'], photo: 'crestedPorcupine' },
  { latin: 'Cuniculus paca', names: ['paca'], photo: 'paca' },
  { latin: 'Neophema pulchella', names: ['perruche turquoisine'], photo: 'turquoiseParrot' },
  { latin: 'Agapornis personatus', names: ['inséparable masqué'], photo: 'maskedLovebird' },
  { latin: 'Trichoglossus moluccanus', names: ['lori de swainson'], photo: 'rainbowLorikeet' },
  { latin: 'Amphiprion ocellaris', names: ['poisson-clown orange'], photo: 'orangeClownfish' },
  { latin: 'Cyprinus rubrofuscus', names: ['koi'], photo: 'koi' },
  // Commons nomme encore cette espèce Colisa lalia, synonyme de Trichogaster lalius.
  { latin: 'Trichogaster lalius', names: ['gourami nain'], photo: 'dwarfGourami' },
  { latin: 'Aphyosemion australe', names: ['killie'], photo: 'australeKillifish' },
  { latin: 'Kryptopterus vitreolus', names: ['poisson-chat de verre'], photo: 'glassCatfish' },
  { latin: 'Bufo bufo', names: ['crapaud commun'], photo: 'commonToad' },
  { latin: 'Xenopus laevis', names: ['xénope lisse'], photo: 'xenopus' },
  { latin: 'Hyla arborea', names: ['rainette à doigts de cuivre'], photo: 'europeanTreefrog' },
  { latin: 'Rhinella marina', names: ['crapaud buffle'], photo: 'caneToad' },
  { latin: 'Oophaga pumilio', names: ['grenouille de dart'], photo: 'strawberryDartFrog' },
  { latin: 'Mantis religiosa', names: ['mante religieuse'], photo: 'prayingMantis' },
  { latin: 'Theraphosa blondi', names: ['tarentule goliath'], photo: 'goliathTarantula' },
  { latin: 'Grammostola rosea', names: ['tarentule de gordon'], photo: 'grammostolaRosea' },
  { latin: 'Coenobita clypeatus', names: ["bernard-l'ermite terrestre"], photo: 'caribbeanHermitCrab' },
  { latin: 'Porcellio laevis', names: ['cloporte géant'], photo: 'giantWoodlouse' },

  { latin: 'Dendrobates auratus', names: ['dendrobate à ventre tacheté'], photo: 'dendrobatesAuratus' },
  { latin: 'Dendrobates azureus', names: ['dendrobate bleu'], photo: 'dendrobatesAzureus' },
  { latin: 'Pelophylax kl. esculentus', names: ['grenouille verte'], photo: 'edibleFrog' },
  { latin: 'Triturus cristatus', names: ['triton crêté'], photo: 'crestedNewt' },
  { latin: 'Ichthyosaura alpestris', names: ['triton alpestre'], photo: 'alpineNewt' },
  { latin: 'Hyalinobatrachium valerioi', names: ['grenouille de verre'], photo: 'glassFrog' },
  { latin: 'Ameerega trivittata', names: ['grenouille venimeuse de l’amazone'], photo: 'amazonPoisonFrog' },
  { latin: 'Poecilia latipinna', names: ['molly voile'], photo: 'sailfinMolly' },
  // Le nom sous lequel Commons classe cette espèce est Trichopodus trichopterus.
  { latin: 'Trichogaster trichopterus', names: ['gourami bleu'], photo: 'blueGourami' },
  { latin: 'Apistogramma cacatuoides', names: ['apistogramma cacatuoides'], photo: 'cockatooDwarfCichlid' },
  { latin: 'Hyphessobrycon anisitsi', names: ['tétras de buenos aires'], photo: 'buenosAiresTetra' },
  { latin: 'Brachypelma auratum', names: ['tarentule mexicaine à genoux oranges'], photo: 'orangeKneeTarantula' },
  { latin: 'Avicularia avicularia', names: ['tarentule à pattes roses'], photo: 'pinktoeTarantula' },
  { latin: 'Lasiodora parahybana', names: ['tarentule saumonée'], photo: 'salmonPinkTarantula' },
  { latin: 'Helix pomatia', names: ['escargot de bourgogne'], photo: 'burgundySnail' },
];

const key = (value: string) => value.trim().toLocaleLowerCase('fr').normalize('NFC');

/** Photo d'archive locale avec crédit déjà vérifié, seulement pour l'identité éditoriale reconnue. */
export function curatedSpeciesPhoto(latin: string, commonNameFr?: string): SpeciesPhoto | null {
  const remote = REMOTE_TAXA.find((entry) =>
    key(entry.latin) === key(latin) && commonNameFr && entry.names.includes(key(commonNameFr)),
  );
  if (remote) {
    const p = PHOTOS[remote.photo];
    const sources = photoSources(remote.photo);
    return {
      src: sources.src,
      srcSet: sources.srcSet,
      sources: sources.sources,
      author: p.credit.author,
      license: { label: p.credit.license, url: p.credit.licenseUrl ?? 'https://commons.wikimedia.org/wiki/Commons:Licensing' },
      sourceUrl: p.credit.sourceUrl,
    };
  }

  const taxon = TAXA.find((entry) => {
    if (key(entry.latin) !== key(latin)) return false;
    if (!commonNameFr) return entry.nameMayBeMissing === true;
    return entry.names.includes(key(commonNameFr));
  });
  if (!taxon) return null;

  const photo = PHOTOS[taxon.photo];
  const sources = photoSources(taxon.photo);
  return {
    src: sources.src,
    srcSet: sources.srcSet,
    sources: sources.sources,
    author: photo.credit.author,
    license: {
      label: photo.credit.license,
      url: photo.credit.licenseUrl ?? 'https://commons.wikimedia.org/wiki/Commons:Licensing',
    },
    sourceUrl: photo.credit.sourceUrl,
  };
}
