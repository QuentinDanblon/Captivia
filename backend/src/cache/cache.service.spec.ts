import { Test } from '@nestjs/testing';
import {
  CACHE_MAX_ENTRIES,
  CACHE_STALE_GRACE_SECONDS,
  CACHE_MAX_KEY_LENGTH,
  CacheService,
  normalizeCacheKey,
} from './cache.service';
import { ConfigService } from '@nestjs/config';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CACHE_TTL') return '3600';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const result = service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return data for existing key', () => {
      const testData = { key: 'value' };
      service.set('test-key', testData);
      const result = service.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for expired key', () => {
      const testData = { key: 'value' };
      service.set('test-key', testData);

      // Fait expirer l'entrée (TTL par défaut 24 h) en avançant l'horloge
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 500000 * 1000);

      const result = service.get('test-key');
      expect(result).toBeNull();
    });

    it('should return null for expired key when checking has()', () => {
      const testData = { key: 'value' };
      service.set('test-key', testData);

      // Fait expirer l'entrée (TTL par défaut 24 h) en avançant l'horloge
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 500000 * 1000);

      const result = service.has('test-key');
      expect(result).toBe(false);
    });
  });

  describe('set', () => {
    it('should store data with key', () => {
      const testData = { key: 'value' };
      service.set('test-key', testData);

      const result = service.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should update existing key', () => {
      const testData1 = { key: 'value1' };
      const testData2 = { key: 'value2' };

      service.set('test-key', testData1);
      service.set('test-key', testData2);

      const result = service.get('test-key');
      expect(result).toEqual(testData2);
    });
  });

  describe('has', () => {
    it('should return false for non-existent key', () => {
      const result = service.has('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true for existing key', () => {
      service.set('test-key', { key: 'value' });
      const result = service.has('test-key');
      expect(result).toBe(true);
    });

    it('should return false for expired key', () => {
      service.set('test-key', { key: 'value' });

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 500000 * 1000);

      const result = service.has('test-key');
      expect(result).toBe(false);
    });
  });

  describe('getStale (repli quand un fournisseur externe est en panne)', () => {
    it('renvoie la valeur fraîche comme `get`', () => {
      service.set('k', { v: 1 }, 60);
      expect(service.getStale('k')).toEqual({ v: 1 });
    });

    it('renvoie la valeur EXPIRÉE pendant la période de grâce, alors que `get` renvoie null', () => {
      service.set('k', { v: 1 }, 60);
      const base = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(base + 3600 * 1000); // TTL dépassé de 59 min

      expect(service.get('k')).toBeNull();
      expect(service.has('k')).toBe(false);
      expect(service.getStale('k')).toEqual({ v: 1 });
    });

    it('ne renvoie plus rien après la période de grâce (7 jours)', () => {
      service.set('k', { v: 1 }, 60);
      const base = Date.now();
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(base + (CACHE_STALE_GRACE_SECONDS + 61) * 1000);

      expect(service.getStale('k')).toBeNull();
      expect(service.get('k')).toBeNull();
    });

    it("une clé absente ou supprimée (clearKey) n'a pas de valeur périmée", () => {
      expect(service.getStale('absent')).toBeNull();
      service.set('k', { v: 1 }, 60);
      service.clearKey('k');
      expect(service.getStale('k')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      service.set('key1', { key: 'value1' });
      service.set('key2', { key: 'value2' });
      service.set('key3', { key: 'value3' });

      expect(service.getCacheSize()).toBe(3);

      service.clear();

      expect(service.getCacheSize()).toBe(0);
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
      expect(service.get('key3')).toBeNull();
    });
  });

  describe('clearKey', () => {
    it('should clear specific key', () => {
      service.set('key1', { key: 'value1' });
      service.set('key2', { key: 'value2' });
      service.set('key3', { key: 'value3' });

      service.clearKey('key2');

      expect(service.getCacheSize()).toBe(2);
      expect(service.get('key1')).toEqual({ key: 'value1' });
      expect(service.get('key2')).toBeNull();
      expect(service.get('key3')).toEqual({ key: 'value3' });
    });

    it('should do nothing for non-existent key', () => {
      service.set('key1', { key: 'value1' });

      service.clearKey('nonexistent');

      expect(service.getCacheSize()).toBe(1);
      expect(service.get('key1')).toEqual({ key: 'value1' });
    });
  });

  describe('getCacheSize', () => {
    it('should return 0 for empty cache', () => {
      expect(service.getCacheSize()).toBe(0);
    });

    it('should return correct size', () => {
      service.set('key1', { key: 'value1' });
      service.set('key2', { key: 'value2' });
      service.set('key3', { key: 'value3' });

      expect(service.getCacheSize()).toBe(3);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('ttl');
      expect(stats).toHaveProperty('defaultTtl');
      expect(stats).toHaveProperty('ttlConfig');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.ttl).toBe('number');
      expect(typeof stats.defaultTtl).toBe('number');
      expect(typeof stats.ttlConfig).toBe('object');
    });
  });

  describe('TTL configuration', () => {
    it('should use default TTL when CACHE_TTL not set', () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'CACHE_TTL') return undefined;
          return null;
        }),
      };

      const testService = new CacheService(
        mockConfig as unknown as ConfigService,
      );
      const stats = testService.getCacheStats();

      // Default TTL should be 86400 seconds (24 hours) from CACHE_CONFIG.species
      expect(stats.ttl).toBe(86400);
      expect(stats.defaultTtl).toBe(86400);
    });
  });
  describe('TTL personnalisé (en secondes)', () => {
    it('respecte customTtl en secondes et expire ensuite', () => {
      const start = 1_000_000_000_000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      service.set('custom-key', 'v', 10);

      now.mockReturnValue(start + 9_000);
      expect(service.get('custom-key')).toBe('v');

      now.mockReturnValue(start + 10_001);
      expect(service.get('custom-key')).toBeNull();
      expect(service.has('custom-key')).toBe(false);
    });

    it('un customTtl court prévaut sur le TTL du préfixe de clé', () => {
      const start = 1_000_000_000_000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      service.set('species:1', 'v', 5); // le TTL species est de 24 h

      now.mockReturnValue(start + 6_000);
      expect(service.get('species:1')).toBeNull();
    });

    it('un customTtl long prévaut sur le TTL du préfixe de clé', () => {
      const start = 1_000_000_000_000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      service.set('media:1', 'v', 7 * 86400); // le TTL media est de 1 h

      now.mockReturnValue(start + 2 * 3600 * 1000);
      expect(service.get('media:1')).toBe('v');
    });

    it.each([0, -5, NaN, undefined])(
      'ignore un customTtl invalide (%p) et applique le TTL par défaut',
      (ttl) => {
        const start = 1_000_000_000_000;
        const now = jest.spyOn(Date, 'now').mockReturnValue(start);
        service.set('media:2', 'v', ttl);

        now.mockReturnValue(start + 3_599_000);
        expect(service.get('media:2')).toBe('v');
        now.mockReturnValue(start + 3_601_000);
        expect(service.get('media:2')).toBeNull();
      },
    );

    it("expiresAt est fixé à l'écriture : lire ne prolonge pas la vie de l'entrée", () => {
      const start = 1_000_000_000_000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      service.set('k', 'v', 10);

      now.mockReturnValue(start + 8_000);
      expect(service.get('k')).toBe('v');
      now.mockReturnValue(start + 11_000);
      expect(service.get('k')).toBeNull();
    });
  });

  describe('borne de taille (LRU)', () => {
    it('ne dépasse jamais CACHE_MAX_ENTRIES et évince la plus ancienne', () => {
      for (let i = 0; i < CACHE_MAX_ENTRIES + 10; i++) {
        service.set(`k${i}`, i);
      }
      expect(service.getCacheSize()).toBe(CACHE_MAX_ENTRIES);
      expect(service.get('k0')).toBeNull();
      expect(service.get('k9')).toBeNull();
      expect(service.get('k10')).toBe(10);
      expect(service.get(`k${CACHE_MAX_ENTRIES + 9}`)).toBe(
        CACHE_MAX_ENTRIES + 9,
      );
    });

    it("une lecture protège l'entrée de l'éviction (LRU)", () => {
      for (let i = 0; i < CACHE_MAX_ENTRIES; i++) {
        service.set(`k${i}`, i);
      }
      expect(service.get('k0')).toBe(0); // k0 devient la plus récente
      service.set('new', 'x'); // évince k1, pas k0

      expect(service.get('k0')).toBe(0);
      expect(service.get('k1')).toBeNull();
      expect(service.get('new')).toBe('x');
    });

    it('réécrire une clé ne fait pas grossir le cache', () => {
      service.set('same', 1);
      service.set('same', 2);
      expect(service.getCacheSize()).toBe(1);
      expect(service.get('same')).toBe(2);
    });
  });

  describe('clés longues', () => {
    it('hache les clés > 200 caractères (get/set/has/clearKey cohérents)', () => {
      const longKey = 'search:' + 'x'.repeat(500);
      service.set(longKey, 'v');

      const internal = service as unknown as { cache: Map<string, unknown> };
      const storedKeys = Array.from(internal.cache.keys());
      expect(storedKeys).toHaveLength(1);
      expect(storedKeys[0]).toBe(normalizeCacheKey(longKey));
      expect(storedKeys[0].length).toBeLessThanOrEqual(CACHE_MAX_KEY_LENGTH);
      expect(storedKeys[0]).toMatch(/^sha1:[0-9a-f]{40}$/);

      expect(service.get(longKey)).toBe('v');
      expect(service.has(longKey)).toBe(true);
      expect(service.get(longKey + 'y')).toBeNull();

      service.clearKey(longKey);
      expect(service.has(longKey)).toBe(false);
    });

    it('conserve le TTL du préfixe pour une clé longue', () => {
      const start = 1_000_000_000_000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      const longKey = 'media:' + 'x'.repeat(500); // TTL media = 1 h
      service.set(longKey, 'v');

      now.mockReturnValue(start + 3_601_000);
      expect(service.get(longKey)).toBeNull();
    });

    it('ne modifie pas les clés courtes', () => {
      expect(normalizeCacheKey('species:1')).toBe('species:1');
      expect(normalizeCacheKey('a'.repeat(CACHE_MAX_KEY_LENGTH))).toBe(
        'a'.repeat(CACHE_MAX_KEY_LENGTH),
      );
    });
  });
});
