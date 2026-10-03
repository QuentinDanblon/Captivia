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
