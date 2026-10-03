import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';
import { NotFoundException } from '@nestjs/common';

describe('SpeciesController', () => {
  let controller: SpeciesController;

  const mockSpeciesService = {
    searchSpecies: jest.fn(),
    getSpecies: jest.fn(),
    getVernacularNames: jest.fn(),
    getIucn: jest.fn(),
    getDistributions: jest.fn(),
    getMedia: jest.fn(),
    getMetrics: jest.fn(),
    countOccurrences: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpeciesController],
      providers: [
        {
          provide: SpeciesService,
          useValue: mockSpeciesService,
        },
      ],
    }).compile();

    controller = module.get<SpeciesController>(SpeciesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should search for species with valid query', async () => {
      const mockResults = [
        {
          key: 1,
          canonicalName: 'Boa Constrictor',
          scientificName: 'Boa constrictor',
          rank: 'SPECIES',
          iucnRedListCategory: 'LC',
        },
      ];

      mockSpeciesService.searchSpecies.mockResolvedValue({
        results: mockResults,
        total: 1,
        source: 'gbif',
      });

      const result = await controller.search({
        q: 'boa',
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({
        results: mockResults,
        total: 1,
        source: 'gbif',
      });
      expect(mockSpeciesService.searchSpecies).toHaveBeenCalledWith(
        'boa',
        20,
        0,
        expect.any(Object),
      );
    });

    it('should use default limit and offset', async () => {
      const mockResults = [];
      mockSpeciesService.searchSpecies.mockResolvedValue({
        results: mockResults,
        total: 0,
        source: 'gbif',
      });

      await controller.search({ q: 'test' });

      expect(mockSpeciesService.searchSpecies).toHaveBeenCalledWith(
        'test',
        20,
        0,
        expect.any(Object),
      );
    });
  });

  describe('getSpecies', () => {
    it('should get species details by ID', async () => {
      const mockSpecies = {
        key: 1,
        canonicalName: 'Boa Constrictor',
        scientificName: 'Boa constrictor',
        rank: 'SPECIES',
      };

      mockSpeciesService.getSpecies.mockResolvedValue(mockSpecies);

      const result = await controller.getSpecies({ id: '1' });

      expect(result).toEqual(mockSpecies);
      expect(mockSpeciesService.getSpecies).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException for non-numeric id', async () => {
      await expect(controller.getSpecies({ id: 'invalid' })).rejects.toThrow(
        'Species not found',
      );
      expect(mockSpeciesService.getSpecies).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when species not found', async () => {
      mockSpeciesService.getSpecies.mockRejectedValue(
        new NotFoundException('Species with ID 999999 not found'),
      );

      await expect(controller.getSpecies({ id: '999999' })).rejects.toThrow(
        'Species not found',
      );
    });
  });

  describe('getVernacularNames', () => {
    it('should get vernacular names for species', async () => {
      const mockNames = [
        {
          language: 'french',
          name: 'Boa constrictor',
        },
      ];

      mockSpeciesService.getVernacularNames.mockResolvedValue({
        results: mockNames,
        source: 'gbif',
      });

      const result = await controller.getVernacularNames({ id: 'test-id' });

      expect(result).toEqual(mockNames);
      expect(mockSpeciesService.getVernacularNames).toHaveBeenCalledWith(
        'test-id',
      );
    });
  });

  describe('getIucn', () => {
    it('should get IUCN status for species', async () => {
      const mockIucn = {
        iucnRedListCategory: 'LC',
      };

      mockSpeciesService.getIucn.mockResolvedValue(mockIucn);

      const result = await controller.getIucn({ id: 'test-id' });

      expect(result).toEqual(mockIucn);
      expect(mockSpeciesService.getIucn).toHaveBeenCalledWith('test-id');
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

      mockSpeciesService.getDistributions.mockResolvedValue(mockDistributions);

      const result = await controller.getDistributions({ id: 'test-id' });

      expect(result).toEqual(mockDistributions);
      expect(mockSpeciesService.getDistributions).toHaveBeenCalledWith(
        'test-id',
      );
    });
  });

  describe('getMedia', () => {
    it('should get media for species', async () => {
      const mockMedia = [
        {
          type: 'photo',
          identifier: 'https://example.com/photo.jpg',
          title: 'Boa Constrictor',
        },
      ];

      mockSpeciesService.getMedia.mockResolvedValue({
        results: mockMedia,
        source: 'gbif',
      });

      const result = await controller.getMedia({ id: 'test-id' });

      expect(result).toEqual(mockMedia);
      expect(mockSpeciesService.getMedia).toHaveBeenCalledWith('test-id');
    });
  });

  describe('getMetrics', () => {
    it('should get metrics for species', async () => {
      const mockMetrics = {
        occurrences: 1000,
        observations: 500,
        lastUpdated: new Date(),
      };

      mockSpeciesService.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics({ id: 'test-id' });

      expect(result).toEqual(mockMetrics);
      expect(mockSpeciesService.getMetrics).toHaveBeenCalledWith('test-id');
    });
  });

  describe('countOccurrences', () => {
    it('should count occurrences for species', async () => {
      const mockCount = {
        count: 1000,
        limit: 20,
        offset: 0,
      };

      mockSpeciesService.countOccurrences.mockResolvedValue(mockCount);

      const result = await controller.countOccurrences({ id: 'test-id' });

      expect(result).toEqual(mockCount);
      expect(mockSpeciesService.countOccurrences).toHaveBeenCalledWith(
        'test-id',
      );
    });
  });
});
