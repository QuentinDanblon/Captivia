import axios from 'axios';
import { Logger } from '@nestjs/common';
import { SpeciesPlusService } from './speciesplus.service';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

function buildService() {
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  return new SpeciesPlusService(cache as never);
}

describe('SpeciesPlusService (résilience et fuite de token)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('applique timeout 8 s et maxRedirects 0 à chaque appel', async () => {
    mockedGet.mockResolvedValue({ data: {} });
    const service = buildService();
    await service.searchByScientificName('Boa constrictor');
    await service.getTaxonDetails(1);
    await service.getCitesLegislation(1);
    await service.getEULegislation(1);
    await service.getDistributions(1);

    expect(mockedGet).toHaveBeenCalledTimes(5);
    for (const call of mockedGet.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ timeout: 8000, maxRedirects: 0 }));
    }
  });

  it('ne logge jamais le header X-Authentication-Token (message + statut seulement)', async () => {
    const axiosError = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401 },
      config: { headers: { 'X-Authentication-Token': 'super-secret-token' } },
    });
    mockedGet.mockRejectedValue(axiosError);
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const service = buildService();

    await expect(service.searchByScientificName('x')).resolves.toEqual([]);
    await expect(service.getTaxonDetails(1)).resolves.toBeNull();
    await expect(service.getCitesLegislation(1)).resolves.toEqual([]);
    await expect(service.getEULegislation(1)).resolves.toEqual([]);
    await expect(service.getDistributions(1)).resolves.toEqual([]);

    expect(errorSpy).toHaveBeenCalledTimes(5);
    for (const call of errorSpy.mock.calls) {
      expect(call).toHaveLength(1);
      expect(String(call[0])).toContain('(HTTP 401)');
    }
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('super-secret-token');
  });
});
