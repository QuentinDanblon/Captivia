import { guideCategoryForSpecies, guidePath, GUIDE_CATEGORIES, isGuideCategory } from '../guides';

describe('guidePath', () => {
  it('builds the catalogue path or encodes a species id as a query value', () => {
    expect(guidePath()).toBe('/guides');
    expect(guidePath(2435099)).toBe('/guides?species=2435099');
    expect(guidePath('id avec espace')).toBe('/guides?species=id%20avec%20espace');
  });
});

describe('guideCategoryForSpecies', () => {
  it.each([
    [{ canonicalName: 'Chien', scientificName: 'Canis lupus familiaris', class: 'Mammalia' }, 'dogs'],
    [{ canonicalName: 'Chat domestique', scientificName: 'Felis catus', class: 'Mammalia' }, 'cats'],
    [{ canonicalName: 'Lapin', scientificName: 'Oryctolagus cuniculus', class: 'Mammalia' }, 'rabbits'],
    [{ canonicalName: 'Hamster doré', scientificName: 'Mesocricetus auratus', class: 'Mammalia' }, 'rodents'],
  ] as const)('uses the scientific identity when canonicalName is French: %j → %s', (species, category) => {
    expect(guideCategoryForSpecies(species)).toBe(category);
  });

  it.each([
    ['Mammalia', 'mammals'],
    ['Aves', 'birds'],
    ['Reptilia', 'reptiles'],
    ['Amphibia', 'amphibians'],
    ['Insecta', 'insects'],
    ['Arachnida', 'arachnids'],
  ] as const)('maps class %s to %s', (speciesClass, category) => {
    expect(guideCategoryForSpecies({ class: speciesClass, scientificName: 'Unknown species' })).toBe(category);
  });

  it('does not guess freshwater or marine from a fish class', () => {
    expect(guideCategoryForSpecies({ class: 'Actinopterygii', scientificName: 'Danio rerio' })).toBeNull();
  });

  it('recognizes every declared category and rejects unknown query values', () => {
    for (const category of GUIDE_CATEGORIES) expect(isGuideCategory(category.id)).toBe(true);
    expect(isGuideCategory('unknown')).toBe(false);
    expect(isGuideCategory(null)).toBe(false);
  });
});
