import * as fs from 'fs';
import * as path from 'path';
import {
  checkDietCompatibility,
  isGenericSource,
  validateBreedEntry,
} from '../../prisma/validation';
import {
  findParentSpecies,
  isBreedId,
  scientificNameVariants,
  type ParentLookupDb,
} from './species-parent';
import { matchAliases, SPECIES_ALIASES } from './species-aliases';

/** B1 / M10 — données du catalogue : validation des races, espèce parente, alias de recherche. */
describe('Validation des fiches races (prisma/validation.ts)', () => {
  const persan = {
    speciesId: 2000000110,
    commonNameFr: 'Persan',
    scientificName: 'Felis catus',
    category: 'mammifère',
  };

  it('refuse le modèle « rongeur / lapin » sur Felis catus (régime et sources génériques)', () => {
    const errors = validateBreedEntry(
      {
        ...persan,
        feeding: {
          dietType: 'herbivore',
          sources: [
            {
              type: 'vet',
              url: 'https://www.royalcanin.com/fr/fr/lapins',
              title: 'Royal Canin — guide alimentation lapin',
            },
          ],
        },
      },
      { category: 'mammifère', dietType: 'carnivore' },
    );
    expect(errors.join('\n')).toMatch(/source générique/);
    expect(errors.join('\n')).toMatch(/incompatible avec l'espèce parente/);
  });

  it('refuse une section sans source, ou citant une racine de site', () => {
    expect(
      validateBreedEntry({ ...persan, health: { sources: [] } }, null),
    ).toEqual([expect.stringContaining('health : aucune source')]);
    expect(isGenericSource({ url: 'https://wamiz.com', title: 'Wamiz' })).toBe(
      true,
    );
    expect(
      isGenericSource({
        url: 'https://fr.wikipedia.org/wiki/Persan_(chat)',
        title: 'Persan (chat) — Wikipédia',
      }),
    ).toBe(false);
  });

  it('refuse une catégorie différente de celle de l’espèce parente', () => {
    expect(
      validateBreedEntry(
        { ...persan, category: 'oiseau' },
        {
          category: 'mammifère',
        },
      ).join(),
    ).toMatch(/différente de l'espèce parente/);
  });

  it('accepte une race sans section (héritage de l’espèce parente)', () => {
    expect(
      validateBreedEntry(persan, {
        category: 'mammifère',
        dietType: 'carnivore',
      }),
    ).toEqual([]);
  });

  it('contrôle le régime par genre même sans espèce parente en base', () => {
    expect(checkDietCompatibility('Felis catus', 'herbivore')).toMatch(
      /incompatible avec Felis catus/,
    );
    expect(checkDietCompatibility('Testudo hermanni', 'insectivore')).toMatch(
      /incompatible/,
    );
    expect(checkDietCompatibility('Felis catus', 'carnivore')).toBeNull();
    expect(checkDietCompatibility('Pogona vitticeps', 'omnivore')).toBeNull();
  });

  it('breeds-data.json ne contient plus aucune section générée par modèle', () => {
    const breeds = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../prisma/breeds-data.json'),
        'utf-8',
      ),
    ) as Array<Record<string, unknown> & { speciesId: number }>;
    const errors = breeds.flatMap((b) => validateBreedEntry(b as never, null));
    expect(errors).toEqual([]);
    // Aucune race de chat, de chien ou de cheval classée « Rongeur ».
    expect(
      breeds.filter(
        (b) =>
          isBreedId(b.speciesId) &&
          b.subcategory === 'Rongeur' &&
          /^(Felis|Canis|Equus)\b/.test(String(b.scientificName)),
      ),
    ).toEqual([]);
  });
});

describe('Espèce parente d’une race (species-parent.ts)', () => {
  it('reconnaît les synonymes taxonomiques du catalogue', () => {
    expect(scientificNameVariants('Canis lupus familiaris')).toEqual(
      expect.arrayContaining(['canis familiaris']),
    );
    expect(scientificNameVariants('  Felis   Catus ')).toEqual(['felis catus']);
  });

  it('cherche la fiche non-race du même nom scientifique, jamais pour une espèce', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      speciesId: 5281802,
      commonNameFr: 'Chat domestique',
      scientificName: 'Felis catus',
      category: 'mammifère',
      subcategory: 'Félidé',
    });
    const db = {
      speciesProfile: { findFirst, findUnique: jest.fn() },
    } as unknown as ParentLookupDb;

    expect(await findParentSpecies(db, 5281802, 'Felis catus')).toBeNull();
    const parent = await findParentSpecies(db, 2000000110, 'Felis catus');
    expect(parent?.speciesId).toBe(5281802);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          speciesId: { lt: 2_000_000_001 },
        }) as unknown,
      }),
    );
  });
});

describe('Alias de recherche (species-aliases.ts)', () => {
  it('trouve les noms courants dans les autres langues', () => {
    expect(matchAliases('dog').get(5287871)).toBe(0);
    expect(matchAliases('cat').get(5281802)).toBe(0);
    expect(matchAliases('Katze').get(5281802)).toBe(0);
    expect(matchAliases('chat').get(5281802)).toBe(0);
    expect(matchAliases('lapin').get(5283399)).toBe(0);
    expect(matchAliases('guinea').get(5281775)).toBe(1);
  });

  it('ne fait pas de correspondance « contient » (« at » ne remonte pas « cat »)', () => {
    expect(matchAliases('at').has(5281802)).toBe(false);
    expect(matchAliases('a').size).toBe(0);
  });

  it('les alias sont en minuscules', () => {
    for (const names of Object.values(SPECIES_ALIASES)) {
      for (const n of names) expect(n).toBe(n.toLowerCase());
    }
  });
});
