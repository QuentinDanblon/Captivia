import { HttpException, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { OpenPetFoodFactsService } from './openpetfoodfacts.service';
import { ExternalUnavailableError } from '../../external/http/external-errors';

function httpError(
  status: number,
  message = `Request failed with status code ${status}`,
) {
  return new AxiosError(
    message,
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    {},
    {
      status,
      data: {},
      statusText: '',
      headers: {},
      config: {} as never,
    },
  );
}

function buildService(overrides: { stale?: unknown; cached?: unknown } = {}) {
  const cache = {
    get: jest.fn().mockResolvedValue(overrides.cached ?? null),
    getStale: jest.fn().mockReturnValue(overrides.stale ?? null),
    set: jest.fn(),
  };
  const http = { get: jest.fn() };
  const service = new OpenPetFoodFactsService(cache as never, http as never);
  return { service, cache, http };
}

describe('OpenPetFoodFactsService (résilience)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getProduct', () => {
    it.each([
      'abc',
      '123',
      '../admin',
      '12345678/../../x',
      '1234567890123456',
      '',
    ])('refuse le barcode %p sans appeler le réseau', async (barcode) => {
      const { service, http } = buildService();
      await expect(service.getProduct(barcode)).resolves.toBeNull();
      expect(http.get).not.toHaveBeenCalled();
    });

    it('interroge OPFF via le client partagé pour un barcode valide', async () => {
      const { service, http } = buildService();
      http.get.mockResolvedValue({
        data: { status: 1, product: { code: '3017620422003' } },
      });

      await expect(service.getProduct('3017620422003')).resolves.toEqual({
        code: '3017620422003',
      });
      expect(http.get).toHaveBeenCalledWith(
        'openpetfoodfacts',
        expect.stringContaining('/product/3017620422003'),
        expect.anything(),
      );
    });

    it('404 du fournisseur → null (produit inconnu), rien en cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(404));

      await expect(service.getProduct('3017620422003')).resolves.toBeNull();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('panne sans cache → 503 explicite (et non un faux « introuvable »), rien en cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(503));

      const error = (await service
        .getProduct('3017620422003')
        .catch((e: unknown) => e)) as HttpException;
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('panne avec cache périmé → sert la dernière fiche connue', async () => {
      const { service, http } = buildService({
        stale: JSON.stringify({
          code: '3017620422003',
          product_name: 'Ancien',
        }),
      });
      http.get.mockRejectedValue(
        new ExternalUnavailableError('openpetfoodfacts'),
      );

      await expect(service.getProduct('3017620422003')).resolves.toEqual({
        code: '3017620422003',
        product_name: 'Ancien',
      });
    });
  });

  describe('searchProducts', () => {
    it('met en cache une réponse valide, y compris « aucun produit »', async () => {
      const { service, http, cache } = buildService();
      http.get.mockResolvedValue({ data: { products: [], count: 0, page: 1 } });

      const result = await service.searchProducts('zzz');

      expect(result).toEqual({ products: [], count: 0, page: 1 });
      expect(cache.set).toHaveBeenCalledTimes(1);
    });

    it('panne : résultat vide « degraded » et AUCUNE écriture en cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(500));

      await expect(service.searchProducts('boa')).resolves.toEqual({
        products: [],
        count: 0,
        page: 1,
        degraded: true,
      });
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('disjoncteur ouvert : repli sur le cache périmé (stale: true), sans réécriture', async () => {
      const stale = { products: [{ code: '1' }], count: 1, page: 1 };
      const { service, http, cache } = buildService({
        stale: JSON.stringify(stale),
      });
      http.get.mockRejectedValue(
        new ExternalUnavailableError('openpetfoodfacts'),
      );

      await expect(service.searchProducts('dog')).resolves.toEqual({
        ...stale,
        stale: true,
      });
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('un cache frais est servi sans appel réseau', async () => {
      const fresh = { products: [{ code: '1' }], count: 1, page: 1 };
      const { service, http } = buildService({ cached: JSON.stringify(fresh) });

      await expect(service.searchProducts('dog')).resolves.toEqual(fresh);
      expect(http.get).not.toHaveBeenCalled();
    });
  });

  describe('searchBySpecies', () => {
    it("s'arrête au premier résultat dégradé (pas de rafale d'appels vers un fournisseur en panne)", async () => {
      const { service, http } = buildService();
      http.get.mockRejectedValue(httpError(503));

      const result = await service.searchBySpecies('boa');

      expect(result.degraded).toBe(true);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCategories', () => {
    it('panne : liste vide sans la mettre en cache', async () => {
      const { service, http, cache } = buildService();
      http.get.mockRejectedValue(httpError(502));

      await expect(service.getCategories()).resolves.toEqual([]);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('panne avec cache périmé : dernière liste connue', async () => {
      const { service, http } = buildService({
        stale: JSON.stringify(['Dog food']),
      });
      http.get.mockRejectedValue(httpError(502));

      await expect(service.getCategories()).resolves.toEqual(['Dog food']);
    });
  });

  it("ne logge que le message et le statut HTTP, jamais l'objet d'erreur", async () => {
    const axiosError = Object.assign(
      new Error('Request failed with status code 500'),
      {
        response: { status: 500 },
        config: { headers: { 'X-Authentication-Token': 'leak-me' } },
      },
    );
    const { service, http } = buildService();
    http.get.mockRejectedValue(axiosError);
    const errorSpy = jest.spyOn(Logger.prototype, 'error');

    await service.searchProducts('boa');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toHaveLength(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('(HTTP 500)');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('leak-me');
  });
});
