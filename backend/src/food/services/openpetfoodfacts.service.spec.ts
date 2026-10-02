/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
import axios from 'axios';
import { Logger } from '@nestjs/common';
import { OpenPetFoodFactsService } from './openpetfoodfacts.service';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

function buildService() {
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  return new OpenPetFoodFactsService(cache as never);
}

describe('OpenPetFoodFactsService (résilience)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
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
      await expect(buildService().getProduct(barcode)).resolves.toBeNull();
      expect(mockedGet).not.toHaveBeenCalled();
    });

    it('appelle OPFF avec timeout 8 s et sans redirection pour un barcode valide', async () => {
      mockedGet.mockResolvedValue({
        data: { status: 1, product: { code: '3017620422003' } },
      });
      const product = await buildService().getProduct('3017620422003');

      expect(product).toEqual({ code: '3017620422003' });
      expect(mockedGet).toHaveBeenCalledWith(
        expect.stringContaining('/product/3017620422003'),
        expect.objectContaining({ timeout: 8000, maxRedirects: 0 }),
      );
    });
  });

  it('searchProducts et getCategories appliquent timeout et maxRedirects', async () => {
    mockedGet.mockResolvedValue({ data: { products: [], tags: [] } });
    const service = buildService();
    await service.searchProducts('boa');
    await service.getCategories();

    expect(mockedGet).toHaveBeenCalledTimes(2);
    for (const call of mockedGet.mock.calls) {
      expect(call[1]).toEqual(
        expect.objectContaining({ timeout: 8000, maxRedirects: 0 }),
      );
    }
  });

  it("ne logge que le message et le statut HTTP, jamais l'objet d'erreur", async () => {
    const axiosError = Object.assign(
      new Error('Request failed with status code 500'),
      {
        response: { status: 500 },
        config: { headers: { 'X-Authentication-Token': 'leak-me' } },
      },
    );
    mockedGet.mockRejectedValue(axiosError);
    const errorSpy = jest.spyOn(Logger.prototype, 'error');

    await expect(buildService().searchProducts('boa')).resolves.toEqual({
      products: [],
      count: 0,
      page: 1,
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toHaveLength(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('(HTTP 500)');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('leak-me');
  });
});
