/**
 * Photothèque de la landing : photos Wikimedia Commons sous licence libre vérifiée (API Commons,
 * champ `LicenseShortName`), recadrées et exportées en AVIF + WebP sans métadonnées
 * (`public/images/<dossier>/<slug>-<largeur>.<format>`, plus grande variante ≤ 150 Ko).
 *
 * Chaque entrée est aussi inscrite dans `public/images/CREDITS.md` et listée dans la page
 * « Sources et licences » (section « Photographies »). Les textes alternatifs sont traduits
 * (`landing.photos.<clé>`), le crédit (auteur + licence + lien) est affiché par `Figure`.
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
  changes: 'crop' | 'soften';
}

/** Libellé des modifications, par langue de rédaction des pages légales (fr, sinon en). */
export const PHOTO_CHANGES: Record<'fr' | 'en', Record<Photo['changes'], string>> = {
  fr: {
    crop: 'recadrée, redimensionnée, convertie en AVIF/WebP, métadonnées retirées',
    soften: 'recadrée, légèrement adoucie (texture de fond), redimensionnée, convertie en AVIF/WebP, métadonnées retirées',
  },
  en: {
    crop: 'cropped, resized, converted to AVIF/WebP, metadata removed',
    soften: 'cropped, slightly softened (background texture), resized, converted to AVIF/WebP, metadata removed',
  },
};

const LICENSES = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
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
