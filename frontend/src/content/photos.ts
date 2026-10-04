/**
 * Photothèque du catalogue et de la landing : photos Wikimedia Commons sous licence libre vérifiée (API Commons,
 * champ `LicenseShortName`), préparées et exportées en AVIF + WebP sans métadonnées
 * (`public/images/<dossier>/<slug>-<largeur>.<format>`, plus grande variante ≤ 150 Ko).
 *
 * Chaque entrée est aussi inscrite dans `public/images/CREDITS.md` et listée dans la page
 * « Sources et licences » (section « Photographies »). Les composants fournissent un texte
 * alternatif traduit ; le crédit (auteur + licence + lien) est affiché avec chaque photo.
 */
import type { PhotoCredit } from '@/components/ui/Figure';

export type PhotoKey =
  | 'dogGoldenRetriever'
  | 'dogRiver'
  | 'catStraw'
  | 'catTabby'
  | 'rabbitStraw'
  | 'cockatiels'
  | 'budgerigars'
  | 'leopardGecko'
  | 'beardedDragon'
  | 'neonTetra'
  | 'horse'
  | 'hen'
  | 'guineaPig'
  | 'syrianHamster'
  | 'ferret'
  | 'chinchilla'
  | 'domesticMouse'
  | 'domesticRat'
  | 'canary'
  | 'africanGrey'
  | 'boaConstrictor'
  | 'ballPython'
  | 'greenIguana'
  | 'redEaredSlider'
  | 'veiledChameleon'
  | 'axolotl'
  | 'goldfish'
  | 'betta'
  | 'guppy'
  | 'stickInsect'
  | 'hissingCockroach'
  | 'emperorScorpion'
  | 'bullfrog'
  | 'russianHamster'
  | 'campbellHamster'
  | 'roborovskiHamster'
  | 'crestedGecko'
  | 'pantherChameleon'
  | 'hermannTortoise'
  | 'ringNeckedParakeet'
  | 'fischerLovebird'
  | 'blueYellowMacaw'
  | 'angelfish'
  | 'zebrafish'
  | 'ramirezi'
  | 'redEyedTreeFrog'
  | 'dyeingPoisonFrog'
  | 'cherryShrimp'
  | 'amanoShrimp'
  | 'sheep'
  | 'donkey'
  | 'africanHedgehog'
  | 'categoryMammals'
  | 'categoryBirds'
  | 'categoryFish'
  | 'categoryReptiles'
  | 'categoryAmphibians'
  | 'categoryInsects'
  | 'textureFur'
  | 'textureFeathers'
  | 'textureFishScales'
  | 'textureReptileScales'
  | 'textureAmphibianSkin'
  | 'textureInsectWing'
  | 'guideAquariumFilter'
  | 'guideNitrogenCycle'
  | 'tarantulaMexicanRedKnee'
  | 'greekTortoise'
  | 'marginatedTortoise'
  | 'cornSnake'
  | 'kingSnake'
  | 'savannahMonitor'
  | 'pandaCorydoras'
  | 'bronzeCorydoras'
  | 'platy'
  | 'orientalFireBelliedToad'
  | 'orchidMantis'
  | 'curlyHairTarantula'
  | 'rosyFacedLovebird'
  | 'zebraFinch'
  | 'blackMolly'
  | 'greenTreefrog'
  | 'mongolianGerbil'
  | 'chileanDegu'
  | 'blueFrontedAmazon'
  | 'whiteFrontedAmazon'
  | 'madagascarGiantDayGecko'
  | 'whitesTreeFrog'
  | 'capybara'
  | 'tokayGecko'
  | 'meerkat'
  | 'eclectus'
  | 'emu'
  | 'bluePeafowl'
  | 'goldenPheasant'
  | 'gouldianFinch'
  | 'ornateHornedFrog'
  | 'japaneseGiantSalamander'
  | 'leafInsect'
  | 'giantAfricanSnail'
  | 'giantMillipede'
  | 'fireSalamander'
  | 'tomatoFrog'
  | 'bumblebeePoisonFrog'
  | 'cranwellsHornedFrog'
  | 'phelsumaMadagascar'
  | 'satanicLeafTailedGecko'
  | 'antillesIguana'
  | 'greenAnole'
  | 'knightAnole'
  | 'greenBasilisk'
  | 'jacksonsChameleon'
  | 'parsonsChameleon'
  | 'komodoDragon'
  | 'argentineTegu'
  | 'frillNeckedLizard'
  | 'ocellatedLizard'
  | 'emeraldTreeBoa'
  | 'milkSnake'
  | 'hognoseSnake'
  | 'blackNeonTetra'
  | 'lemonTetra'
  | 'emperorTetra'
  | 'congoTetra'
  | 'blackPhantomTetra'
  | 'oscarCichlid'
  | 'jackDempseyCichlid'
  | 'parrotCichlid'
  | 'frontosaCichlid'
  | 'zebraCichlid'
  | 'yellowLabCichlid'
  | 'cherryBarb'
  | 'tigerBarb'
  | 'whiteCockatoo'
  | 'smallClawedOtter'
  | 'americanMink'
  | 'vizcacha'
  | 'pygmyOpossum'
  | 'harvestMouse'
  | 'commonMarmoset'
  | 'agouti'
  | 'mara'
  | 'redShoulderedMacaw'
  | 'greenCheekedConure'
  | 'sunConure'
  | 'galah'
  | 'javaSparrow'
  | 'northernCardinal'
  | 'mandarinDuck'
  | 'redSquirrel'
  | 'raccoon'
  | 'coati'
  | 'serval'
  | 'genet'
  | 'europeanOtter'
  | 'sugarGlider'
  | 'flyingSquirrel'
  | 'chinesePangolin'
  | 'alpaca'
  | 'scarletMacaw'
  | 'militaryMacaw'
  | 'sulphurCrestedCockatoo'
  | 'senegalParrot'
  | 'europeanEagleOwl'
  | 'cardinalTetra'
  | 'discus'
  | 'convictCichlid'
  | 'rosyBarb'
  | 'giantDanio'
  | 'swordtail'
  | 'sterbaiCorydoras'
  | 'otocinclus'
  | 'ancistrus'
  | 'butterflyfish'
  | 'archerfish'
  | 'elephantnoseFish'
  | 'llama'
  | 'ringTailedLemur'
  | 'bennettsWallaby'
  | 'muskOx'
  | 'sikaDeer'
  | 'fallowDeer'
  | 'bourkesParakeet'
  | 'lavenderWaxbill'
  | 'japaneseBunting'
  | 'diamondDove'
  | 'mallard'
  | 'woodDuck'
  | 'japaneseQuail'
  | 'muteSwan'
  | 'tocoToucan'
  | 'mossForest'
  | 'grassDroplets'
  | 'lemonBalm'
  | 'aardvark'
  | 'kinkajou'
  | 'greySquirrel'
  | 'cottontopTamarin'
  | 'caracal'
  | 'ocelot'
  | 'binturong'
  | 'egyptianMongoose'
  | 'crestedPorcupine'
  | 'paca'
  | 'turquoiseParrot'
  | 'maskedLovebird'
  | 'rainbowLorikeet'
  | 'orangeClownfish'
  | 'koi'
  | 'dwarfGourami'
  | 'australeKillifish'
  | 'glassCatfish'
  | 'commonToad'
  | 'xenopus'
  | 'europeanTreefrog'
  | 'caneToad'
  | 'strawberryDartFrog'
  | 'prayingMantis'
  | 'goliathTarantula'
  | 'grammostolaRosea'
  | 'caribbeanHermitCrab'
  | 'giantWoodlouse'
  | 'dendrobatesAuratus'
  | 'dendrobatesAzureus'
  | 'edibleFrog'
  | 'crestedNewt'
  | 'alpineNewt'
  | 'glassFrog'
  | 'amazonPoisonFrog'
  | 'sailfinMolly'
  | 'blueGourami'
  | 'cockatooDwarfCichlid'
  | 'buenosAiresTetra'
  | 'orangeKneeTarantula'
  | 'pinktoeTarantula'
  | 'salmonPinkTarantula'
  | 'burgundySnail';

export interface Photo {
  /** Chemin sans largeur ni extension : `/images/animals/cat-straw`. */
  base: string;
  /** Largeurs exportées (px), croissantes. */
  widths: readonly number[];
  /** Ratio largeur / hauteur des fichiers exportés. */
  ratio: number;
  /** Titre du fichier sur Wikimedia Commons. */
  commonsTitle: string;
  credit: PhotoCredit;
  /** Modifications apportées (exigées par CC BY / CC BY-SA) : voir `PHOTO_CHANGES`. */
  changes: 'crop' | 'soften' | 'resize' | 'mirror';
}

/** Libellé des modifications, par langue de rédaction des pages légales (fr, sinon en). */
export const PHOTO_CHANGES: Record<'fr' | 'en', Record<Photo['changes'], string>> = {
  fr: {
    mirror: 'recadrée, redimensionnée, convertie en AVIF/WebP, métadonnées retirées ; répétée par réflexion pour le fond',
    crop: 'recadrée, redimensionnée, convertie en AVIF/WebP, métadonnées retirées',
    soften: 'recadrée, légèrement adoucie (texture de fond), redimensionnée, convertie en AVIF/WebP, métadonnées retirées',
    resize: 'redimensionnée, convertie en AVIF/WebP, fond blanc ajouté, métadonnées retirées',
  },
  en: {
    mirror: 'cropped, resized, converted to AVIF/WebP, metadata removed; repeated by reflection for the background',
    crop: 'cropped, resized, converted to AVIF/WebP, metadata removed',
    soften: 'cropped, slightly softened (background texture), resized, converted to AVIF/WebP, metadata removed',
    resize: 'resized, converted to AVIF/WebP, white background added, metadata removed',
  },
};

const LICENSES = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-SA 3.0 DE': 'https://creativecommons.org/licenses/by-sa/3.0/de/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 2.5': 'https://creativecommons.org/licenses/by/2.5/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Domaine public': undefined,
} as const;

/** Page du fichier sur Commons (même encodage que l'URL canonique de Commons). */
const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURI(file.replace(/ /g, '_'))}`;

function photo(p: {
  base: string;
  widths: number[];
  ratio: number;
  file: string;
  author: string;
  license: keyof typeof LICENSES;
  changes?: Photo['changes'];
}): Photo {
  const licenseUrl = LICENSES[p.license];
  return {
    base: p.base,
    widths: p.widths,
    ratio: p.ratio,
    commonsTitle: p.file,
    credit: { author: p.author, license: p.license, sourceUrl: commons(p.file), ...(licenseUrl ? { licenseUrl } : {}) },
    changes: p.changes ?? 'crop',
  };
}

export const PHOTOS: Record<PhotoKey, Photo> = {
  dogGoldenRetriever: photo({
    base: '/images/animals/dog-golden-retriever', widths: [480, 800, 1200], ratio: 4 / 3,
    file: 'Dülmen, Hausdülmen, Golden Retriever -- 2022 -- 5945.jpg', author: 'Dietmar Rabich', license: 'CC BY-SA 4.0',
  }),
  dogRiver: photo({
    base: '/images/animals/dog-river', widths: [640, 960, 1280, 1600], ratio: 4 / 3,
    file: 'Liver yellow dog in the water looking at viewer at golden hour in Don Det Laos.jpg', author: 'Basile Morin', license: 'CC BY-SA 4.0',
  }),
  catStraw: photo({
    base: '/images/animals/cat-straw', widths: [480, 800, 1200], ratio: 3 / 2,
    file: 'Felis silvestris catus lying on rice straw.jpg', author: 'Basile Morin', license: 'CC BY-SA 4.0',
  }),
  catTabby: photo({
    base: '/images/animals/cat-tabby', widths: [480, 800], ratio: 3 / 4,
    file: 'Cat November 2010-1a.jpg', author: 'Alvesgaspar', license: 'CC BY-SA 3.0',
  }),
  rabbitStraw: photo({
    base: '/images/animals/rabbit-straw', widths: [480, 800, 1200], ratio: 4 / 3,
    file: 'Conejo común (Oryctolagus cuniculus), Tierpark Hellabrunn, Múnich, Alemania, 2012-06-17, DD 02.JPG',
    author: 'Diego Delso', license: 'CC BY-SA 3.0',
  }),
  cockatiels: photo({
    base: '/images/animals/cockatiels', widths: [480, 800, 1200], ratio: 4 / 3,
    file: 'Nymphicus hollandicus - Forst 01.jpg', author: 'H. Zell', license: 'CC BY-SA 3.0',
  }),
  budgerigars: photo({
    base: '/images/animals/budgerigars', widths: [480, 800, 1200], ratio: 4 / 3,
    file: 'Melopsittacus undulatus - Vogelpark Steinen 02.jpg', author: 'H. Zell', license: 'CC BY-SA 3.0',
  }),
  leopardGecko: photo({
    base: '/images/animals/leopard-gecko', widths: [480, 800], ratio: 3 / 2,
    file: 'Eublepharis macularius 2009 G6.jpg', author: 'George Chernilevsky', license: 'Domaine public',
  }),
  beardedDragon: photo({
    base: '/images/animals/bearded-dragon', widths: [480, 800], ratio: 1,
    file: '383 - Head of central bearded dragon (Pogona vitticeps).jpg', author: 'Virtual-Pano', license: 'CC BY 4.0',
  }),
  neonTetra: photo({
    base: '/images/animals/neon-tetra', widths: [480, 800, 1200], ratio: 3 / 2,
    file: 'Neonsalmler Paracheirodon innesi.jpg', author: 'Holger Krisp', license: 'CC BY 3.0',
  }),
  horse: photo({
    base: '/images/animals/horse', widths: [480, 800], ratio: 4 / 3,
    file: 'Horse December 2014-1.jpg', author: 'Alvesgaspar', license: 'CC BY-SA 4.0',
  }),
  hen: photo({
    base: '/images/animals/hen', widths: [480, 800, 1200], ratio: 3 / 2,
    file: 'Hen chicken.jpg', author: 'Thegreenj', license: 'CC BY-SA 3.0',
  }),
  guineaPig: photo({
    base: '/images/animals/guinea-pig', widths: [480, 800], ratio: 4 / 3,
    file: 'Yoyocochondinde.JPG',
    author: 'Variraptor', license: 'CC BY-SA 3.0',
  }),
  syrianHamster: photo({
    base: '/images/animals/syrian-hamster', widths: [480, 800], ratio: 4 / 3,
    file: 'Golden hamster front 1.jpg',
    author: 'Adamjennison111 at English Wikipedia', license: 'CC BY 2.5',
  }),
  ferret: photo({
    base: '/images/animals/ferret', widths: [480, 800], ratio: 4 / 3,
    file: 'Ferret 2008.png',
    author: 'Alfredo Gutiérrez', license: 'CC BY-SA 4.0',
  }),
  chinchilla: photo({
    base: '/images/animals/chinchilla', widths: [480, 800], ratio: 4 / 3,
    file: 'Chinchilla lanigera1.jpg',
    author: 'Trurl66', license: 'Domaine public',
  }),
  domesticMouse: photo({
    base: '/images/animals/domestic-mouse', widths: [480, 800], ratio: 4 / 3,
    file: 'Farbmaeuse.jpg',
    author: 'Whitesky', license: 'CC BY-SA 3.0',
  }),
  domesticRat: photo({
    base: '/images/animals/domestic-rat', widths: [480, 800], ratio: 4 / 3,
    file: 'Rats-domestique.jpg',
    author: 'Alexalouest', license: 'CC0',
  }),
  canary: photo({
    base: '/images/animals/canary', widths: [480, 800], ratio: 4 / 3,
    file: 'GelbA.JPG',
    author: 'NEWSchr', license: 'CC BY-SA 4.0',
  }),
  africanGrey: photo({
    base: '/images/animals/african-grey', widths: [480, 800], ratio: 4 / 3,
    file: 'Psittacus_erithacus_qtl1.jpg',
    author: 'Quartl', license: 'CC BY-SA 3.0',
  }),
  boaConstrictor: photo({
    base: '/images/animals/boa-constrictor', widths: [480, 800], ratio: 4 / 3,
    file: 'Boa_constrictor_Gallion_Guyane.jpg',
    author: 'Arnaud Aury', license: 'CC BY 4.0',
  }),
  ballPython: photo({
    base: '/images/animals/ball-python', widths: [480, 800], ratio: 4 / 3,
    file: 'Ball_python_lucy.JPG',
    author: 'Mokele at English Wikipedia', license: 'CC BY-SA 3.0',
  }),
  greenIguana: photo({
    base: '/images/animals/green-iguana', widths: [480, 800], ratio: 4 / 3,
    file: 'Iguanidae_head_from_Venezuela.jpg',
    author: 'Wilfredor', license: 'CC0',
  }),
  redEaredSlider: photo({
    base: '/images/animals/red-eared-slider', widths: [480, 800], ratio: 4 / 3,
    file: 'Roodwangsierschildpad.jpg',
    author: 'Fruggo', license: 'CC BY-SA 3.0',
  }),
  veiledChameleon: photo({
    base: '/images/animals/veiled-chameleon', widths: [480, 800], ratio: 4 / 3,
    file: '2017-05-13_AT_Wien_22_Donaustadt,_Palmenhaus_Hirschstetten,_Chamaeleo_calyptratus_(51099601593).jpg',
    author: 'Paul Korecky', license: 'CC BY-SA 2.0',
  }),
  axolotl: photo({
    base: '/images/animals/axolotl', widths: [480, 800], ratio: 4 / 3,
    file: 'Ambystoma_mexicanum_-_Aksolotli,_Mexican_axolotl_C_IMG_3700.JPG',
    author: 'Anneli Salo', license: 'CC BY-SA 3.0',
  }),
  goldfish: photo({
    base: '/images/animals/goldfish', widths: [480, 800], ratio: 4 / 3,
    file: 'Gold fish1.jpg',
    author: 'לינה אבוגוש', license: 'CC BY-SA 3.0',
  }),
  betta: photo({
    base: '/images/animals/betta', widths: [320, 425], ratio: 4 / 3,
    file: 'Betta splendens - Flickr - Nippyfish.jpg',
    author: 'Nippyfish', license: 'CC BY 2.0',
  }),
  guppy: photo({
    base: '/images/animals/guppy', widths: [320, 378], ratio: 4 / 3,
    file: 'Guppy_coppia_gialla.jpg',
    author: 'Marrabbio2', license: 'CC BY-SA 3.0',
  }),
  stickInsect: photo({
    base: '/images/animals/stick-insect', widths: [320, 734], ratio: 4 / 3,
    file: 'Carausius morosus-adult1.JPG',
    author: 'Dinosaur918', license: 'CC BY-SA 3.0',
  }),
  hissingCockroach: photo({
    base: '/images/animals/hissing-cockroach', widths: [480, 800], ratio: 4 / 3,
    file: 'Female_Madagascar_hissing_cockroach.JPG',
    author: 'Almabes at English Wikipedia', license: 'Domaine public',
  }),
  emperorScorpion: photo({
    base: '/images/animals/emperor-scorpion', widths: [480, 800], ratio: 4 / 3,
    file: 'Pandinus-imperator-6609.jpg',
    author: 'Danny Steaven', license: 'CC BY-SA 3.0',
  }),
  bullfrog: photo({
    base: '/images/animals/bullfrog', widths: [480, 800], ratio: 4 / 3,
    file: 'North-American-bullfrog1.jpg',
    author: 'Carl D. Howe', license: 'CC BY-SA 2.5',
  }),
  russianHamster: photo({
    base: '/images/animals/russian-hamster', widths: [480, 800], ratio: 4 / 3,
    file: 'Phodopus_sungorus2.jpg',
    author: 'Dirk Goldhahn', license: 'CC BY-SA 2.5',
  }),
  campbellHamster: photo({
    base: '/images/animals/campbell-hamster', widths: [320, 360], ratio: 4 / 3,
    file: 'Campbell_hamster_blue_fawn.jpg',
    author: 'Allen Huang', license: 'Domaine public',
  }),
  roborovskiHamster: photo({
    base: '/images/animals/roborovski-hamster', widths: [320, 559], ratio: 4 / 3,
    file: 'Photo_of_Roborovski_Hamster.jpg',
    author: 'Roborovskihamsters at en.wikipedia', license: 'Domaine public',
  }),
  crestedGecko: photo({
    base: '/images/animals/crested-gecko', widths: [480, 800], ratio: 4 / 3,
    file: 'Eveha\'s_crested_gecko.jpg',
    author: 'Eveha', license: 'CC BY-SA 3.0',
  }),
  pantherChameleon: photo({
    base: '/images/animals/panther-chameleon', widths: [480, 800], ratio: 4 / 3,
    file: 'Panther chameleon (Furcifer pardalis) male Montagne d’Ambre 2.jpg',
    author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  hermannTortoise: photo({
    base: '/images/animals/hermann-tortoise', widths: [480, 800], ratio: 4 / 3,
    file: 'Testudo_hermanni_hermanni_Mallorca_02.jpg',
    author: 'Orchi', license: 'CC BY-SA 3.0',
  }),
  ringNeckedParakeet: photo({
    base: '/images/animals/ring-necked-parakeet', widths: [320, 645], ratio: 4 / 3,
    file: 'Rose-ringed_Parakeets_(Male_&_Female)-_During_Foreplay_at_Hodal_I_Picture_0034.jpg',
    author: 'J.M.Garg', license: 'CC BY-SA 3.0',
  }),
  fischerLovebird: photo({
    base: '/images/animals/fischer-lovebird', widths: [480, 800], ratio: 4 / 3,
    file: 'Inséparables.JPG',
    author: 'Ghislain38', license: 'CC BY-SA 3.0',
  }),
  blueYellowMacaw: photo({
    base: '/images/animals/blue-yellow-macaw', widths: [480, 800], ratio: 4 / 3,
    file: 'Ara ararauna qtl3.jpg',
    author: 'Quartl', license: 'CC BY-SA 3.0',
  }),
  angelfish: photo({
    base: '/images/animals/angelfish', widths: [480, 800], ratio: 4 / 3,
    file: 'Angelfish 2.jpg',
    author: 'Gannu03', license: 'CC BY-SA 4.0',
  }),
  zebrafish: photo({
    base: '/images/animals/zebrafish', widths: [480, 800], ratio: 4 / 3,
    file: 'Zebradanio-P1219668.jpg',
    author: 'Ffish.asia', license: 'CC BY 4.0',
  }),
  ramirezi: photo({
    base: '/images/animals/ramirezi', widths: [320, 444], ratio: 4 / 3,
    file: 'Mikrogeophagus_ramirezi_2.jpg',
    author: 'Grommash', license: 'CC BY-SA 3.0',
  }),
  redEyedTreeFrog: photo({
    base: '/images/animals/red-eyed-tree-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Agalychnis_callidryas.jpg',
    author: 'Christian R. Linder', license: 'CC BY-SA 3.0',
  }),
  dyeingPoisonFrog: photo({
    base: '/images/animals/dyeing-poison-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Dendrobates tinctorius - Wilhelma.jpg',
    author: 'H. Zell', license: 'CC BY-SA 3.0',
  }),
  cherryShrimp: photo({
    base: '/images/animals/cherry-shrimp', widths: [480, 800], ratio: 4 / 3,
    file: 'RedCherryShrimp.jpg',
    author: 'Atulbhats', license: 'CC BY-SA 4.0',
  }),
  amanoShrimp: photo({
    base: '/images/animals/amano-shrimp', widths: [480, 800], ratio: 4 / 3,
    file: 'Caridina_multidentata(Hamamatsu,Shizuoka,Japan,2007).jpg',
    author: 'Seotaro', license: 'CC BY-SA 3.0',
  }),
  sheep: photo({
    base: '/images/animals/sheep', widths: [480, 800], ratio: 4 / 3,
    file: 'Flock_of_sheep.jpg',
    author: 'Keith Weller', license: 'Domaine public',
  }),
  donkey: photo({
    base: '/images/animals/donkey', widths: [320, 714], ratio: 4 / 3,
    file: 'Donkey_in_Clovelly,_North_Devon,_England.jpg',
    author: 'Adrian Pingstone', license: 'Domaine public',
  }),
  africanHedgehog: photo({
    base: '/images/animals/african-hedgehog', widths: [480, 800], ratio: 4 / 3,
    file: 'Atelerix albiventris in Spain.jpg',
    author: 'Nacaru', license: 'CC BY-SA 4.0',
  }),
  tarantulaMexicanRedKnee: photo({
    base: '/images/animals/tarantula-mexican-red-knee', widths: [480, 800], ratio: 4 / 3,
    file: 'Brachypelma smithi 2009 G02.jpg', author: 'George Chernilevsky', license: 'Domaine public',
  }),
  greekTortoise: photo({
    base: '/images/animals/greek-tortoise', widths: [480, 800], ratio: 4 / 3,
    file: 'Testudo graeca at Dibbeen2.JPG', author: 'عباد ديرانية', license: 'CC BY-SA 3.0',
  }),
  marginatedTortoise: photo({
    base: '/images/animals/marginated-tortoise', widths: [480, 800], ratio: 4 / 3,
    file: 'Klokschildpad - Marginated tortoise - Testudo marginata 02.jpg', author: 'Bouke ten Cate', license: 'CC BY 4.0',
  }),
  cornSnake: photo({
    base: '/images/animals/corn-snake', widths: [480, 800], ratio: 4 / 3,
    file: 'Kornnatter (Pantherophis guttatus), Seitenansicht.jpg', author: 'Peter Paplanus', license: 'CC BY 2.0',
  }),
  kingSnake: photo({
    base: '/images/animals/king-snake', widths: [480, 800], ratio: 4 / 3,
    file: 'Lampropeltis getula Stanton 1.jpg', author: 'Riley Stanton', license: 'CC BY-SA 4.0',
  }),
  savannahMonitor: photo({
    base: '/images/animals/savannah-monitor', widths: [480, 800], ratio: 4 / 3,
    file: 'Varanus exanthematicus in the wild.jpg', author: 'Daniel Bennett', license: 'CC BY-SA 3.0',
  }),
  pandaCorydoras: photo({
    base: '/images/animals/panda-corydoras', widths: [480, 800], ratio: 4 / 3,
    file: 'Corydoras panda. (46592394085).jpg', author: 'Harry Kramer from Winterswijk, The Netherlands', license: 'CC BY 2.0',
  }),
  bronzeCorydoras: photo({
    base: '/images/animals/bronze-corydoras', widths: [480, 800], ratio: 4 / 3,
    file: 'Female Bronze Corydoras (Corydoras aeneus).jpg', author: 'Andrew Keller', license: 'CC0',
  }),
  platy: photo({
    base: '/images/animals/platy', widths: [480, 640], ratio: 4 / 3,
    file: 'Platy 011.jpg', author: 'Gourami Watcher', license: 'CC BY-SA 3.0',
  }),
  orientalFireBelliedToad: photo({
    base: '/images/animals/oriental-fire-bellied-toad', widths: [480, 800], ratio: 4 / 3,
    file: 'Bombina orientalis 35461949.jpg', author: 'Kim, Hyun-tae', license: 'CC BY 4.0',
  }),
  orchidMantis: photo({
    base: '/images/animals/orchid-mantis', widths: [480, 800], ratio: 4 / 3,
    file: 'Mantis Hymenopus coronatus 6 Luc Viatour.jpg', author: 'Luc Viatour', license: 'CC BY-SA 3.0',
  }),
  curlyHairTarantula: photo({
    base: '/images/animals/curly-hair-tarantula', widths: [480, 700], ratio: 4 / 3,
    file: 'Brachypelma.albopilosum.female.jpg', author: 'Sarefo', license: 'CC BY-SA 3.0',
  }),
  rosyFacedLovebird: photo({
    base: '/images/animals/rosy-faced-lovebird', widths: [480, 800], ratio: 4 / 3,
    file: 'Rosy-faced lovebird (Agapornis roseicollis roseicollis).jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  zebraFinch: photo({
    base: '/images/animals/zebra-finch', widths: [480, 800], ratio: 4 / 3,
    file: '2014-08-19 Zebra Finch, Sumba, Nusa Tenggara Timur, Indonesia 1.jpg', author: 'christoph_moning', license: 'CC BY 4.0',
  }),
  blackMolly: photo({
    base: '/images/animals/black-molly', widths: [480, 800], ratio: 4 / 3,
    file: 'PoeciliaSphenops.jpg', author: 'Dnoerholm', license: 'CC BY-SA 4.0',
  }),
  greenTreefrog: photo({
    base: '/images/animals/green-treefrog', widths: [480, 800], ratio: 4 / 3,
    file: 'Green treefrog.jpg', author: 'Brian Gratwicke', license: 'CC BY 2.0',
  }),
  mongolianGerbil: photo({
    base: '/images/animals/mongolian-gerbil', widths: [480, 800], ratio: 4 / 3,
    file: 'Meriones unguiculatus (wild).jpg', author: 'Alastair Rae from London, United Kingdom', license: 'Domaine public',
  }),
  chileanDegu: photo({
    base: '/images/animals/chilean-degu', widths: [480, 720], ratio: 4 / 3,
    file: 'Octodon Degus fr.jpg', author: 'Jacek555', license: 'CC BY-SA 4.0',
  }),
  blueFrontedAmazon: photo({
    base: '/images/animals/blue-fronted-amazon', widths: [480, 800], ratio: 4 / 3,
    file: 'Amazona aestiva - Nayara - 416814215.jpeg', author: 'Nayara', license: 'CC BY 4.0',
  }),
  whiteFrontedAmazon: photo({
    base: '/images/animals/white-fronted-amazon', widths: [480, 800], ratio: 4 / 3,
    file: 'Amazona-albifrons.jpg', author: 'Penkinvaltaaja', license: 'CC BY-SA 4.0',
  }),
  madagascarGiantDayGecko: photo({
    base: '/images/animals/madagascar-giant-day-gecko', widths: [480, 800], ratio: 4 / 3,
    file: 'Madagascar giant day gecko (Phelsuma grandis) Nosy Komba.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  whitesTreeFrog: photo({
    base: '/images/animals/whites-tree-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Australia green tree frog (Litoria caerulea) crop.jpg', author: 'LiquidGhoul', license: 'Domaine public',
  }),
  capybara: photo({
    base: '/images/animals/capybara', widths: [480, 800], ratio: 4 / 3,
    file: 'Capivara (Hydrochoerus hydrochaeris).jpg', author: 'Clodomiro Esteves Junior', license: 'CC BY-SA 4.0',
  }),
  tokayGecko: photo({
    base: '/images/animals/tokay-gecko', widths: [480, 800], ratio: 4 / 3,
    file: 'Tokay Gecko (Gekko gecko) (7109782823).jpg', author: 'Bernard DUPONT', license: 'CC BY-SA 2.0',
  }),
  meerkat: photo({
    base: '/images/animals/meerkat', widths: [480, 800], ratio: 4 / 3,
    file: 'Meerkat (Suricata suricatta) Tswalu.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  eclectus: photo({
    base: '/images/animals/eclectus', widths: [480, 800], ratio: 4 / 3,
    file: 'Eclectus roratus -National Zoo, Washington, USA -female-8a.jpg', author: 'angela n.', license: 'CC BY 2.0',
  }),
  emu: photo({
    base: '/images/animals/emu', widths: [480, 800], ratio: 4 / 3,
    file: 'Emu 1 - Tidbinbilla.jpg', author: 'JJ Harrison', license: 'CC BY-SA 4.0',
  }),
  bluePeafowl: photo({
    base: '/images/animals/blue-peafowl', widths: [480, 800], ratio: 4 / 3,
    file: 'Pfau imponierend.jpg', author: 'BS Thurner Hof', license: 'CC BY-SA 3.0',
  }),
  goldenPheasant: photo({
    base: '/images/animals/golden-pheasant', widths: [480, 800], ratio: 4 / 3,
    file: 'Golden Pheasant, Tangjiahe Nature Reserve.jpg', author: 'Jmhullot', license: 'CC BY 3.0',
  }),
  gouldianFinch: photo({
    base: '/images/animals/gouldian-finch', widths: [480, 800], ratio: 4 / 3,
    file: 'Chloebia gouldiae, Elsey, Northern Territory, Australia 1.jpg', author: 'Kym Nicolson', license: 'CC BY 4.0',
  }),
  ornateHornedFrog: photo({
    base: '/images/animals/ornate-horned-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Argentine Horned Frog (Ceratophrys ornata)1.JPG', author: 'Max', license: 'CC BY-SA 4.0',
  }),
  japaneseGiantSalamander: photo({
    base: '/images/animals/japanese-giant-salamander', widths: [480, 800], ratio: 4 / 3,
    file: 'Japanese giant salamander in Tottori Prefecture, Japan.jpg', author: 'Salamandra2021', license: 'CC BY-SA 4.0',
  }),
  leafInsect: photo({
    base: '/images/animals/leaf-insect', widths: [480, 800], ratio: 4 / 3,
    file: 'Phyllium Philippinicum.jpg', author: 'Ebe.wiki', license: 'CC BY-SA 4.0',
  }),
  giantAfricanSnail: photo({
    base: '/images/animals/giant-african-snail', widths: [480, 800], ratio: 4 / 3,
    file: 'Giant African land snail (Achatina fulica) Ranomafana.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  giantMillipede: photo({
    base: '/images/animals/giant-millipede', widths: [480, 800], ratio: 4 / 3,
    file: 'Archispirostreptus-Gigas-Amphitheatre.jpg', author: 'Bjørn Christian Tørrissen', license: 'CC BY-SA 3.0',
  }),
  fireSalamander: photo({
    base: '/images/animals/fire-salamander', widths: [480, 800], ratio: 4 / 3,
    file: 'A fire salamander (Salamandra salamandra).jpg', author: 'Vasyl Krasnoshtan', license: 'CC BY 4.0',
  }),
  tomatoFrog: photo({
    base: '/images/animals/tomato-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Dyscophus antongilii 186311549.jpg', author: 'Marius Burger', license: 'CC0',
  }),
  bumblebeePoisonFrog: photo({
    base: '/images/animals/bumblebee-poison-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Bumblebee Poison Frog Dendrobates leucomelas.jpg', author: 'Holger Krisp', license: 'CC BY 3.0',
  }),
  cranwellsHornedFrog: photo({
    base: '/images/animals/cranwells-horned-frog', widths: [480, 800], ratio: 4 / 3,
    file: 'Ceratophrys cranwell.jpg', author: 'Daiju Azuma', license: 'CC BY-SA 2.5',
  }),
  phelsumaMadagascar: photo({
    base: '/images/animals/phelsuma-madagascar', widths: [480, 800], ratio: 4 / 3,
    file: 'Phelsuma madagascariensis vivarium Lausanne.jpg', author: 'Gzzz', license: 'CC BY-SA 3.0',
  }),
  satanicLeafTailedGecko: photo({
    base: '/images/animals/satanic-leaf-tailed-gecko', widths: [480, 800], ratio: 4 / 3,
    file: 'Satanic leaf-tailed gecko (Uroplatus phantasticus) Ranomafana 2.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  antillesIguana: photo({
    base: '/images/animals/antilles-iguana', widths: [480, 800], ratio: 4 / 3,
    file: 'Iguana delicatissima in Coulibistrie e04.jpg', author: 'Postdlf', license: 'CC BY-SA 3.0',
  }),
  greenAnole: photo({
    base: '/images/animals/green-anole', widths: [480, 800], ratio: 4 / 3,
    file: 'Anolis carolinensis mating.JPG', author: 'Cowenby', license: 'CC BY-SA 3.0',
  }),
  knightAnole: photo({
    base: '/images/animals/knight-anole', widths: [480, 800], ratio: 4 / 3,
    file: 'Knight Anole hunting.jpg', author: 'James Powers', license: 'CC BY-SA 4.0',
  }),
  greenBasilisk: photo({
    base: '/images/animals/green-basilisk', widths: [480, 800], ratio: 4 / 3,
    file: 'Plumedbasiliskcele4.jpg', author: 'Marcel Burkhard / Cele4', license: 'CC BY-SA 3.0',
  }),
  jacksonsChameleon: photo({
    base: '/images/animals/jacksons-chameleon', widths: [480, 800], ratio: 4 / 3,
    file: "Male Jackson's Chameleon - Big Island Hawaii June 12 2025.jpg", author: 'AMMuench', license: 'CC BY 4.0',
  }),
  parsonsChameleon: photo({
    base: '/images/animals/parsons-chameleon', widths: [480, 800], ratio: 4 / 3,
    file: "Parson's chameleon (Calumma parsonii cristifer) female Andasibe 2.jpg", author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  komodoDragon: photo({
    base: '/images/animals/komodo-dragon', widths: [480, 800], ratio: 4 / 3,
    file: 'Komodo dragon (Varanus komodoensis) 2.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  argentineTegu: photo({
    base: '/images/animals/argentine-tegu', widths: [480, 800], ratio: 4 / 3,
    file: 'Argentine Black and White Tegu (Salvator merianae) male - Flickr - berniedup.jpg', author: 'Bernard DUPONT', license: 'CC BY-SA 2.0',
  }),
  frillNeckedLizard: photo({
    base: '/images/animals/frill-necked-lizard', widths: [480, 800], ratio: 4 / 3,
    file: 'Frill-necked Lizard (Chlamydosaurus kingii) (8692607976).jpg', author: 'Matt from Melbourne', license: 'CC BY 2.0',
  }),
  ocellatedLizard: photo({
    base: '/images/animals/ocellated-lizard', widths: [480, 800], ratio: 4 / 3,
    file: 'Jewelled Lizard (Timon lepidus) female (found by Jean NICOLAS) - Flickr - berniedup (1).jpg', author: 'Bernard DUPONT', license: 'CC BY-SA 2.0',
  }),
  emeraldTreeBoa: photo({
    base: '/images/animals/emerald-tree-boa', widths: [480, 800], ratio: 4 / 3,
    file: 'Emerald Tree Boa 003.jpg', author: 'Ltshears', license: 'CC BY-SA 3.0',
  }),
  milkSnake: photo({
    base: '/images/animals/milk-snake', widths: [480, 800], ratio: 4 / 3,
    file: 'Eastern Milksnake (Lampropeltis triangulum) - Flickr - 2ndPeter (2).jpg', author: 'Peter Paplanus', license: 'CC BY 2.0',
  }),
  hognoseSnake: photo({
    base: '/images/animals/hognose-snake', widths: [480, 800], ratio: 4 / 3,
    file: 'Plains Hognose Snake (Heterodon nasicus) (29833441881).jpg', author: 'Peter Paplanus', license: 'CC BY 2.0',
  }),
  blackNeonTetra: photo({
    base: '/images/animals/black-neon-tetra', widths: [480, 800], ratio: 4 / 3,
    file: 'Hyphessobrycon herbertaxelrodi Gratwicke.jpg', author: 'Brian Gratwicke', license: 'CC BY 2.0',
  }),
  lemonTetra: photo({
    base: '/images/animals/lemon-tetra', widths: [480, 800], ratio: 4 / 3,
    file: 'Hyphessobrycon pulchripinnis.jpg', author: 'Waugsberg', license: 'CC BY 2.5',
  }),
  emperorTetra: photo({
    base: '/images/animals/emperor-tetra', widths: [480, 800], ratio: 4 / 3,
    file: 'Nematobrycon palmeri lateral view.jpg', author: 'AggieFish', license: 'CC BY-SA 4.0',
  }),
  congoTetra: photo({
    base: '/images/animals/congo-tetra', widths: [480, 800], ratio: 4 / 3,
    file: 'Phenacogrammus interruptus 1.jpg', author: '7TP (Krzysztof Bartosik)', license: 'CC BY-SA 4.0',
  }),
  blackPhantomTetra: photo({
    base: '/images/animals/black-phantom-tetra', widths: [480, 800], ratio: 4 / 3,
    file: 'Hyphessobrycon megalopterus (31473-B).png', author: 'D. Bork, A. Zarske, H.J. Richter', license: 'CC BY 4.0',
  }),
  oscarCichlid: photo({
    base: '/images/animals/oscar-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Astronotus ocellatus 2015 G1.jpg', author: 'George Chernilevsky', license: 'Domaine public',
  }),
  jackDempseyCichlid: photo({
    base: '/images/animals/jack-dempsey-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Jack Dempsey (Rocio octofasciata) - Carwash Cenote QR.jpg', author: 'Bernard DUPONT', license: 'CC BY-SA 2.0',
  }),
  parrotCichlid: photo({
    base: '/images/animals/parrot-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Amphilophus citrinellus 2015 G5.jpg', author: 'George Chernilevsky', license: 'CC BY-SA 4.0',
  }),
  frontosaCichlid: photo({
    base: '/images/animals/frontosa-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Cyphotilapia frontosa - Karlsruhe Zoo 01.jpg', author: 'H. Zell', license: 'CC BY-SA 3.0',
  }),
  zebraCichlid: photo({
    base: '/images/animals/zebra-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Maylandia zebra 61728832.jpg', author: 'Kai Squires', license: 'CC BY 4.0',
  }),
  yellowLabCichlid: photo({
    base: '/images/animals/yellow-lab-cichlid', widths: [480, 800], ratio: 4 / 3,
    file: 'Female Labidochromis caeruleus light.jpg', author: 'BRKOSLAV SEVERNÍ', license: 'CC0',
  }),
  cherryBarb: photo({
    base: '/images/animals/cherry-barb', widths: [480, 800], ratio: 4 / 3,
    file: 'Cherry barb, Puntius titteya.jpg', author: 'Brian Gratwicke', license: 'CC BY 2.0',
  }),
  tigerBarb: photo({
    base: '/images/animals/tiger-barb', widths: [480, 800], ratio: 4 / 3,
    file: 'Tiger barb fish.jpg', author: 'Editor General of Wiki', license: 'CC BY-SA 4.0',
  }),
  whiteCockatoo: photo({
    base: '/images/animals/white-cockatoo', widths: [480, 800], ratio: 4 / 3,
    file: 'Burung Kakatua Putih Di THKMS.jpg', author: 'Muhamad Izzul Fiqih', license: 'CC BY-SA 4.0',
  }),
  smallClawedOtter: photo({
    base: '/images/animals/small-clawed-otter', widths: [480, 800], ratio: 4 / 3,
    file: 'Asian small-clawed otter (Aonyx cinereus) in Zooparc de Trégomeur, 2025.jpg', author: 'Animalculum', license: 'CC BY 4.0',
  }),
  americanMink: photo({
    base: '/images/animals/american-mink', widths: [480, 800], ratio: 4 / 3,
    file: 'Mink (Neovison vison).jpg', author: 'Marton Berntsen', license: 'CC BY-SA 3.0',
  }),
  vizcacha: photo({
    base: '/images/animals/vizcacha', widths: [480, 800], ratio: 4 / 3,
    file: 'Bolivian vizcacha.jpg', author: 'Alexandre Buisse ( Nattfodd )', license: 'CC BY-SA 3.0',
  }),
  pygmyOpossum: photo({
    base: '/images/animals/pygmy-opossum', widths: [480, 800], ratio: 4 / 3,
    file: 'Monodelphis domestica 175946692.jpg', author: 'Célio Moura Neto', license: 'CC BY 4.0',
  }),
  harvestMouse: photo({
    base: '/images/animals/harvest-mouse', widths: [480, 800], ratio: 4 / 3,
    file: 'Harvest mouse and blossom.jpg', author: 'Charlie Marshall', license: 'CC BY 2.0',
  }),
  commonMarmoset: photo({
    base: '/images/animals/common-marmoset', widths: [480, 800], ratio: 4 / 3,
    file: 'Callithrix jacchus in Parque Bondinho Pão de Açúcar, Rio de Janeiro.jpg', author: 'Wilfredor', license: 'CC0',
  }),
  agouti: photo({
    base: '/images/animals/agouti', widths: [480, 800], ratio: 4 / 3,
    file: 'Dasyprocta leporina 46671643.jpg', author: 'Paul Prior', license: 'CC BY 4.0',
  }),
  mara: photo({
    base: '/images/animals/mara', widths: [480, 800], ratio: 4 / 3,
    file: 'Dolichotis patagonum 99386074.jpg', author: 'Hugo Hulsberg', license: 'CC0',
  }),
  redShoulderedMacaw: photo({
    base: '/images/animals/red-shouldered-macaw', widths: [480, 800], ratio: 4 / 3,
    file: 'Red-shouldered Macaw (Diopsittaca nobilis) (Record shot) (28696491836).jpg', author: 'Bernard DUPONT  from FRANCE', license: 'CC BY-SA 2.0',
  }),
  greenCheekedConure: photo({
    base: '/images/animals/green-cheeked-conure', widths: [480, 800], ratio: 4 / 3,
    file: 'Green-cheeked Parakeet (Pyrrhura molinae molinae), Narciso Campero, Bolivia 1.jpg', author: 'sandykeller', license: 'CC BY 4.0',
  }),
  sunConure: photo({
    base: '/images/animals/sun-conure', widths: [480, 800], ratio: 4 / 3,
    file: 'Sun parakeet (Aratinga solstitialis) at Perth Zoo, June 2023 06.jpg', author: 'Calistemon', license: 'CC BY-SA 4.0',
  }),
  galah: photo({
    base: '/images/animals/galah', widths: [480, 800], ratio: 4 / 3,
    file: 'Galah (Eolophus roseicapilla) female in flight Mount Pleasant.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  javaSparrow: photo({
    base: '/images/animals/java-sparrow', widths: [480, 800], ratio: 4 / 3,
    file: 'Java sparrow condo in kihei 7.10.24 DSC 7783-topaz-denoiseraw.jpg', author: 'lwolfartist', license: 'CC BY 2.0',
  }),
  northernCardinal: photo({
    base: '/images/animals/northern-cardinal', widths: [480, 800], ratio: 4 / 3,
    file: 'Male northern cardinal in Central Park (52612).jpg', author: 'Rhododendrites', license: 'CC BY-SA 4.0',
  }),
  mandarinDuck: photo({
    base: '/images/animals/mandarin-duck', widths: [480, 800], ratio: 4 / 3,
    file: 'Aix galericulata (Male), Richmond Park, UK - May 2013.jpg', author: 'Diliff', license: 'CC BY 3.0',
  }),
  redSquirrel: photo({
    base: '/images/animals/red-squirrel', widths: [480, 800], ratio: 4 / 3,
    file: 'Red squirrel (21808).jpg', author: 'Rhododendrites', license: 'CC BY-SA 4.0',
  }),
  raccoon: photo({
    base: '/images/animals/raccoon', widths: [480, 800], ratio: 4 / 3,
    file: 'Raccoon in Central Park (35264).jpg', author: 'Rhododendrites', license: 'CC BY-SA 4.0',
  }),
  coati: photo({
    base: '/images/animals/coati', widths: [480, 800], ratio: 4 / 3,
    file: 'Coati2.jpg', author: 'Luna04', license: 'CC BY-SA 3.0',
  }),
  serval: photo({
    base: '/images/animals/serval', widths: [480, 800], ratio: 4 / 3,
    file: 'Leptailurus serval 61666728.jpg', author: 'datadan', license: 'CC BY 4.0',
  }),
  genet: photo({
    base: '/images/animals/genet', widths: [480, 800], ratio: 4 / 3,
    file: 'Genetta genetta felina (Wroclaw zoo).JPG', author: 'Guérin Nicolas', license: 'CC BY-SA 3.0',
  }),
  europeanOtter: photo({
    base: '/images/animals/european-otter', widths: [480, 800], ratio: 4 / 3,
    file: 'European otter 01.jpg', author: 'Alexander Leisser', license: 'CC BY-SA 4.0',
  }),
  sugarGlider: photo({
    base: '/images/animals/sugar-glider', widths: [480, 800], ratio: 4 / 3,
    file: 'Petaurus breviceps 119464446.jpg', author: 'Greg Tasney', license: 'CC BY-SA 4.0',
  }),
  flyingSquirrel: photo({
    base: '/images/animals/flying-squirrel', widths: [480, 800], ratio: 4 / 3,
    file: 'Pteromys volans 292232567.jpg', author: 'Andrew Bazdyrev', license: 'CC BY 4.0',
  }),
  chinesePangolin: photo({
    base: '/images/animals/chinese-pangolin', widths: [480, 800], ratio: 4 / 3,
    file: 'Manis pentadactyla pentadactyla 462300623.jpg', author: 'Yung-Lun Lin', license: 'CC BY 4.0',
  }),
  alpaca: photo({
    base: '/images/animals/alpaca', widths: [480, 800], ratio: 4 / 3,
    file: 'Dülmen, Börnste, Alpakas -- 2020 -- 5462.jpg', author: 'Dietmar Rabich', license: 'CC BY-SA 4.0',
  }),
  scarletMacaw: photo({
    base: '/images/animals/scarlet-macaw', widths: [480, 800], ratio: 4 / 3,
    file: 'Scarlet macaw (Ara macao cyanopterus) Copan.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  militaryMacaw: photo({
    base: '/images/animals/military-macaw', widths: [480, 800], ratio: 4 / 3,
    file: 'Ara militaris - Maroparque 02.jpg', author: 'H. Zell', license: 'CC BY-SA 3.0',
  }),
  sulphurCrestedCockatoo: photo({
    base: '/images/animals/sulphur-crested-cockatoo', widths: [480, 800], ratio: 4 / 3,
    file: 'Sulphur-crested Cockatoo - AndrewMercer - DSC20087.jpg', author: 'Andrew Mercer', license: 'CC BY-SA 4.0',
  }),
  senegalParrot: photo({
    base: '/images/animals/senegal-parrot', widths: [480, 800], ratio: 4 / 3,
    file: 'Poicephalus senegalus, Fulladu West, Gambia 1.jpg', author: 'christoph_moning', license: 'CC BY 4.0',
  }),
  europeanEagleOwl: photo({
    base: '/images/animals/european-eagle-owl', widths: [480, 800], ratio: 4 / 3,
    file: 'Eurasian eagle-owl (44034).jpg', author: 'Rhododendrites', license: 'CC BY-SA 4.0',
  }),
  cardinalTetra: photo({
    base: '/images/animals/cardinal-tetra', widths: [480, 800], ratio: 2296 / 1913,
    file: 'Cardinal Paracheirodon axelrodi (2).jpg', author: 'CHUCAO', license: 'CC BY-SA 3.0',
  }),
  discus: photo({
    base: '/images/animals/discus', widths: [480, 800], ratio: 1741 / 1832,
    file: 'Red discus (Symphysodon discus).jpg', author: 'MichalPL', license: 'CC BY-SA 4.0',
  }),
  convictCichlid: photo({
    base: '/images/animals/convict-cichlid', widths: [480, 800], ratio: 3456 / 2304,
    file: 'Convicts Cichlids.jpg', author: 'Deanpemberton', license: 'CC BY-SA 3.0',
  }),
  rosyBarb: photo({
    base: '/images/animals/rosy-barb', widths: [480, 800], ratio: 3888 / 2588,
    file: 'Rosy Barbs.jpg', author: 'Kkonstan', license: 'CC BY 3.0',
  }),
  giantDanio: photo({
    base: '/images/animals/giant-danio', widths: [480, 800], ratio: 2272 / 1704,
    file: 'Devario aequipinnatus.JPG', author: 'Faucon', license: 'CC BY-SA 2.5',
  }),
  swordtail: photo({
    base: '/images/animals/swordtail', widths: [480, 800], ratio: 3060 / 2040,
    file: 'Xiphophorus hellerii red wagtail female 01.jpg', author: 'Wojciech J. Płuciennik', license: 'CC BY-SA 4.0',
  }),
  sterbaiCorydoras: photo({
    base: '/images/animals/sterbai-corydoras', widths: [480, 800], ratio: 2640 / 1760,
    file: 'Corydoras Sterbai.jpg', author: 'Matthew Mannell', license: 'Domaine public',
  }),
  otocinclus: photo({
    base: '/images/animals/otocinclus', widths: [480, 800], ratio: 2433 / 1825,
    file: 'Macrotocinclus affinis looking for algae.jpg', author: 'Cisamarc', license: 'CC BY-SA 3.0',
  }),
  ancistrus: photo({
    base: '/images/animals/ancistrus', widths: [480, 800], ratio: 1024 / 682,
    file: 'Ancistrus cirrhosus.jpg', author: 'The Last 99', license: 'CC BY-SA 3.0 DE',
  }),
  butterflyfish: photo({
    base: '/images/animals/butterflyfish', widths: [480, 800], ratio: 1280 / 960,
    file: 'Pantodon buchholzi 53146715.jpg', author: 'John P Friel', license: 'CC BY 4.0',
  }),
  archerfish: photo({
    base: '/images/animals/archerfish', widths: [480, 800], ratio: 4847 / 3236,
    file: 'Toxotes jaculatrix - 9313.jpg', author: 'Amada44', license: 'CC BY-SA 3.0',
  }),
  elephantnoseFish: photo({
    base: '/images/animals/elephantnose-fish', widths: [480, 800], ratio: 1132 / 849,
    file: 'Gnathonemus petersii - Zoo Frankfurt.jpg', author: 'Jutta234', license: 'CC BY-SA 3.0',
  }),
  categoryMammals: photo({
    base: '/images/categories/mammals', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Dülmen, Hausdülmen, Golden Retriever -- 2022 -- 5945.jpg", author: "Dietmar Rabich", license: "CC BY-SA 4.0",
  }),
  categoryBirds: photo({
    base: '/images/categories/birds', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Ara ararauna qtl3.jpg", author: "Quartl", license: "CC BY-SA 3.0",
  }),
  categoryFish: photo({
    base: '/images/categories/fish', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Betta-splendens-male.jpg", author: "Denise Chan", license: "CC BY-SA 2.0",
  }),
  categoryReptiles: photo({
    base: '/images/categories/reptiles', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Panther chameleon (Furcifer pardalis) male Montagne d’Ambre 2.jpg", author: "Charles J. Sharp", license: "CC BY-SA 4.0",
  }),
  categoryAmphibians: photo({
    base: '/images/categories/amphibians', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Red-eyed Leaf Frog (Agalychnis callidryas) (9362143274).jpg", author: "Pavel Kirillov", license: "CC BY-SA 2.0",
  }),
  categoryInsects: photo({
    base: '/images/categories/insects', widths: [640, 1200, 1600], ratio: 16 / 9,
    file: "Monarch butterfly in BBG (84685).jpg", author: "Rhododendrites", license: "CC BY-SA 4.0",
  }),
  textureFur: photo({
    base: "/images/textures/mammals", widths: [800], ratio: 800 / 550,
    file: "Greyhound fur brindle.jpg", author: "Scott Robinson from Rockville, MD, USA", license: "CC BY 2.0", changes: 'mirror',
  }),
  textureFeathers: photo({
    base: "/images/textures/birds", widths: [800], ratio: 800 / 550,
    file: "Flamingo-feathers-layered-texture-pink-minimal.jpg", author: "Marc-Julien-Photography", license: "CC BY-SA 4.0", changes: 'mirror',
  }),
  textureFishScales: photo({
    base: '/images/textures/fish', widths: [800], ratio: 800 / 550,
    file: "Erwin NFH rainbow trout scales 7 March 2022.png", author: "Ryan Hagerty/USFWS", license: 'Domaine public', changes: 'mirror',
  }),
  textureReptileScales: photo({
    base: "/images/textures/reptiles", widths: [800], ratio: 800 / 550,
    file: "Eye of Lizard (55203172463).jpg", author: "Willie Luker from USA", license: "CC BY 4.0", changes: 'mirror',
  }),
  textureInsectWing: photo({
    base: "/images/textures/insects", widths: [800], ratio: 800 / 550,
    file: "2021-08-16 - Peacock butterfly (Aglais io) - eyespot on forewing - colourful scales - DSG3404-1 (magnif. ratio 2.2x, HiRes focus stack).jpg", author: "Franz van Duns", license: "CC BY-SA 4.0", changes: 'mirror',
  }),
  textureAmphibianSkin: photo({
    base: "/images/textures/amphibians", widths: [800], ratio: 800 / 550,
    file: "Dendrobates tinctorius - Wilhelma.jpg", author: "H. Zell", license: "CC BY-SA 3.0", changes: 'mirror',
  }),
  guideAquariumFilter: photo({
    base: '/images/guides/aquarium-filter', widths: [480, 800, 1200], ratio: 370 / 236,
    file: 'Aquarium-Au enfilter.svg', author: 'Fred the Oyster', license: 'CC BY-SA 4.0', changes: 'resize',
  }),
  guideNitrogenCycle: photo({
    base: '/images/guides/nitrogen-cycle', widths: [480, 800, 1200], ratio: 601 / 383,
    file: 'Aquarium Nitrogen Cycle.svg', author: 'Ilmari Karonen', license: 'Domaine public', changes: 'resize',
  }),
  mossForest: photo({
    base: '/images/nature/moss-forest', widths: [640, 960, 1280], ratio: 16 / 9,
    file: 'Mossy forest in Lierneux (DSC01260).jpg', author: 'Trougnouf (Benoit Brummer)', license: 'CC BY 4.0', changes: 'soften',
  }),
  grassDroplets: photo({
    base: '/images/nature/grass-droplets', widths: [800, 1200, 1600], ratio: 16 / 9,
    file: 'Grass blades with water droplets, Parque Florestal de Monsanto, Lisbon, Portugal (approx. GPS location) julesvernex2.jpg',
    author: 'Jules Verne Times Two', license: 'CC BY-SA 4.0',
  }),
  lemonBalm: photo({
    base: '/images/nature/lemon-balm', widths: [640, 960, 1280], ratio: 16 / 9,
    file: 'Mélisse Feuilles FR 2013b.jpg', author: 'JLPC / Wikimedia Commons', license: 'CC BY-SA 3.0', changes: 'soften',
  }),

  aardvark: photo({
    base: '/images/animals/aardvark', widths: [480, 800], ratio: 4 / 3,
    file: 'Aardvark (Orycteropus afer).jpg', author: "Theo Kruse / Burgers' Zoo", license: 'CC BY-SA 4.0',
  }),
  kinkajou: photo({
    base: '/images/animals/kinkajou', widths: [480, 800], ratio: 4 / 3,
    file: 'Potos flavus 181925589.jpg', author: 'desertnaturalist', license: 'CC BY 4.0',
  }),
  greySquirrel: photo({
    base: '/images/animals/grey-squirrel', widths: [480, 800], ratio: 4 / 3,
    file: 'Grey Squirrel Sciurus Carolinensis Autumn Stowe Gardens 2025 01.jpg', author: 'Julian Herzog (Website)', license: 'CC BY 4.0',
  }),
  cottontopTamarin: photo({
    base: '/images/animals/cottontop-tamarin', widths: [480, 800], ratio: 4 / 3,
    file: 'Saguinus oedipus qtl1.jpg', author: 'Quartl', license: 'CC BY-SA 3.0',
  }),
  caracal: photo({
    base: '/images/animals/caracal', widths: [480, 800], ratio: 4 / 3,
    file: 'Caracal caracal 289309438.jpg', author: 'Dirk Froebel', license: 'CC BY 4.0',
  }),
  ocelot: photo({
    base: '/images/animals/ocelot', widths: [480, 800], ratio: 4 / 3,
    file: '082 Ocelot in Encontro das Águas State Park Photo by Giles Laurent.jpg', author: 'Giles Laurent', license: 'CC BY-SA 4.0',
  }),
  binturong: photo({
    base: '/images/animals/binturong', widths: [480, 800], ratio: 4 / 3,
    file: 'Arctictis binturong Ménagerie 20250913.jpg', author: 'Marie-Lan Taÿ Pamart', license: 'CC BY 4.0',
  }),
  egyptianMongoose: photo({
    base: '/images/animals/egyptian-mongoose', widths: [480, 800], ratio: 4 / 3,
    file: 'Mongoose - Herpestes ichneumon.jpg', author: 'Artemy Voikhansky', license: 'CC BY-SA 4.0',
  }),
  crestedPorcupine: photo({
    base: '/images/animals/crested-porcupine', widths: [480, 800], ratio: 4 / 3,
    file: '0 Hystrix cristata - Porc-épics à crête (1).JPG', author: 'Jean-Pol GRANDMONT', license: 'CC BY-SA 3.0',
  }),
  paca: photo({
    base: '/images/animals/paca', widths: [480, 800], ratio: 4 / 3,
    file: 'Cuniculus paca 53854000.jpg', author: 'Matt Muir', license: 'CC BY-SA 4.0',
  }),
  turquoiseParrot: photo({
    base: '/images/animals/turquoise-parrot', widths: [480, 800], ratio: 4 / 3,
    file: 'Neophema pulchella male - Glen Davis.jpg', author: 'JJ Harrison (jjharrison.com.au)', license: 'CC BY-SA 4.0',
  }),
  maskedLovebird: photo({
    base: '/images/animals/masked-lovebird', widths: [480, 800], ratio: 4 / 3,
    file: 'Agapornis personatus, TZ.jpg', author: 'Raf24~commonswiki', license: 'CC BY-SA 4.0',
  }),
  rainbowLorikeet: photo({
    base: '/images/animals/rainbow-lorikeet', widths: [480, 800], ratio: 4 / 3,
    file: 'Rainbow lorikeet (Trichoglossus moluccanus) sitting in a hole in a dead tree along the Swan River, October 2023 02.jpg', author: 'Calistemon', license: 'CC BY-SA 4.0',
  }),
  orangeClownfish: photo({
    base: '/images/animals/orange-clownfish', widths: [480, 800], ratio: 2200 / 1499,
    file: 'Amphiprion ocellaris (Clown anemonefish) by Nick Hobgood.jpg', author: 'Nick Hobgood', license: 'CC BY-SA 3.0',
  }),
  koi: photo({
    base: '/images/animals/koi', widths: [480, 800], ratio: 3872 / 2592,
    file: 'Loro Parque Koi3.JPG', author: 'Eistreter', license: 'CC BY-SA 3.0',
  }),
  dwarfGourami: photo({
    base: '/images/animals/dwarf-gourami', widths: [480, 800], ratio: 2016 / 1352,
    file: 'Colisa lalia - side (aka).jpg', author: 'André Karwath aka Aka', license: 'CC BY-SA 2.5',
  }),
  australeKillifish: photo({
    base: '/images/animals/australe-killifish', widths: [480, 800], ratio: 1743 / 1307,
    file: 'Aphyosemion australe gold.jpg', author: 'Alexander Prokoshev', license: 'CC BY-SA 3.0',
  }),
  glassCatfish: photo({
    base: '/images/animals/glass-catfish', widths: [480, 800], ratio: 5184 / 2912,
    file: 'Kryptopterus vitreolus.jpg', author: '-serwacy01-', license: 'CC BY-SA 4.0',
  }),
  commonToad: photo({
    base: '/images/animals/common-toad', widths: [480, 800], ratio: 3232 / 2084,
    file: 'Bufo-bufo-erdkroete-maennlich.jpg', author: 'Holger Krisp', license: 'CC BY 3.0',
  }),
  xenopus: photo({
    base: '/images/animals/xenopus', widths: [480, 800], ratio: 4493 / 2889,
    file: 'XenopusLaevis 6473.jpg', author: 'Davefoc', license: 'CC BY-SA 4.0',
  }),
  europeanTreefrog: photo({
    base: '/images/animals/european-tree-frog', widths: [480, 800], ratio: 2077 / 1438,
    file: 'Hyla arborea, juv 2.jpg', author: 'Christian Fischer', license: 'CC BY-SA 3.0',
  }),
  caneToad: photo({
    base: '/images/animals/cane-toad', widths: [480, 800], ratio: 1,
    file: 'Rhinella marina near rainwater pools 7th Brigade Park Chermside P1090820.jpg', author: 'John Robert McPherson', license: 'CC BY-SA 4.0',
  }),
  strawberryDartFrog: photo({
    base: '/images/animals/strawberry-dart-frog', widths: [480, 800], ratio: 2048 / 1356,
    file: 'Oophaga pumilio 33426838.jpg', author: 'Lara Maleen Beckmann', license: 'CC BY 4.0',
  }),
  prayingMantis: photo({
    base: '/images/animals/praying-mantis', widths: [480, 800], ratio: 4606 / 2845,
    file: 'European praying mantis (Mantis religiosa) green female Dobruja.jpg', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0',
  }),
  goliathTarantula: photo({
    base: '/images/animals/goliath-tarantula', widths: [480, 800], ratio: 1365 / 2048,
    file: 'Theraphosa blondi 244519965.jpg', author: 'Guillaume Delaitre', license: 'CC BY 4.0',
  }),
  grammostolaRosea: photo({
    base: '/images/animals/grammostola-rosea', widths: [480, 800], ratio: 2971 / 3961,
    file: 'Spiders Genova - Grammostola rosea 1.jpg', author: 'Syrio', license: 'CC BY-SA 4.0',
  }),
  caribbeanHermitCrab: photo({
    base: '/images/animals/caribbean-hermit-crab', widths: [480, 800], ratio: 2048 / 1537,
    file: 'Coenobita clypeatus 177457464.jpg', author: 'Dan Schofield', license: 'CC BY 4.0',
  }),
  giantWoodlouse: photo({
    base: '/images/animals/giant-woodlouse', widths: [480, 800], ratio: 2512 / 3688,
    file: 'Porcellio laevis Rufino cropped.jpg', author: 'Stephan Kleinfelder', license: 'CC BY-SA 4.0',
  }),
  llama: photo({ base: '/images/animals/llama', widths: [480, 800], ratio: 4 / 3, file: 'Lama glama Laguna Colorada 2.jpg', author: 'kallerna', license: 'CC BY-SA 4.0' }),
  ringTailedLemur: photo({ base: '/images/animals/ring-tailed-lemur', widths: [480, 800], ratio: 4 / 3, file: 'Lemur catta 001.jpg', author: 'Alex Dunkel ( Maky )', license: 'CC BY 3.0' }),
  bennettsWallaby: photo({ base: '/images/animals/bennetts-wallaby', widths: [480, 800], ratio: 4 / 3, file: 'Macropus rufogriseus rufogriseus Juvenile 2.jpg', author: 'JJ Harrison (https://www.jjharrison.com.au/)', license: 'CC BY-SA 3.0' }),
  muskOx: photo({ base: '/images/animals/musk-ox', widths: [480, 800], ratio: 4 / 3, file: 'Ovibos moschatus qtl3.jpg', author: 'Quartl', license: 'CC BY-SA 3.0' }),
  sikaDeer: photo({ base: '/images/animals/sika-deer', widths: [480, 800], ratio: 4 / 3, file: 'Sika Deer in Nara Park, Japan.jpg', author: 'Arczi', license: 'CC BY 4.0' }),
  fallowDeer: photo({ base: '/images/animals/fallow-deer', widths: [480, 800], ratio: 4 / 3, file: 'Persian Fallow Deer 1.jpg', author: 'Eyal Bartov', license: 'CC BY-SA 3.0' }),
  bourkesParakeet: photo({ base: '/images/animals/bourkes-parakeet', widths: [480, 800], ratio: 4 / 3, file: 'Neophema bourkii 121274727.jpg', author: 'Kym Nicolson', license: 'CC BY 4.0' }),
  lavenderWaxbill: photo({ base: '/images/animals/lavender-waxbill', widths: [480, 800], ratio: 4 / 3, file: 'Lavender Waxbill RWD.jpg', author: 'DickDaniels (http://carolinabirds.org/)', license: 'CC BY-SA 3.0' }),
  japaneseBunting: photo({ base: '/images/animals/japanese-bunting', widths: [480, 800], ratio: 4 / 3, file: 'Emberiza cioides male.JPG', author: 'Alpsdake', license: 'CC BY-SA 3.0' }),
  diamondDove: photo({ base: '/images/animals/diamond-dove', widths: [480, 800], ratio: 4 / 3, file: 'Geopelia cuneata -Pilbara, Western Australia, Australia-8 (1).jpg', author: 'Jim Bendon from Karratha, Australia', license: 'CC BY-SA 2.0' }),
  mallard: photo({ base: '/images/animals/mallard', widths: [480, 800], ratio: 4 / 3, file: 'Anas platyrhynchos (Male) on the ground.jpg', author: 'Commonists', license: 'CC BY-SA 4.0' }),
  woodDuck: photo({ base: '/images/animals/wood-duck', widths: [480, 800], ratio: 4 / 3, file: 'Wood duck druid ridge cemetery 10.10.20 DSC 6035.jpg', author: 'lwolfartist', license: 'CC BY 2.0' }),
  japaneseQuail: photo({ base: '/images/animals/japanese-quail', widths: [480, 800], ratio: 4 / 3, file: 'Japanese Quail.jpg', author: 'Ingrid Taylar', license: 'CC BY 2.0' }),
  muteSwan: photo({ base: '/images/animals/mute-swan', widths: [480, 800], ratio: 4 / 3, file: 'Mute Swan Emsworth2.JPG', author: 'Geni', license: 'CC BY-SA 4.0' }),
  tocoToucan: photo({ base: '/images/animals/toco-toucan', widths: [480, 800], ratio: 4 / 3, file: 'Toco Toucan (Ramphastos toco) - 48153967707.jpg', author: 'Bernard DUPONT', license: 'CC BY-SA 2.0' }),
  dendrobatesAuratus: photo({ base: '/images/animals/dendrobates-auratus', widths: [480, 800], ratio: 1.28128, file: 'Dendrobates auratus - Goldbaumsteiger 203695198.jpg', author: 'snail_hiker', license: 'CC BY 4.0' }),
  dendrobatesAzureus: photo({ base: '/images/animals/dendrobates-azureus', widths: [480, 800], ratio: 1.45455, file: 'Dendrobates azureus qtl1.jpg', author: 'Quartl', license: 'CC BY-SA 3.0' }),
  edibleFrog: photo({ base: '/images/animals/edible-frog', widths: [480, 800], ratio: 1.67979, file: 'Edible frog (Pelophylax esculentus).jpg', author: 'Petar Milošević', license: 'CC BY-SA 4.0' }),
  crestedNewt: photo({ base: '/images/animals/crested-newt', widths: [480, 800], ratio: 1.56288, file: 'Kammmolchmaennchen.jpg', author: 'Rainer Theuer.', license: 'Domaine public' }),
  alpineNewt: photo({ base: '/images/animals/alpine-newt', widths: [480, 800], ratio: 1.50059, file: 'Bergmolch Ichthyosaura alpestris.jpg', author: 'Holger Krisp', license: 'CC BY 3.0' }),
  glassFrog: photo({ base: '/images/animals/glass-frog', widths: [480, 800], ratio: 0.74985, file: 'Hyalinobatrachium valerioi 399304213.jpg', author: 'Nick Tobler (Cowturtle)', license: 'CC BY 4.0' }),
  amazonPoisonFrog: photo({ base: '/images/animals/ameerega-trivittata', widths: [480, 800], ratio: 1.49883, file: 'Ameerega trivittata 257603527.jpg', author: 'Kristof Zyskowski', license: 'CC BY 4.0' }),
  sailfinMolly: photo({ base: '/images/animals/sailfin-molly', widths: [480, 800], ratio: 1.80282, file: 'Poecilia latipinna 170400954.jpg', author: 'Tia Offner', license: 'CC BY 4.0' }),
  blueGourami: photo({ base: '/images/animals/blue-gourami', widths: [480, 800], ratio: 1.33333, file: 'Trichopodus trichopterus (3 spot gourami, Philippines) 01.jpg', author: 'Obsidian Soul', license: 'CC0' }),
  cockatooDwarfCichlid: photo({ base: '/images/animals/cockatoo-cichlid', widths: [480, 800], ratio: 1.33333, file: 'Apistogramma cacatuoides.jpg', author: 'Redspider', license: 'CC BY-SA 3.0' }),
  buenosAiresTetra: photo({ base: '/images/animals/buenos-aires-tetra', widths: [480, 800], ratio: 1.33333, file: 'Hyphessobrycon anisitsi albus.jpg', author: 'Astellar87', license: 'Domaine public' }),
  orangeKneeTarantula: photo({ base: '/images/animals/orange-knee-tarantula', widths: [480, 800], ratio: 1.33333, file: 'Spiders Genova - Brachypelma auratum.jpg', author: 'Syrio', license: 'CC BY-SA 4.0' }),
  pinktoeTarantula: photo({ base: '/images/animals/pinktoe-tarantula', widths: [480, 800], ratio: 0.74985, file: 'Avicularia avicularia.jpg', author: 'BhaalPriestess', license: 'CC BY 4.0' }),
  salmonPinkTarantula: photo({ base: '/images/animals/salmon-tarantula', widths: [480, 800], ratio: 1.33333, file: 'Spiders Genova - Lasiodora parahybana.jpg', author: 'Syrio', license: 'CC BY-SA 4.0' }),
  burgundySnail: photo({ base: '/images/animals/brown-snail', widths: [480, 800], ratio: 1.50059, file: 'Helix pomatia 2026 G1.jpg', author: 'George Chernilevsky', license: 'CC BY 4.0' }),
};

export const PHOTO_KEYS = Object.keys(PHOTOS) as PhotoKey[];

const srcSetOf = (p: Photo, format: 'avif' | 'webp') => p.widths.map((w) => `${p.base}-${w}.${format} ${w}w`).join(', ');

/**
 * Propriétés responsives d'une photo pour `<Figure>` : AVIF puis WebP en `srcset`, repli WebP
 * de largeur moyenne en `src`, crédit obligatoire.
 */
export function photoSources(key: PhotoKey) {
  const p = PHOTOS[key];
  const fallback = p.widths[Math.min(1, p.widths.length - 1)];
  return {
    src: `${p.base}-${fallback}.webp`,
    srcSet: srcSetOf(p, 'webp'),
    sources: [{ type: 'image/avif', srcSet: srcSetOf(p, 'avif') }],
    credit: p.credit,
  };
}
