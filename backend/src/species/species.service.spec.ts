import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesService } from './species.service';
import { SpeciesProfileService } from './species-profile.service';
import { HttpException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { ExternalUnavailableError } from '../external/http/external-errors';
import { CacheService } from '../cache/cache.service';
import { GbifService } from '../external/gbif.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilterService } from '../filters/species-filter.service';
import {
  mockCacheService,
  mockGbifService,
  mockTransformerService,
  mockFilterService,
  mockSpeciesProfileService,
} from '../../test/test-mocks';

function upstreamHttpError(status: number) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    undefined,
    {},
    { status, data: {}, statusText: '', headers: {}, config: {} as never },
  );
}

describe('SpeciesService', () => {
  let service: SpeciesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Isolation : ni cache frais ni cache périmé par défaut
    mockCacheService.get.mockReset().mockReturnValue(null);
    mockCacheService.getStale.mockReset().mockReturnValue(null);
    mockTransformerService.transformSearchResults.mockImplementation(
      (results: any[]) => ({
        results: results ?? [],
        total: results?.length ?? 0,
        source: 'gbif',
        cachedAt: new Date(),
      }),
    );
    mockTransformerService.transformSpecies.mockImplementation((item: any) => ({
      ...item,
    }));
    mockTransformerService.transformVernacularNames.mockImplementation(
      (arr: any[]) => ({
        results: (arr ?? [])
          .filter((v: any) => v.language === 'french')
          .map((v: any) => v.name),
        source: 'gbif',
        cachedAt: new Date(),
      }),
    );
    mockTransformerService.transformMedia.mockImplementation(
      (arr: any[]) => arr ?? [],
    );
    mockFilterService.applyFilters.mockImplementation(
      (results: any[], _filters: any) => ({
        results: results ?? [],
        total: results?.length ?? 0,
        filtersApplied: [] as string[],
      }),
    );
    // Profile DB vide par défaut → fallback GBIF ; détail sans profil local
    mockSpeciesProfileService.searchFromProfile.mockResolvedValue({
      results: [],
      total: 0,
      source: 'profile',
    });
    mockSpeciesProfileService.getBySpeciesId.mockResolvedValue({
      profile: null,
      feeding: null,
      habitat: null,
      behavior: null,
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeciesService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: GbifService, useValue: mockGbifService },
        {
          provide: SpeciesTransformerService,
          useValue: mockTransformerService,
        },
        { provide: SpeciesFilterService, useValue: mockFilterService },
        { provide: SpeciesProfileService, useValue: mockSpeciesProfileService },
      ],
    }).compile();
    service = module.get<SpeciesService>(SpeciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchSpecies', () => {
    const mockResults = [
      {
        key: 1,
        canonicalName: 'Boa Constrictor',
        scientificName: 'Boa constrictor',
        rank: 'SPECIES',
        iucnRedListCategory: 'LC',
      },
    ];

    it('should return profile results directly when the local profile DB matches', async () => {
      const profileResults = [
        {
          key: 5221172,
          canonicalName: 'Gecko léopard',
          scientificName: 'Eublepharis macularius',
          category: 'reptile',
        },
      ];
      mockSpeciesProfileService.searchFromProfile.mockResolvedValue({
        results: profileResults,
        total: 1,
        source: 'profile',
      });

      const result = await service.searchSpecies('gecko', 20, 0);

      expect(result).toEqual({
        results: profileResults,
        total: 1,
        source: 'profile',
      });
      expect(mockSpeciesProfileService.searchFromProfile).toHaveBeenCalledWith(
        'gecko',
        20,
        0,
        {},
      );
      expect(mockGbifService.searchSpecies).not.toHaveBeenCalled();
    });

    it('should fall back to GBIF when the local profile DB is empty', async () => {
      mockCacheService.get.mockReturnValue(null);
      mockGbifService.searchSpecies.mockResolvedValue({
        results: mockResults,
        total: 1,
      });

      const result = await service.searchSpecies('boa', 20, 0);

      expect(result.results).toEqual(mockResults);
      expect(result.total).toBe(1);
      expect(result.source).toBe('gbif');
      // limit * 3 plafonné à 60
      expect(mockGbifService.searchSpecies).toHaveBeenCalledWith('boa', 60, 0);
      expect(mockSpeciesProfileService.searchFromProfile).toHaveBeenCalledWith(
        'boa',
        20,
        0,
        {},
      );
    });

    it('should handle empty GBIF results', async () => {
      mockCacheService.get.mockReturnValue(null);
      mockGbifService.searchSpecies.mockResolvedValue({
        results: [],
        total: 0,
      });

      const result = await service.searchSpecies('nonexistent', 20, 0);

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.source).toBe('gbif');
    });

    it('should map class filter to profile category and filter GBIF results', async () => {
      mockGbifService.searchSpecies.mockResolvedValue({
        results: [
          { key: 1, class: 'Reptilia' },
          { key: 2, class: 'Mammalia' },
        ],
        total: 2,
      });

      const result = await service.searchSpecies('boa', 10, 0, {
        class: 'Reptilia',
      } as any);

      expect(mockSpeciesProfileService.searchFromProfile).toHaveBeenCalledWith(
        'boa',
        10,
        0,
        { category: 'reptile' },
      );
      expect(result.results).toEqual([{ key: 1, class: 'Reptilia' }]);
      expect(result.source).toBe('gbif');
    });
  });

  describe('getSpecies', () => {
    const mockProfile = {
      speciesId: 5221172,
      commonNameFr: 'Gecko léopard',
      scientificName: 'Eublepharis macularius',
    };

    it('should get species details by ID from the local profile', async () => {
      mockCacheService.get.mockReturnValue(null);
      mockSpeciesProfileService.getBySpeciesId.mockResolvedValue({
        profile: mockProfile,
        feeding: { food: 'insectes' },
        habitat: { setup: 'terrarium' },
        behavior: { activity: 'nocturne' },
      });
      mockGbifService.getSpecies.mockResolvedValue({
        key: 5221172,
        kingdom: 'Animalia',
        class: 'Reptilia',
        rank: 'SPECIES',
      });

      const result = await service.getSpecies('5221172');

      expect(result).toEqual({
        key: 5221172,
        name: 'Gecko léopard',
        canonicalName: 'Gecko léopard',
        scientificName: 'Eublepharis macularius',
        rank: 'SPECIES',
        kingdom: 'Animalia',
        phylum: '',
        class: 'Reptilia',
        order: '',
        family: '',
        genus: '',
        status: 'UNKNOWN',
        vernacularNames: ['Gecko léopard'],
        iucnStatus: undefined,
        distributions: [],
        media: [],
        metrics: {},
        occurrenceCount: 0,
        source: 'profile',
        lastReviewedAt: null,
        profile: mockProfile,
        feeding: { food: 'insectes' },
        habitat: { setup: 'terrarium' },
        behavior: { activity: 'nocturne' },
      });
      expect(mockGbifService.getSpecies).toHaveBeenCalledWith('5221172');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'species:5221172',
        expect.any(Object),
        86400,
      );
    });

    it('expose lastReviewedAt de la fiche (W5-04)', async () => {
      mockCacheService.get.mockReturnValue(null);
      const reviewed = new Date('2026-09-15T00:00:00.000Z');
      mockSpeciesProfileService.getBySpeciesId.mockResolvedValue({
        profile: { ...mockProfile, lastReviewedAt: reviewed },
        feeding: null,
        habitat: null,
        behavior: null,
      });
      mockGbifService.getSpecies.mockResolvedValue({
        key: 5221172,
        class: 'Reptilia',
        rank: 'SPECIES',
      });

      const result = await service.getSpecies('5221172');

      expect(result.lastReviewedAt).toEqual(reviewed);
    });

    it('should return cached species when available', async () => {
      const cachedSpecies = { key: 1, name: 'Cached' };
      mockCacheService.get.mockReturnValue(cachedSpecies);

      const result = await service.getSpecies('1');

      expect(result).toEqual(cachedSpecies);
      expect(mockGbifService.getSpecies).not.toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalledWith('species:1');
    });

    it('should throw NotFoundException when species not found', async () => {
      mockCacheService.get.mockReturnValue(null);
      mockGbifService.getSpecies.mockRejectedValue(
        new NotFoundException('Species not found'),
      );

      await expect(service.getSpecies('999999')).rejects.toThrow(
        'Species not found',
      );
    });

    it('should throw NotFoundException for non-numeric id', async () => {
      mockCacheService.get.mockReturnValue(null);

      await expect(service.getSpecies('abc')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVernacularNames', () => {
    it('should get vernacular names from GBIF', async () => {
      const gbifNames = [
        { language: 'french', name: 'Boa constrictor' },
        { language: 'english', name: 'Boa Constrictor' },
      ];

      mockCacheService.get.mockReturnValue(null);
      mockGbifService.getVernacularNames.mockResolvedValue(gbifNames);

      const result = await service.getVernacularNames('1');

      expect(result).toEqual({
        results: ['Boa constrictor'],
        source: 'gbif',
      });
      expect(mockGbifService.getVernacularNames).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'vernacular:1',
        expect.any(Object),
        43200,
      );
    });

    it('should return cached vernacular names when available', async () => {
      const cachedResult = {
        results: ['Boa constrictor'],
        source: 'cache',
        cachedAt: new Date(),
      };

      mockCacheService.get.mockReturnValue(cachedResult);

      const result = await service.getVernacularNames('1');

      expect(result).toEqual({
        results: ['Boa constrictor'],
        source: 'cache',
      });
      expect(mockGbifService.getVernacularNames).not.toHaveBeenCalled();
    });
  });

  describe('getIucn', () => {
    it('should get IUCN status for species', async () => {
      const mockIucn = {
        iucnRedListCategory: 'LC',
      };

      mockGbifService.getIucn.mockResolvedValue(mockIucn);

      const result = await service.getIucn('1');

      expect(result).toEqual(mockIucn);
      expect(mockGbifService.getIucn).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'iucn:1',
        mockIucn,
        86400,
      );
    });
  });

  describe('getDistributions', () => {
    it('should get distribution data for species', async () => {
      const mockDistributions = [
        {
          country: 'France',
          countryCode: 'FR',
        },
      ];

      mockCacheService.get.mockReturnValue(null);
      mockGbifService.getDistributions.mockResolvedValue(mockDistributions);

      const result = await service.getDistributions('1');

      expect(result).toEqual(mockDistributions);
      expect(mockGbifService.getDistributions).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'distributions:1',
        mockDistributions,
        86400,
      );
    });

    it('should return cached distributions when available', async () => {
      const mockDistributions = [
        {
          country: 'France',
          countryCode: 'FR',
        },
      ];

      mockCacheService.get.mockReturnValue(mockDistributions);

      const result = await service.getDistributions('1');

      expect(result).toEqual(mockDistributions);
      expect(mockGbifService.getDistributions).not.toHaveBeenCalled();
    });
  });

  describe('getMedia', () => {
    it('should get media for species from GBIF', async () => {
      const mockMedia = [
        {
          type: 'photo',
          identifier: 'https://example.com/photo.jpg',
          title: 'Boa Constrictor',
        },
      ];

      mockCacheService.get.mockReturnValue(null);
      mockGbifService.getMedia.mockResolvedValue(mockMedia);

      const result = await service.getMedia('1');

      expect(result).toEqual({
        results: mockMedia,
        source: 'gbif',
      });
      expect(mockGbifService.getMedia).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'media:1',
        { results: mockMedia },
        3600,
      );
    });

    it('should return cached media when available', async () => {
      const mockMedia = [
        {
          type: 'photo',
          identifier: 'https://example.com/photo.jpg',
          title: 'Boa Constrictor',
        },
      ];
      const cachedResult = { results: mockMedia };

      mockCacheService.get.mockReturnValue(cachedResult);

      const result = await service.getMedia('1');

      expect(result).toEqual({
        results: mockMedia,
        source: 'cache',
      });
      expect(mockGbifService.getMedia).not.toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should get metrics for species', async () => {
      const mockMetrics = {
        occurrences: 1000,
        observations: 500,
        lastUpdated: new Date('2026-01-31'),
      };

      mockCacheService.get.mockReturnValue(null);
      mockGbifService.getMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics('1');

      expect(result).toEqual(mockMetrics);
      expect(mockGbifService.getMetrics).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'metrics:1',
        mockMetrics,
        604800,
      );
    });

    it('should return cached metrics when available', async () => {
      const mockMetrics = {
        occurrences: 1000,
        observations: 500,
        lastUpdated: new Date('2026-01-31'),
      };

      mockCacheService.get.mockReturnValue(mockMetrics);

      const result = await service.getMetrics('1');

      expect(result).toEqual(mockMetrics);
      expect(mockGbifService.getMetrics).not.toHaveBeenCalled();
    });
  });

  describe('countOccurrences', () => {
    it('should count occurrences for species', async () => {
      const mockCount = {
        count: 1000,
        limit: 20,
        offset: 0,
      };

      mockCacheService.get.mockReturnValue(null);
      mockGbifService.countOccurrences.mockResolvedValue(mockCount);

      const result = await service.countOccurrences('1');

      expect(result).toEqual(mockCount);
      expect(mockGbifService.countOccurrences).toHaveBeenCalledWith('1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'occurrences:1',
        mockCount,
        604800,
      );
    });

    it('should return cached count when available', async () => {
      const mockCount = {
        count: 1000,
        limit: 20,
        offset: 0,
      };

      mockCacheService.get.mockReturnValue(mockCount);

      const result = await service.countOccurrences('1');

      expect(result).toEqual(mockCount);
      expect(mockGbifService.countOccurrences).not.toHaveBeenCalled();
    });
  });

  describe('clearCacheForSpecies', () => {
    it('should clear cache for all keys related to species', () => {
      mockCacheService.clearKey.mockImplementation(jest.fn());

      service.clearCacheForSpecies('1');

      expect(mockCacheService.clearKey).toHaveBeenCalledTimes(7);
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('iucn:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('species:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('media:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('vernacular:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('distributions:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('metrics:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('occurrences:1');
    });
  });

  describe('résilience GBIF (jamais de 500 sur une recherche, cache non pollué)', () => {
    const profile = {
      speciesId: 5221172,
      commonNameFr: 'Gecko léopard',
      scientificName: 'Eublepharis macularius',
    };

    describe('searchSpecies', () => {
      it('panne GBIF : réponse locale (vide) marquée degraded, SANS écriture en cache', async () => {
        mockGbifService.searchSpecies.mockRejectedValue(upstreamHttpError(503));

        const result = await service.searchSpecies('boa', 20, 0);

        expect(result.results).toEqual([]);
        expect(result.degraded).toBe(true);
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('disjoncteur ouvert : même repli, sans appel réseau supplémentaire ni 500', async () => {
        mockGbifService.searchSpecies.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );

        await expect(
          service.searchSpecies('boa', 20, 0),
        ).resolves.toMatchObject({
          results: [],
          degraded: true,
        });
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('disjoncteur ouvert avec résultat périmé en cache : il est servi (stale: true)', async () => {
        const stale = { results: [{ key: 1 }], total: 1, source: 'gbif' };
        mockCacheService.getStale.mockReturnValue(stale);
        mockGbifService.searchSpecies.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );

        const result = await service.searchSpecies('boa', 20, 0);

        expect(result).toEqual({ ...stale, stale: true });
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('réponse GBIF valide : mise en cache (1 h) ; un second appel est servi par le cache', async () => {
        mockGbifService.searchSpecies.mockResolvedValue({
          results: [{ key: 1 }],
          total: 1,
        });

        await service.searchSpecies('boa', 20, 0);
        expect(mockCacheService.set).toHaveBeenCalledWith(
          expect.stringContaining('search:gbif:boa'),
          expect.objectContaining({ source: 'gbif' }),
          3600,
        );

        const cached = { results: [{ key: 1 }], total: 1, source: 'gbif' };
        mockCacheService.get.mockReturnValue(cached);
        mockGbifService.searchSpecies.mockClear();
        await expect(service.searchSpecies('boa', 20, 0)).resolves.toBe(cached);
        expect(mockGbifService.searchSpecies).not.toHaveBeenCalled();
      });
    });

    describe('getSpecies', () => {
      beforeEach(() => {
        mockSpeciesProfileService.getBySpeciesId.mockResolvedValue({
          profile,
          feeding: null,
          habitat: null,
          behavior: null,
        });
      });

      it('disjoncteur ouvert + profil local : fiche locale servie, degraded, NON mise en cache', async () => {
        mockGbifService.getSpecies.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );

        const result = await service.getSpecies('5221172');

        expect(result).toMatchObject({
          key: 5221172,
          source: 'profile',
          class: '',
          degraded: true,
        });
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('timeout / 5xx GBIF + profil local : même repli local', async () => {
        mockGbifService.getSpecies.mockRejectedValue(upstreamHttpError(500));

        await expect(service.getSpecies('5221172')).resolves.toMatchObject({
          source: 'profile',
          degraded: true,
        });
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('panne GBIF + fiche périmée en cache : la fiche complète périmée est servie', async () => {
        const stale = { key: 5221172, class: 'Reptilia', source: 'profile' };
        mockCacheService.getStale.mockReturnValue(stale);
        mockGbifService.getSpecies.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );

        await expect(service.getSpecies('5221172')).resolves.toEqual({
          ...stale,
          stale: true,
        });
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('404 GBIF (espèce inconnue de GBIF, ex. race) + profil local : fiche mise en cache normalement', async () => {
        mockGbifService.getSpecies.mockRejectedValue(upstreamHttpError(404));

        const result = await service.getSpecies('5221172');

        expect(result.degraded).toBeUndefined();
        expect(mockCacheService.set).toHaveBeenCalledWith(
          'species:5221172',
          expect.any(Object),
          86400,
        );
      });

      it('panne GBIF SANS profil local : 503 explicite (on ne peut pas dire « introuvable »)', async () => {
        mockSpeciesProfileService.getBySpeciesId.mockResolvedValue({
          profile: null,
          feeding: null,
          habitat: null,
          behavior: null,
        });
        mockGbifService.getSpecies.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );

        const error = await service.getSpecies('999').catch((e) => e);

        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(503);
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });
    });

    describe('sous-ressources GBIF', () => {
      it('404 → NotFoundException', async () => {
        mockGbifService.getMedia.mockRejectedValue(upstreamHttpError(404));
        await expect(service.getMedia('1')).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('panne sans cache → 503 (jamais 500) et rien en cache', async () => {
        mockGbifService.getDistributions.mockRejectedValue(
          upstreamHttpError(502),
        );

        const error = await service.getDistributions('1').catch((e) => e);

        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(503);
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it('disjoncteur ouvert + cache périmé → valeurs périmées servies', async () => {
        mockGbifService.getVernacularNames.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );
        mockCacheService.getStale.mockReturnValue({ results: ['Boa'] });

        await expect(service.getVernacularNames('1')).resolves.toEqual({
          results: ['Boa'],
          source: 'stale-cache',
        });

        mockGbifService.getMetrics.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );
        mockCacheService.getStale.mockReturnValue({ usage: 1 });
        await expect(service.getMetrics('1')).resolves.toEqual({ usage: 1 });

        mockGbifService.getIucn.mockRejectedValue(
          new ExternalUnavailableError('gbif'),
        );
        mockCacheService.getStale.mockReturnValue({
          iucnRedListCategory: 'LC',
        });
        await expect(service.getIucn('1')).resolves.toEqual({
          iucnRedListCategory: 'LC',
        });

        expect(mockCacheService.set).not.toHaveBeenCalled();
      });
    });
  });
});
