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
  | 'mossForest'
  | 'grassDroplets'
  | 'lemonBalm';

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
