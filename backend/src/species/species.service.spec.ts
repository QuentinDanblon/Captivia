import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesService } from './species.service';
import { SpeciesProfileService } from './species-profile.service';
import { NotFoundException } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { GbifService } from '../external/gbif.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilterService } from '../filters/species-filter.service';
import { mockCacheService, mockGbifService, mockTransformerService, mockFilterService, mockSpeciesProfileService } from '../../test/test-mocks';

describe('SpeciesService', () => {
  let service: SpeciesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTransformerService.transformSearchResults.mockImplementation((results: any[]) => ({
      results: results ?? [],
      total: results?.length ?? 0,
      source: 'gbif',
      cachedAt: new Date(),
    }));
    mockTransformerService.transformSpecies.mockImplementation((item: any) => ({ ...item }));
    mockTransformerService.transformVernacularNames.mockImplementation((arr: any[]) => ({
      results: (arr ?? []).filter((v: any) => v.language === 'french').map((v: any) => v.name),
      source: 'gbif',
      cachedAt: new Date(),
    }));
    mockTransformerService.transformMedia.mockImplementation((arr: any[]) => arr ?? []);
    mockFilterService.applyFilters.mockImplementation((results: any[], _filters: any) => ({
      results: results ?? [],
      total: results?.length ?? 0,
      filtersApplied: [] as string[],
    }));
    // Profile DB vide par défaut → fallback GBIF ; détail sans profil local
    mockSpeciesProfileService.searchFromProfile.mockResolvedValue({ results: [], total: 0, source: 'profile' });
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
        { provide: SpeciesTransformerService, useValue: mockTransformerService },
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

      const result = await service.searchSpecies('boa', 10, 0, { class: 'Reptilia' } as any);

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
        profile: mockProfile,
        feeding: { food: 'insectes' },
        habitat: { setup: 'terrarium' },
        behavior: { activity: 'nocturne' },
      });
      expect(mockGbifService.getSpecies).toHaveBeenCalledWith('5221172');
      expect(mockCacheService.set).toHaveBeenCalledWith('species:5221172', expect.any(Object), 86400);
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
      expect(mockCacheService.set).toHaveBeenCalledWith('vernacular:1', expect.any(Object), 43200);
    });

    it('should return cached vernacular names when available', async () => {
      const cachedResult = { results: ['Boa constrictor'], source: 'cache', cachedAt: new Date() };

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
      expect(mockCacheService.set).toHaveBeenCalledWith('distributions:1', mockDistributions, 86400);
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
      expect(mockCacheService.set).toHaveBeenCalledWith('media:1', { results: mockMedia }, 3600);
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
      expect(mockCacheService.set).toHaveBeenCalledWith('metrics:1', mockMetrics, 604800);
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
      expect(mockCacheService.set).toHaveBeenCalledWith('occurrences:1', mockCount, 604800);
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

      expect(mockCacheService.clearKey).toHaveBeenCalledTimes(6);
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('species:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('media:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('vernacular:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('distributions:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('metrics:1');
      expect(mockCacheService.clearKey).toHaveBeenCalledWith('occurrences:1');
    });
  });
});
