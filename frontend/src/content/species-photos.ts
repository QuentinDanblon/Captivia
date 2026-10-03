/**
 * Correspondance éditoriale entre taxons exacts et photos déjà vérifiées dans `photos.ts`.
 * Les races partagent souvent un nom latin : elles ne reçoivent une photo que si leur nom
 * vernaculaire identifie exactement la race photographiée.
 */
import { PHOTOS, photoSources, type PhotoKey } from './photos';
import type { SpeciesPhoto } from '@/lib/species';

type CuratedTaxon = { latin: string; names: readonly string[]; photo: PhotoKey; nameMayBeMissing?: boolean };

const TAXA: readonly CuratedTaxon[] = [
  { latin: 'Canis familiaris', names: ['chien', 'chien domestique'], photo: 'dogRiver', nameMayBeMissing: true },
  { latin: 'Canis lupus familiaris', names: ['golden retriever'], photo: 'dogGoldenRetriever' },
  { latin: 'Felis catus', names: ['chat domestique'], photo: 'catStraw', nameMayBeMissing: true },
  { latin: 'Oryctolagus cuniculus', names: ['lapin de garenne'], photo: 'rabbitStraw', nameMayBeMissing: true },
  { latin: 'Nymphicus hollandicus', names: ['perruche calopsite'], photo: 'cockatiels' },
  { latin: 'Melopsittacus undulatus', names: ['perruche ondulée'], photo: 'budgerigars' },
  { latin: 'Eublepharis macularius', names: ['gecko léopard'], photo: 'leopardGecko' },
  { latin: 'Pogona vitticeps', names: ['agame barbu', 'dragon barbu'], photo: 'beardedDragon' },
  { latin: 'Paracheirodon innesi', names: ['néon bleu (tétra néon)', 'tétra néon'], photo: 'neonTetra' },
  { latin: 'Equus caballus', names: ['cheval domestique'], photo: 'horse' },
  { latin: 'Gallus gallus domesticus', names: ['poule domestique'], photo: 'hen' },
];

const key = (value: string) => value.trim().toLocaleLowerCase('fr').normalize('NFC');

/** Photo d'archive locale avec crédit déjà vérifié, seulement pour l'identité éditoriale reconnue. */
export function curatedSpeciesPhoto(latin: string, commonNameFr?: string): SpeciesPhoto | null {
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
