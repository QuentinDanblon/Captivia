import { HttpException, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { SpeciesPlusService } from './speciesplus.service';
import { ExternalUnavailableError } from '../../external/http/external-errors';

function httpError(status: number) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    {},
    { status, data: {}, statusText: '', headers: {}, config: {} as never },
  );
}

function buildService(stale: unknown = null) {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    getStale: jest.fn().mockReturnValue(stale),
    set: jest.fn(),
  };
  const http = { get: jest.fn() };
  return {
    service: new SpeciesPlusService(cache as never, http as never),
    cache,
    http,
  };
}

describe('SpeciesPlusService', () => {
  const originalToken = process.env.SPECIESPLUS_API_TOKEN;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalToken === undefined) delete process.env.SPECIESPLUS_API_TOKEN;
    else process.env.SPECIESPLUS_API_TOKEN = originalToken;
  });

  describe('sans jeton (intégration désactivée)', () => {
    beforeEach(() => {
      delete process.env.SPECIESPLUS_API_TOKEN;
    });

    it('isConfigured() est faux', () => {
      expect(buildService().service.isConfigured()).toBe(false);
    });

    it('chaque méthode répond 503 INTEGRATION_DISABLED sans aucun appel réseau ni cache', async () => {
      const { service, http, cache } = buildService();
      const calls = [
        () => service.searchByScientificName('Boa constrictor'),
        () => service.getTaxonDetails(1),
        () => service.getCitesLegislation(1),
        () => service.getEULegislation(1),
        () => service.getDistributions(1),
      ];
      for (const call of calls) {
        const error = (await call().catch((e: unknown) => e)) as HttpException;
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(503);
        expect(error.getResponse()).toMatchObject({
          code: 'INTEGRATION_DISABLED',
        });
      }
      expect(http.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('avec jeton', () => {
    beforeEach(() => {
      process.env.SPECIESPLUS_API_TOKEN = 'super-secret-token';
    });

    it('appelle Species+ via le client partagé avec le header du jeton', async () => {
      const { service, http } = buildService();
      http.get.mockResolvedValue({ data: { taxon_concepts: [{ id: 7 }] } });

      await expect(
        service.searchByScientificName('Boa constrictor'),
      ).resolves.toEqual([{ id: 7 }]);
      expect(http.get).toHaveBeenCalledWith(
        'speciesplus',
        'https://api.speciesplus.net/api/v1/taxon_concepts',
        expect.objectContaining({
          params: { name: 'Boa constrictor' },
          headers: { 'X-Authentication-Token': 'super-secret-token' },
        }),
      );
    });

    it('met en cache une réponse valide', async () => {
      const { service, http, cache } = buildService();
      http.get.mockResolvedValue({
        data: { cites_listings: [{ appendix: 'II' }] },
      });

      await service.getCitesLegislation(7);

      expect(cache.set).toHaveBeenCalledWith(
        'speciesplus:cites:7',
        JSON.stringify([{ appendix: 'II' }]),
        604800,
      );
    });

    it('panne sans cache : 503 explicite (plus de liste vide silencieuse), rien en cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(500));

      const error = (await service
        .getEULegislation(7)
        .catch((e: unknown) => e)) as HttpException;
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
      });
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('disjoncteur ouvert : repli sur la dernière réponse connue (périmée)', async () => {
      const { service, http, cache } = buildService(
        JSON.stringify([{ appendix: 'II' }]),
      );
      http.get.mockRejectedValue(new ExternalUnavailableError('speciesplus'));

      await expect(service.getCitesLegislation(7)).resolves.toEqual([
        { appendix: 'II' },
      ]);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('404 du fournisseur (taxon inconnu) : valeur « vide » légitime, pas de cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(404));

      await expect(service.getTaxonDetails(999)).resolves.toBeNull();
      await expect(service.getDistributions(999)).resolves.toEqual([]);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('ne logge jamais le header X-Authentication-Token (message + statut seulement)', async () => {
      const axiosError = Object.assign(
        new Error('Request failed with status code 401'),
        {
          response: { status: 401 },
          config: {
            headers: { 'X-Authentication-Token': 'super-secret-token' },
          },
        },
      );
      const { service, http } = buildService();
      http.get.mockRejectedValue(axiosError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await service.searchByScientificName('x').catch(() => undefined);
      await service.getTaxonDetails(1).catch(() => undefined);

      expect(errorSpy).toHaveBeenCalledTimes(2);
      for (const call of errorSpy.mock.calls) {
        expect(call).toHaveLength(1);
        expect(String(call[0])).toContain('(HTTP 401)');
      }
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
        'super-secret-token',
      );
    });
  });
});
