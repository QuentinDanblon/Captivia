import { SpeciesFilterService } from './species-filter.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilter } from './species-filter.interface';

describe('SpeciesFilterService', () => {
  let service: SpeciesFilterService;

  beforeEach(() => {
    const transformer = new SpeciesTransformerService();
    service = new SpeciesFilterService(transformer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('applyFilters', () => {
    const mockSpecies = [
      {
        key: 1,
        canonicalName: 'Boa Constrictor',
        scientificName: 'Boa constrictor',
        rank: 'SPECIES',
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: 'Reptilia',
        order: 'Squamata',
        family: 'Boidae',
        genus: 'Boa',
        status: 'LC',
        vernacularNames: [{ language: 'french', name: 'Boa constrictor' }],
        iucn: { status: 'Least Concern' },
        distributions: [
          {
            country: 'France',
            countryIsoCode: 'FR',
            status: 'native',
          },
          {
            country: 'Germany',
            countryIsoCode: 'DE',
            status: 'introduced',
          },
        ],
        media: [],
        metrics: {
          usage: 1000,
          issues: 5,
          extensions: [],
        },
        occurrenceCount: 1000,
      },
      {
        key: 2,
        canonicalName: 'Python Regius',
        scientificName: 'Python regius',
        rank: 'SPECIES',
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: 'Reptilia',
        order: 'Squamata',
        family: 'Pythonidae',
        genus: 'Python',
        status: 'LC',
        vernacularNames: [{ language: 'french', name: 'Python regius' }],
        iucn: { status: 'Least Concern' },
        distributions: [
          {
            country: 'France',
            countryIsoCode: 'FR',
            status: 'native',
          },
        ],
        media: [],
        metrics: {
          usage: 500,
          issues: 2,
          extensions: [],
        },
        occurrenceCount: 500,
      },
    ];

    it('should apply rank filter', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(2);
      expect(result.filtersApplied).toContain('rank:SPECIES');
    });

    it('should apply kingdom filter', () => {
      const filters: SpeciesFilter = {
        kingdom: 'Animalia',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(2);
      expect(result.filtersApplied).toContain('kingdom:Animalia');
    });

    it('should apply family filter', () => {
      const filters: SpeciesFilter = {
        family: 'Boidae',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].canonicalName).toBe('Boa Constrictor');
      expect(result.filtersApplied).toContain('family:Boidae');
    });

    it('should apply IUCN status filter', () => {
      const filters: SpeciesFilter = {
        iucnStatus: 'Least Concern',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(2);
      expect(result.filtersApplied).toContain('iucn:Least Concern');
    });

    it('should apply country filter', () => {
      const filters: SpeciesFilter = {
        country: 'France',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(2);
      expect(result.filtersApplied).toContain('country:France');
    });

    it('should apply limit filter', () => {
      const filters: SpeciesFilter = {
        limit: 1,
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(1);
      expect(result.filtersApplied).toContain('limit:1');
    });

    it('should apply multiple filters', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
        family: 'Boidae',
        country: 'France',
      };

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(1);
      expect(result.filtersApplied).toContain('rank:SPECIES');
      expect(result.filtersApplied).toContain('family:Boidae');
      expect(result.filtersApplied).toContain('country:France');
    });

    it('should return all results when no filters applied', () => {
      const filters: SpeciesFilter = {};

      const result = service.applyFilters(mockSpecies, filters);

      expect(result.results).toHaveLength(2);
      expect(result.filtersApplied).toHaveLength(0);
    });

    it('should handle empty species array', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
      };

      const result = service.applyFilters([], filters);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('buildGbifQuery', () => {
    it('should build query with rank', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        rank: 'SPECIES',
      });
    });

    it('should build query with kingdom', () => {
      const filters: SpeciesFilter = {
        kingdom: 'Animalia',
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        kingdom: 'Animalia',
      });
    });

    it('should build query with family', () => {
      const filters: SpeciesFilter = {
        family: 'Boidae',
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        family: 'Boidae',
      });
    });

    it('should build query with limit', () => {
      const filters: SpeciesFilter = {
        limit: 10,
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        limit: 10,
      });
    });

    it('should build query with offset', () => {
      const filters: SpeciesFilter = {
        offset: 5,
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        offset: 5,
      });
    });

    it('should build query with multiple filters', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
        kingdom: 'Animalia',
        family: 'Boidae',
        limit: 10,
        offset: 5,
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        rank: 'SPECIES',
        kingdom: 'Animalia',
        family: 'Boidae',
        limit: 10,
        offset: 5,
      });
    });

    it('should not include undefined filters', () => {
      const filters: SpeciesFilter = {
        rank: 'SPECIES',
        kingdom: undefined,
        family: 'Boidae',
      };

      const query = service.buildGbifQuery(filters);

      expect(query).toEqual({
        rank: 'SPECIES',
        family: 'Boidae',
      });
    });
  });
});
