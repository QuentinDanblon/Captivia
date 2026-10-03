import { curatedSpeciesPhoto } from '../species-photos';

describe('correspondance des photos d’espèces validées', () => {
  it.each([
    ['Canis familiaris', 'Chien', '/images/animals/dog-river'],
    ['Canis lupus familiaris', 'Golden Retriever', '/images/animals/dog-golden-retriever'],
    ['Felis catus', 'Chat domestique', '/images/animals/cat-straw'],
    ['Oryctolagus cuniculus', 'Lapin de garenne', '/images/animals/rabbit-straw'],
    ['Nymphicus hollandicus', 'Perruche Calopsite', '/images/animals/cockatiels'],
    ['Melopsittacus undulatus', 'Perruche ondulée', '/images/animals/budgerigars'],
    ['Eublepharis macularius', 'Gecko Léopard', '/images/animals/leopard-gecko'],
    ['Pogona vitticeps', 'Agame barbu', '/images/animals/bearded-dragon'],
    ['Paracheirodon innesi', 'Néon Bleu (Tétra Néon)', '/images/animals/neon-tetra'],
    ['Equus caballus', 'Cheval domestique', '/images/animals/horse'],
    ['Gallus gallus domesticus', 'Poule domestique', '/images/animals/hen'],
    ['Cavia porcellus', 'Cochon d\'Inde', '/images/animals/guinea-pig'],
    ['Mesocricetus auratus', 'Hamster doré', '/images/animals/syrian-hamster'],
    ['Mustela putorius furo', 'Furet', '/images/animals/ferret'],
    ['Chinchilla lanigera', 'Chinchilla', '/images/animals/chinchilla'],
    ['Mus musculus domesticus', 'Souris blanche domestique', '/images/animals/domestic-mouse'],
    ['Rattus norvegicus domesticus', 'Rat domestique', '/images/animals/domestic-rat'],
    ['Serinus canaria domesticus', 'Canari', '/images/animals/canary'],
    ['Psittacus erithacus', 'Perroquet Gris d\'Afrique', '/images/animals/african-grey'],
    ['Boa constrictor', 'Boa Constricteur', '/images/animals/boa-constrictor'],
    ['Python regius', 'Python Royal', '/images/animals/ball-python'],
    ['Iguana iguana', 'Iguane Vert', '/images/animals/green-iguana'],
    ['Trachemys scripta elegans', 'Tortue à Oreilles Rouges', '/images/animals/red-eared-slider'],
    ['Chamaeleo calyptratus', 'Caméléon Casqué', '/images/animals/veiled-chameleon'],
    ['Ambystoma mexicanum', 'Axolotl', '/images/animals/axolotl'],
    ['Carassius auratus', 'Poisson Rouge', '/images/animals/goldfish'],
    ['Betta splendens', 'Combattant (Betta)', '/images/animals/betta'],
    ['Poecilia reticulata', 'Guppy', '/images/animals/guppy'],
    ['Carausius morosus', 'Phasme Bâton', '/images/animals/stick-insect'],
    ['Gromphadorhina portentosa', 'Blatte de Madagascar', '/images/animals/hissing-cockroach'],
    ['Pandinus imperator', 'Scorpion Empereur', '/images/animals/emperor-scorpion'],
    ['Lithobates catesbeianus', 'Grenouille Taureau', '/images/animals/bullfrog'],
    ['Phodopus sungorus', 'Hamster russe', '/images/animals/russian-hamster'],
    ['Phodopus campbelli', 'Hamster de Campbell', '/images/animals/campbell-hamster'],
    ['Phodopus roborovskii', 'Hamster Roborovski', '/images/animals/roborovski-hamster'],
    ['Correlophus ciliatus', 'Gecko à crête', '/images/animals/crested-gecko'],
    ['Furcifer pardalis', 'Caméléon panthère', '/images/animals/panther-chameleon'],
    ['Testudo hermanni', 'Tortue Hermann', '/images/animals/hermann-tortoise'],
    ['Psittacula krameri', 'Perruche à collier', '/images/animals/ring-necked-parakeet'],
    ['Agapornis fischeri', 'Inséparable Fischer', '/images/animals/fischer-lovebird'],
    ['Ara ararauna', 'Ara ararauna', '/images/animals/blue-yellow-macaw'],
    ['Pterophyllum scalare', 'Scalaire', '/images/animals/angelfish'],
    ['Danio rerio', 'Danio zébré', '/images/animals/zebrafish'],
    ['Mikrogeophagus ramirezi', 'Cichlidé de Ramirezi', '/images/animals/ramirezi'],
    ['Agalychnis callidryas', 'Rainette aux yeux rouges', '/images/animals/red-eyed-tree-frog'],
    ['Dendrobates tinctorius', 'Dendrobate', '/images/animals/dyeing-poison-frog'],
    ['Neocaridina davidi', 'Crevette Red Cherry', '/images/animals/cherry-shrimp'],
    ['Caridina multidentata', 'Crevette Amano', '/images/animals/amano-shrimp'],
    ['Ovis aries', 'Mouton', '/images/animals/sheep'],
    ['Equus asinus', 'Âne', '/images/animals/donkey'],
    ['Atelerix albiventris', 'Hérisson africain', '/images/animals/african-hedgehog'],
  ])('%s / %s reçoit sa photo locale créditée', (latin, name, path) => {
    const photo = curatedSpeciesPhoto(latin, name);
    expect(photo?.src).toContain(path);
    expect(photo?.srcSet).toContain(path);
    expect(photo?.author).toBeTruthy();
    expect(photo?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(photo?.license.label).toMatch(/CC BY|CC0|Domaine public/);
    expect(photo?.license.url).toMatch(/^https:\/\//);
  });

  it('ne donne pas la photo d’un golden retriever à une autre race de chien', () => {
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Berger allemand')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Golden Retriever')?.author).toBe('Dietmar Rabich');
  });

  it('reconnaît l’ara quand son nom vernaculaire est le binôme latin retiré par la normalisation', () => {
    expect(curatedSpeciesPhoto('Ara ararauna')?.src).toContain('/images/animals/blue-yellow-macaw-');
  });

  it('exige le nom du profil lorsque plusieurs races partagent le même taxon', () => {
    expect(curatedSpeciesPhoto('Cavia porcellus')).toBeNull();
    expect(curatedSpeciesPhoto('Carassius auratus')).toBeNull();
    expect(curatedSpeciesPhoto('Ovis aries')).toBeNull();
  });

  it.each([
    ['Cavia porcellus', 'Cochon D’Inde Péruvien'],
    ['Carassius auratus', 'Poisson Rouge Oranda'],
    ['Ovis aries', 'Mérinos'],
  ])('ne donne pas la photo générique de %s à la race %s', (latin, name) => {
    expect(curatedSpeciesPhoto(latin, name)).toBeNull();
  });

  it('ne donne pas une photo de chat ou de chien à un taxon sans correspondance exacte', () => {
    expect(curatedSpeciesPhoto('Felis catus', 'Bengal')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Carlin')).toBeNull();
  });
});
