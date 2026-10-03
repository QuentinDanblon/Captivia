import {
  authorityOf,
  iucnCategoryOf,
  normalizeSpeciesResult,
  parseFreeLicense,
  pickSpeciesPhoto,
  speciesDisplayName,
  speciesGroupOf,
  speciesRankOf,
} from '../species';

describe('parseFreeLicense', () => {
  it.each([
    ['http://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0'],
    ['https://creativecommons.org/licenses/by-sa/3.0/', 'CC BY-SA 3.0'],
    ['CC-BY-SA 4.0', 'CC BY-SA 4.0'],
    ['cc_by', 'CC BY 4.0'],
    ['http://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0'],
    ['CC0', 'CC0 1.0'],
    ['Public Domain', 'PDM 1.0'],
  ])('%s → %s', (raw, label) => {
    expect(parseFreeLicense(raw)?.label).toBe(label);
  });

  it.each([
    'http://creativecommons.org/licenses/by-nc/4.0/',
    'CC BY-NC-SA 4.0',
    'http://creativecommons.org/licenses/by-nd/4.0/',
    'CC-BY-NC',
    '© all rights reserved',
    'Copyright John Doe',
    '',
    null,
  ])('refuse %s', (raw) => {
    expect(parseFreeLicense(raw)).toBeNull();
  });
});

describe('pickSpeciesPhoto', () => {
  const base = { type: 'StillImage', format: 'image/jpeg', identifier: 'https://img.example/a.jpg' };

  it('prend la première image sous licence libre avec un auteur', () => {
    const photo = pickSpeciesPhoto([
      { ...base, creator: 'Sans licence libre', license: 'CC BY-NC 4.0' },
      { ...base, creator: '', license: 'CC BY 4.0' },
      { ...base, type: 'MovingImage', format: 'video/mp4', creator: 'Vidéo', license: 'CC0' },
      { ...base, identifier: 'http://img.example/b.jpg', creator: ' Ana Martínez ', license: 'http://creativecommons.org/licenses/by/4.0/', references: 'https://www.inaturalist.org/photos/1' },
    ]);
    expect(photo).toEqual({
      src: 'https://img.example/b.jpg',
      author: 'Ana Martínez',
      license: { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      sourceUrl: 'https://www.inaturalist.org/photos/1',
    });
  });

  it('sans page source, le crédit renvoie au fichier ; accepte la forme { results }', () => {
    const photo = pickSpeciesPhoto({ results: [{ ...base, creator: 'X', license: 'CC0' }] });
    expect(photo?.sourceUrl).toBe('https://img.example/a.jpg');
  });

  it('aucune photo acceptable → null (silhouette)', () => {
    expect(pickSpeciesPhoto([{ ...base, creator: 'X', license: 'All rights reserved' }])).toBeNull();
    expect(pickSpeciesPhoto([{ ...base, creator: 'X', license: 'CC BY', identifier: 'javascript:alert(1)' }])).toBeNull();
    expect(pickSpeciesPhoto([])).toBeNull();
    expect(pickSpeciesPhoto(null)).toBeNull();
  });
});

describe('résultats et noms', () => {
  it('profil Captivia : nom français, binôme, groupe par catégorie', () => {
    expect(
      normalizeSpeciesResult({ key: 1, scientificName: 'Eublepharis macularius', canonicalName: 'Gecko léopard', vernacularName: 'Gecko léopard', category: 'reptile' }),
    ).toEqual({ id: 1, commonNameFr: 'Gecko léopard', latin: 'Eublepharis macularius', group: expect.objectContaining({ id: 'reptiles' }), iucn: null });
  });

  it('repli GBIF : binôme sans autorité, classe, statut UICN', () => {
    const r = normalizeSpeciesResult({ key: 2, scientificName: 'Boa constrictor Linnaeus, 1758', canonicalName: 'Boa constrictor', vernacularNames: ['Boa constricteur'], class: 'Reptilia', iucnStatus: 'LEAST_CONCERN' });
    expect(r).toMatchObject({ id: 2, commonNameFr: 'Boa constricteur', latin: 'Boa constrictor', iucn: 'LC' });
    expect(r?.group?.gbifClass).toBe('Reptilia');
  });

  it('rejette un résultat incomplet', () => {
    expect(normalizeSpeciesResult({ key: 'x', scientificName: 'A' })).toBeNull();
    expect(normalizeSpeciesResult(null)).toBeNull();
  });

  it('titre : nom français en français, binôme latin ailleurs', () => {
    expect(speciesDisplayName('fr', 'Boa constricteur', 'Boa constrictor')).toEqual({ name: 'Boa constricteur', isLatin: false });
    expect(speciesDisplayName('en', 'Boa constricteur', 'Boa constrictor')).toEqual({ name: 'Boa constrictor', isLatin: true });
    expect(speciesDisplayName('fr', undefined, 'Boa constrictor').isLatin).toBe(true);
  });

  it('autorité, rang, UICN, groupe', () => {
    expect(authorityOf('Boa constrictor Linnaeus, 1758', 'Boa constrictor')).toBe('Linnaeus, 1758');
    expect(authorityOf('Boa constrictor', 'Boa constrictor')).toBeUndefined();
    expect(speciesRankOf('SPECIES', 2435099)).toBe('SPECIES');
    expect(speciesRankOf('unranked', 2435099)).toBeNull();
    expect(speciesRankOf('SPECIES', 2_000_000_010)).toBe('BREED');
    expect(iucnCategoryOf('Least Concern')).toBe('LC');
    expect(iucnCategoryOf('NT')).toBe('NT');
    expect(iucnCategoryOf(undefined)).toBeNull();
    expect(speciesGroupOf({ category: 'mammifère' })?.id).toBe('mammals');
    expect(speciesGroupOf({ class: 'Gastropoda' })).toBeNull();
  });
});
