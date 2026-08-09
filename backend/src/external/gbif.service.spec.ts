import { GbifService } from './gbif.service';

const mockCreate = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: (...args: any[]) => mockCreate(...args),
    isAxiosError: jest.fn(),
  },
  create: (...args: any[]) => mockCreate(...args),
  isAxiosError: jest.fn(),
}));

describe('GbifService', () => {
  let service: GbifService;
  let mockAxios: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = {
      get: jest.fn(),
    };
    mockCreate.mockReturnValue(mockAxios);
    service = new GbifService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.gbif.org/v1',
        headers: {
          'User-Agent': expect.stringContaining('Captivia'),
        },
        timeout: 10000,
      });
    });
  });

  describe('searchSpecies', () => {
    it('should search for species with valid query', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              key: 1,
              canonicalName: 'Boa Constrictor',
              scientificName: 'Boa constrictor',
              rank: 'SPECIES',
              iucnRedListCategory: 'LC',
            },
          ],
          total: 1,
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.searchSpecies('boa', 20, 0);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/search', {
        params: {
          q: 'boa',
          limit: 20,
          offset: 0,
          rank: 'SPECIES',
          highertaxonRank: 'SPECIES',
        },
      });
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        data: {
          results: [],
          total: 0,
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.searchSpecies('nonexistent', 20, 0);

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSpecies', () => {
    it('should get species details by key', async () => {
      const mockResponse = {
        data: {
          key: 1,
          canonicalName: 'Boa Constrictor',
          scientificName: 'Boa constrictor',
          rank: 'SPECIES',
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getSpecies('1');

      expect(result).toEqual(mockResponse.data);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1');
    });

    it('should throw error when species not found', async () => {
      const error = Object.assign(
        new Error('Request failed with status code 404'),
        {
          response: {
            status: 404,
            data: { message: 'Not found' },
          },
        },
      );

      mockAxios.get.mockRejectedValue(error);

      await expect(service.getSpecies('999999')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('getVernacularNames', () => {
    it('should get vernacular names for species', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              language: 'french',
              name: 'Boa constrictor',
            },
            {
              language: 'english',
              name: 'Boa Constrictor',
            },
          ],
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getVernacularNames('1');

      expect(result).toEqual([
        { language: 'french', name: 'Boa constrictor' },
        { language: 'english', name: 'Boa Constrictor' },
      ]);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1/vernacularNames');
    });

    it('should return empty array when no vernacular names', async () => {
      const mockResponse = {
        data: {
          results: [],
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getVernacularNames('1');

      expect(result).toEqual([]);
    });
  });

  describe('getIucn', () => {
    it('should get IUCN status for species', async () => {
      const mockResponse = {
        data: {
          iucnRedListCategory: 'LC',
          iucn: {
            status: 'Least Concern',
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getIucn('1');

      expect(result).toEqual(mockResponse.data);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1/iucn');
    });
  });

  describe('getDistributions', () => {
    it('should get distribution data for species', async () => {
      const mockResponse = {
        data: {
          results: [
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
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getDistributions('1');

      expect(result).toEqual(mockResponse.data.results);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1/distributions');
    });
  });

  describe('getMedia', () => {
    it('should get media for species', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              type: 'photo',
              creator: 'John Doe',
              identifier: 'https://example.com/photo.jpg',
              title: 'Boa Constrictor',
              license: 'CC-BY',
            },
          ],
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getMedia('1');

      expect(result).toEqual(mockResponse.data.results);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1/media');
    });
  });

  describe('getMetrics', () => {
    it('should get metrics for species', async () => {
      const mockResponse = {
        data: {
          usage: 1000,
          issues: 5,
          extensions: ['extension1', 'extension2'],
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getMetrics('1');

      expect(result).toEqual(mockResponse.data);
      expect(mockAxios.get).toHaveBeenCalledWith('/species/1/metrics');
    });
  });

  describe('countOccurrences', () => {
    it('should count occurrences for species', async () => {
      const mockResponse = {
        data: {
          count: 1000,
          limit: 20,
          offset: 0,
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.countOccurrences('1');

      expect(result).toEqual({
        count: 1000,
        limit: 20,
        offset: 0,
      });
      expect(mockAxios.get).toHaveBeenCalledWith('/occurrence/search', {
        params: {
          speciesKey: '1',
          limit: 1,
        },
      });
    });
  });

  describe('checkApiHealth', () => {
    it('should return healthy status when API is accessible', async () => {
      const mockResponse = {
        data: { count: 0 },
        headers: {
          'request-duration': '150ms',
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await service.checkApiHealth();

      expect(result).toEqual({
        status: 'healthy',
        responseTime: '150ms',
      });
    });

    it('should return unhealthy status when API is not accessible', async () => {
      const error = {
        message: 'Network error',
      };

      mockAxios.get.mockRejectedValue(error);

      const result = await service.checkApiHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        error: 'Network error',
      });
    });
  });

  describe('fetchWithBackoff', () => {
    it('should retry on rate limit error', async () => {
      jest.useFakeTimers();
      try {
        const axiosModule = require('axios');
        axiosModule.isAxiosError.mockReturnValue(true);

        const error1 = {
          response: {
            status: 429,
          },
        };

        const error2 = {
          response: {
            status: 429,
          },
        };

        const successResponse = {
          data: { key: 1 },
        };

        mockAxios.get
          .mockRejectedValueOnce(error1)
          .mockRejectedValueOnce(error2)
          .mockResolvedValueOnce(successResponse);

        const promise = service.searchSpecies('test', 20, 0);
        await jest.advanceTimersByTimeAsync(30000);
        const result = await promise;

        expect(result).toEqual(successResponse.data);
        expect(mockAxios.get).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should throw error after all retries fail', async () => {
      jest.useFakeTimers();
      try {
        const error = Object.assign(new Error('Request failed'), {
          response: { status: 500 },
        });
        mockAxios.get.mockRejectedValue(error);

        const promise = service.searchSpecies('test', 20, 0);
        const assertion = expect(promise).rejects.toMatchObject({
          response: { status: 500 },
        });
        await jest.advanceTimersByTimeAsync(30000);
        await assertion;
        // DEFAULT_RETRY_CONFIG.maxRetries = 5
        expect(mockAxios.get).toHaveBeenCalledTimes(5);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should not retry on non-retryable errors', async () => {
      jest.useFakeTimers();
      try {
        const error = Object.assign(new Error('Not found'), {
          response: { status: 404 },
        });
        mockAxios.get.mockRejectedValue(error);

        const promise = service.searchSpecies('test', 20, 0);
        const assertion = expect(promise).rejects.toMatchObject({
          response: { status: 404 },
        });
        await jest.advanceTimersByTimeAsync(30000);
        await assertion;
        expect(mockAxios.get).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});