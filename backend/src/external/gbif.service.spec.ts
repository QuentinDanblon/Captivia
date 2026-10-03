/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks du client HTTP typés any */
import { NotFoundException } from '@nestjs/common';
import { GbifService } from './gbif.service';

const BASE = 'https://api.gbif.org/v1';

describe('GbifService', () => {
  let service: GbifService;
  let http: { get: jest.Mock; circuitState: jest.Mock };

  beforeEach(() => {
    http = {
      get: jest.fn(),
      circuitState: jest.fn().mockReturnValue('closed'),
    };
    service = new GbifService(http as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchSpecies', () => {
    it('interroge GBIF via le client partagé (fournisseur « gbif »)', async () => {
      const data = {
        results: [{ key: 1, canonicalName: 'Boa constrictor' }],
        total: 1,
      };
      http.get.mockResolvedValue({ data });

      const result = await service.searchSpecies('boa', 20, 0);

      expect(result).toEqual(data);
      expect(http.get).toHaveBeenCalledWith('gbif', `${BASE}/species/search`, {
        params: {
          q: 'boa',
          limit: 20,
          offset: 0,
          rank: 'SPECIES',
          highertaxonRank: 'SPECIES',
        },
      });
    });

    it('propage les erreurs (le repli est décidé par SpeciesService)', async () => {
      http.get.mockRejectedValue(new Error('boom'));
      await expect(service.searchSpecies('boa')).rejects.toThrow('boom');
    });
  });

  describe('getSpecies', () => {
    it('renvoie la fiche taxonomique', async () => {
      const data = { key: 1, canonicalName: 'Boa constrictor' };
      http.get.mockResolvedValue({ data });

      await expect(service.getSpecies('1')).resolves.toEqual(data);
      expect(http.get).toHaveBeenCalledWith('gbif', `${BASE}/species/1`);
    });

    it('propage un 404 du fournisseur', async () => {
      http.get.mockRejectedValue(
        Object.assign(new Error('Request failed with status code 404'), {
          response: { status: 404 },
        }),
      );
      await expect(service.getSpecies('999999')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it.each(['abc', '../etc', '0', '-1', '1/../../x', '1;DROP', ''])(
      'refuse la clé %p sans appel réseau (404)',
      async (key) => {
        await expect(service.getSpecies(key)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(http.get).not.toHaveBeenCalled();
      },
    );
  });

  describe('sous-ressources', () => {
    it('getVernacularNames renvoie la liste (vide si absente)', async () => {
      http.get.mockResolvedValueOnce({
        data: { results: [{ language: 'fra', vernacularName: 'Boa' }] },
      });
      await expect(service.getVernacularNames('1')).resolves.toEqual([
        { language: 'fra', vernacularName: 'Boa' },
      ]);
      expect(http.get).toHaveBeenCalledWith(
        'gbif',
        `${BASE}/species/1/vernacularNames`,
      );

      http.get.mockResolvedValueOnce({ data: {} });
      await expect(service.getVernacularNames('1')).resolves.toEqual([]);
    });

    it('getIucn et getMetrics renvoient le corps tel quel', async () => {
      http.get.mockResolvedValue({ data: { iucnRedListCategory: 'LC' } });
      await expect(service.getIucn('1')).resolves.toEqual({
        iucnRedListCategory: 'LC',
      });
      expect(http.get).toHaveBeenCalledWith('gbif', `${BASE}/species/1/iucn`);
      await service.getMetrics('1');
      expect(http.get).toHaveBeenCalledWith('gbif', `${BASE}/species/1/metrics`);
    });

    it('getDistributions et getMedia renvoient results', async () => {
      http.get.mockResolvedValue({ data: { results: [{ x: 1 }] } });
      await expect(service.getDistributions('1')).resolves.toEqual([{ x: 1 }]);
      await expect(service.getMedia('1')).resolves.toEqual([{ x: 1 }]);
    });

    it('countOccurrences normalise le compteur', async () => {
      http.get.mockResolvedValue({
        data: { count: '1000', limit: 1, offset: 0 },
      });
      await expect(service.countOccurrences('1')).resolves.toEqual({
        count: 1000,
        limit: 1,
        offset: 0,
      });
      expect(http.get).toHaveBeenCalledWith(
        'gbif',
        `${BASE}/occurrence/search`,
        { params: { speciesKey: '1', limit: 1 } },
      );
    });
  });

  describe('checkApiHealth', () => {
    it('healthy quand GBIF répond (une seule tentative, sans retry)', async () => {
      http.get.mockResolvedValue({ data: { count: 0 } });

      const result = await service.checkApiHealth();

      expect(result).toMatchObject({ status: 'healthy', circuit: 'closed' });
      expect(http.get).toHaveBeenCalledWith(
        'gbif',
        `${BASE}/occurrence/search`,
        expect.objectContaining({ retry: false }),
      );
    });

    it('unhealthy (avec état du disjoncteur) quand GBIF ne répond pas', async () => {
      http.get.mockRejectedValue(new Error('Network error'));
      http.circuitState.mockReturnValue('open');

      await expect(service.checkApiHealth()).resolves.toEqual({
        status: 'unhealthy',
        error: 'Network error',
        circuit: 'open',
      });
    });
  });
});
