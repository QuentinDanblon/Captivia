import { SpeciesTransformerService } from './species-transformer.service';
import { TransformedSpecies, Distribution, Media, Metrics } from './data-transformer.interface';

describe('SpeciesTransformerService', () => {
  let service: SpeciesTransformerService;

  beforeEach(() => {
    service = new SpeciesTransformerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transformSearchResults', () => {
    it('should transform search results', () => {
      const gbifResults = [
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
          vernacularNames: [
            { language: 'french', name: 'Boa constrictor' },
            { language: 'english', name: 'Boa Constrictor' },
          ],
          iucn: { status: 'Least Concern' },
          distributions: [
            {
              country: 'France',
              countryIsoCode: 'FR',
              status: 'native',
            },
          ],
          media: [
            {
              type: 'photo',
              creator: 'John Doe',
              identifier: 'https://example.com/photo.jpg',
              title: 'Boa Constrictor',
              license: 'CC-BY',
            },
          ],
          metrics: {
            usage: 1000,
            issues: 5,
            extensions: ['extension1'],
          },
          occurrenceCount: 1000,
        },
      ];

      const result = service.transformSearchResults(gbifResults);

      expect(result).toEqual({
        results: [
          {
            key: 1,
            name: 'Boa Constrictor',
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
            vernacularNames: ['Boa constrictor'],
            iucnStatus: 'Least Concern',
            distributions: [
              {
                country: 'France',
                countryIsoCode: 'FR',
                status: 'native',
              },
            ],
            media: [
              {
                type: 'photo',
                creator: 'John Doe',
                identifier: 'https://example.com/photo.jpg',
                title: 'Boa Constrictor',
                license: 'CC-BY',
                url: 'https://example.com/photo.jpg',
              },
            ],
            metrics: {
              usage: 1000,
              issues: 5,
              extensions: ['extension1'],
            },
            occurrenceCount: 1000,
            source: 'gbif',
            cachedAt: expect.any(Date),
          },
        ],
        total: 1,
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });

    it('should handle empty results', () => {
      const result = service.transformSearchResults([]);

      expect(result).toEqual({
        results: [],
        total: 0,
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });
  });

  describe('transformSpecies', () => {
    it('should transform species data', () => {
      const gbifSpecies = {
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
        vernacularNames: [
          { language: 'french', name: 'Boa constrictor' },
          { language: 'english', name: 'Boa Constrictor' },
        ],
        iucn: { status: 'Least Concern' },
        distributions: [
          {
            country: 'France',
            countryIsoCode: 'FR',
            status: 'native',
          },
        ],
        media: [
          {
            type: 'photo',
            creator: 'John Doe',
            identifier: 'https://example.com/photo.jpg',
            title: 'Boa Constrictor',
            license: 'CC-BY',
          },
        ],
        metrics: {
          usage: 1000,
          issues: 5,
          extensions: ['extension1'],
        },
        occurrenceCount: 1000,
      };

      const result = service.transformSpecies(gbifSpecies);

      expect(result).toEqual({
        key: 1,
        name: 'Boa Constrictor',
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
        vernacularNames: ['Boa constrictor'],
        iucnStatus: 'Least Concern',
        distributions: [
          {
            country: 'France',
            countryIsoCode: 'FR',
            status: 'native',
          },
        ],
        media: [
          {
            type: 'photo',
            creator: 'John Doe',
            identifier: 'https://example.com/photo.jpg',
            title: 'Boa Constrictor',
            license: 'CC-BY',
            url: 'https://example.com/photo.jpg',
          },
        ],
        metrics: {
          usage: 1000,
          issues: 5,
          extensions: ['extension1'],
        },
        occurrenceCount: 1000,
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });

    it('should use name as fallback for canonicalName', () => {
      const gbifSpecies = {
        key: 1,
        name: 'Boa Constrictor',
        rank: 'SPECIES',
      };

      const result = service.transformSpecies(gbifSpecies);

      expect(result.canonicalName).toBe('Boa Constrictor');
    });

    it('should use default status when not provided', () => {
      const gbifSpecies = {
        key: 1,
        canonicalName: 'Boa Constrictor',
        rank: 'SPECIES',
      };

      const result = service.transformSpecies(gbifSpecies);

      expect(result.status).toBe('UNKNOWN');
    });
  });

  describe('transformVernacularNames', () => {
    it('should transform vernacular names', () => {
      const gbifResults = [
        {
          language: 'french',
          name: 'Boa constrictor',
        },
        {
          language: 'english',
          name: 'Boa Constrictor',
        },
        {
          language: 'spanish',
          name: 'Boa Constrictor',
        },
      ];

      const result = service.transformVernacularNames(gbifResults);

      expect(result).toEqual({
        results: ['Boa constrictor'],
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });

    it('should return empty array when no french names', () => {
      const gbifResults = [
        {
          language: 'english',
          name: 'Boa Constrictor',
        },
        {
          language: 'spanish',
          name: 'Boa Constrictor',
        },
      ];

      const result = service.transformVernacularNames(gbifResults);

      expect(result.results).toEqual([]);
    });

    it('should handle empty results', () => {
      const result = service.transformVernacularNames([]);

      expect(result).toEqual({
        results: [],
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });
  });

  describe('transformMedia', () => {
    it('should transform media items', () => {
      const gbifResults = [
        {
          type: 'photo',
          creator: 'John Doe',
          identifier: 'https://example.com/photo.jpg',
          title: 'Boa Constrictor',
          license: 'CC-BY',
        },
        {
          type: 'video',
          creator: 'Jane Smith',
          identifier: 'https://example.com/video.mp4',
          title: 'Boa Constrictor Movement',
          license: 'CC0',
        },
      ];

      const result = service.transformMedia(gbifResults);

      expect(result).toEqual([
        {
          type: 'photo',
          creator: 'John Doe',
          identifier: 'https://example.com/photo.jpg',
          title: 'Boa Constrictor',
          license: 'CC-BY',
          url: 'https://example.com/photo.jpg',
        },
        {
          type: 'video',
          creator: 'Jane Smith',
          identifier: 'https://example.com/video.mp4',
          title: 'Boa Constrictor Movement',
          license: 'CC0',
          url: 'https://example.com/video.mp4',
        },
      ]);
    });

    it('keeps the source page and MIME type when GBIF provides them (photo credit)', () => {
      const [media] = service.transformMedia([
        {
          type: 'StillImage',
          format: 'image/jpeg',
          creator: 'Ana Martínez',
          identifier: 'https://example.com/photo.jpg',
          references: 'https://www.inaturalist.org/photos/1',
          license: 'http://creativecommons.org/licenses/by/4.0/',
        },
      ]);

      expect(media).toMatchObject({
        url: 'https://example.com/photo.jpg',
        references: 'https://www.inaturalist.org/photos/1',
        format: 'image/jpeg',
      });
    });

    it('should handle empty results', () => {
      const result = service.transformMedia([]);

      expect(result).toEqual([]);
    });
  });

  describe('transformDistributions', () => {
    it('should transform distribution items', () => {
      const gbifResults = [
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
      ];

      const result = service.transformDistributions(gbifResults);

      expect(result).toEqual([
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
      ]);
    });

    it('should handle empty results', () => {
      const result = service.transformDistributions([]);

      expect(result).toEqual([]);
    });
  });

  describe('transformMetrics', () => {
    it('should transform metrics', () => {
      const gbifMetrics = {
        usage: 1000,
        issues: 5,
        extensions: ['extension1', 'extension2'],
      };

      const result = service.transformMetrics(gbifMetrics);

      expect(result).toEqual({
        usage: 1000,
        issues: 5,
        extensions: ['extension1', 'extension2'],
      });
    });

    it('should use default values when metrics are missing', () => {
      const gbifMetrics = null;

      const result = service.transformMetrics(gbifMetrics);

      expect(result).toEqual({
        usage: 0,
        issues: 0,
        extensions: [],
      });
    });

    it('should handle partial metrics', () => {
      const gbifMetrics = {
        usage: 1000,
      };

      const result = service.transformMetrics(gbifMetrics);

      expect(result).toEqual({
        usage: 1000,
        issues: 0,
        extensions: [],
      });
    });
  });

  describe('transformOccurrenceCount', () => {
    it('should transform occurrence count', () => {
      const gbifResult = {
        count: 1000,
        limit: 20,
        offset: 0,
      };

      const result = service.transformOccurrenceCount(gbifResult);

      expect(result).toEqual({
        count: 1000,
        limit: 20,
        offset: 0,
        source: 'gbif',
        cachedAt: expect.any(Date),
      });
    });

    it('should parse count as integer', () => {
      const gbifResult = {
        count: '1000',
        limit: '20',
        offset: '0',
      };

      const result = service.transformOccurrenceCount(gbifResult);

      expect(result.count).toBe(1000);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should handle missing count', () => {
      const gbifResult = {
        limit: 20,
        offset: 0,
      };

      const result = service.transformOccurrenceCount(gbifResult);

      expect(result.count).toBe(0);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });
});