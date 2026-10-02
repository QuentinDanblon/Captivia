import axios from 'axios';
import { WikidataService } from './wikidata.service';

jest.mock('axios');

describe('WikidataService (validation du QID)', () => {
  const get = jest.fn();

  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { results: { bindings: [] }, entities: {} } });
    (axios.create as jest.Mock).mockReturnValue({ get });
  });

  const invalid = ['', 'q1', 'Q', 'P31', '12', 'Q1} . ?s ?p ?o } #', 'Q1\nDROP', '../Q1'];

  it.each(invalid)('refuse le QID %p sans aucun appel réseau', async (qid) => {
    const service = new WikidataService();
    await expect(service.getEntity(qid)).resolves.toBeNull();
    await expect(service.getConservationStatus(qid)).resolves.toBeNull();
    await expect(service.getClassification(qid)).resolves.toBeNull();
    await expect(service.getDescriptions(qid)).resolves.toBeNull();
    await expect(service.getImages(qid)).resolves.toBeNull();
    await expect(service.getRelatedSpecies(qid)).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('accepte un QID valide et interroge Wikidata', async () => {
    const service = new WikidataService();
    await service.getConservationStatus('Q140');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1].params.query).toContain('wd:Q140');
  });
});
