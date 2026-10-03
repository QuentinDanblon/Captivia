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
  ])('%s / %s reçoit sa photo locale créditée', (latin, name, path) => {
    const photo = curatedSpeciesPhoto(latin, name);
    expect(photo?.src).toContain(path);
    expect(photo?.srcSet).toContain(path);
    expect(photo?.author).toBeTruthy();
    expect(photo?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(photo?.license.label).toMatch(/CC BY|Domaine public/);
    expect(photo?.license.url).toMatch(/^https:\/\//);
  });

  it('ne donne pas la photo d’un golden retriever à une autre race de chien', () => {
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Berger allemand')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Golden Retriever')?.author).toBe('Dietmar Rabich');
  });

  it('ne donne pas une photo de chat ou de chien à un taxon sans correspondance exacte', () => {
    expect(curatedSpeciesPhoto('Felis catus', 'Bengal')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Carlin')).toBeNull();
  });
});
