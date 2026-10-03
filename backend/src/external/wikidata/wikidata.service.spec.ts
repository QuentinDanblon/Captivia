/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks du client HTTP typés any */
import { WikidataService } from './wikidata.service';

describe('WikidataService (validation des entrées interpolées)', () => {
  const get = jest.fn();
  const buildService = () => new WikidataService({ get } as never);

  beforeEach(() => {
    get
      .mockReset()
      .mockResolvedValue({ data: { results: { bindings: [] }, entities: {} } });
  });

  const invalid = [
    '',
    'q1',
    'Q',
    'P31',
    '12',
    'Q1} . ?s ?p ?o } #',
    'Q1\nDROP',
    '../Q1',
  ];

  it.each(invalid)('refuse le QID %p sans aucun appel réseau', async (qid) => {
    const service = buildService();
    await expect(service.getEntity(qid)).resolves.toBeNull();
    await expect(service.getConservationStatus(qid)).resolves.toBeNull();
    await expect(service.getClassification(qid)).resolves.toBeNull();
    await expect(service.getDescriptions(qid)).resolves.toBeNull();
    await expect(service.getImages(qid)).resolves.toBeNull();
    await expect(service.getRelatedSpecies(qid)).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('accepte un QID valide et interroge Wikidata (SPARQL) via le client partagé', async () => {
    const service = buildService();
    await service.getConservationStatus('Q140');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toBe('wikidata-sparql');
    expect(get.mock.calls[0][2].params.query).toContain('wd:Q140');
  });

  it.each([
    'Panthera leo" . ?s ?p ?o } #',
    'x{y}',
    'a\\b',
    'Boa\nconstrictor',
    '',
    'A',
  ])(
    'refuse le nom scientifique %p (injection SPARQL) sans appel réseau',
    async (name) => {
      await expect(
        buildService().getSpeciesByScientificName(name),
      ).resolves.toBeNull();
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('accepte un nom scientifique valide', async () => {
    await buildService().getSpeciesByScientificName("Boa constrictor");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][2].params.query).toContain('"Boa constrictor"');
  });
});
