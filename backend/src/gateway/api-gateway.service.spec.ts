/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
import {
  ApiGatewayService,
  ENRICH_CONCURRENCY,
  MAX_ENRICHED_RESULTS,
} from './api-gateway.service';
import { CacheService } from '../cache/cache.service';
import { mapWithConcurrency } from './concurrency.util';

function buildService(options: {
  gbifCount: number;
  onWikipedia?: () => Promise<unknown>;
}) {
  const results = Array.from({ length: options.gbifCount }, (_, i) => ({
    key: i + 1,
    canonicalName: `Species ${i + 1}`,
  }));

  const gbifService = {
    searchSpecies: jest.fn().mockResolvedValue({ results }),
  };
  const wikipediaService = {
    searchSpecies: jest.fn(options.onWikipedia ?? (async () => null)),
  };
  const wikidataService = {
    searchSpecies: jest.fn().mockResolvedValue({ results: [] }),
  };
  const transformerService = {
    transformSpecies: jest.fn((s: { key: number; canonicalName: string }) => ({
      key: s.key,
      name: s.canonicalName,
    })),
  };
  // Vrai cache mémoire (la config n'est pas utilisée dans le constructeur)
  const cacheService = new CacheService({ get: jest.fn() } as never);

  const service = new ApiGatewayService(
    wikipediaService as never,
    wikidataService as never,
    gbifService as never,
    transformerService as never,
    {} as never,
    cacheService,
  );
  return { service, gbifService, wikipediaService, wikidataService };
}

describe('ApiGatewayService.searchSpecies', () => {
  it('transmet un limit borné à GBIF (au maximum 20)', async () => {
    const { service, gbifService } = buildService({ gbifCount: 3 });
    await service.searchSpecies('boa', 500);
    expect(gbifService.searchSpecies).toHaveBeenCalledWith('boa', 20, 0);
  });

  it.each([
    [0, 1],
    [-4, 1],
    [7.9, 7],
    [Number.NaN, 10],
  ])('limit %p est ramené à %p', async (input, expected) => {
    const { service, gbifService } = buildService({ gbifCount: 1 });
    await service.searchSpecies(`q${String(input)}`, input);
    expect(gbifService.searchSpecies).toHaveBeenCalledWith(
      expect.any(String),
      expected,
      0,
    );
  });

  it('utilise 10 par défaut', async () => {
    const { service, gbifService } = buildService({ gbifCount: 1 });
    await service.searchSpecies('boa');
    expect(gbifService.searchSpecies).toHaveBeenCalledWith('boa', 10, 0);
  });

  it("n'enrichit que MAX_ENRICHED_RESULTS résultats mais renvoie tous les résultats", async () => {
    const { service, wikipediaService } = buildService({ gbifCount: 20 });
    const out = (await service.searchSpecies('boa', 20)) as {
      results: Array<{ enriched: unknown }>;
      total: number;
    };

    expect(MAX_ENRICHED_RESULTS).toBe(5);
    expect(out.total).toBe(20);
    expect(wikipediaService.searchSpecies).toHaveBeenCalledTimes(5);
    expect(out.results.slice(0, 5).every((r) => r.enriched !== null)).toBe(
      true,
    );
    expect(out.results.slice(5).every((r) => r.enriched === null)).toBe(true);
  });

  it("limite la concurrence de l'enrichissement à 3", async () => {
    let active = 0;
    let maxActive = 0;
    const { service } = buildService({
      gbifCount: 10,
      onWikipedia: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active--;
        return null;
      },
    });

    await service.searchSpecies('boa', 10);
    expect(ENRICH_CONCURRENCY).toBe(3);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("un échec d'enrichissement n'échoue pas la recherche", async () => {
    const { service } = buildService({
      gbifCount: 2,
      onWikipedia: async () => {
        throw new Error('boom');
      },
    });
    const out = (await service.searchSpecies('boa', 2)) as {
      results: unknown[];
    };
    expect(out.results).toHaveLength(2);
  });
});

describe('mapWithConcurrency', () => {
  it("préserve l'ordre et respecte la concurrence", async () => {
    let active = 0;
    let maxActive = 0;
    const out = await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (n) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10 - n));
        active--;
        return n * 2;
      },
    );
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(maxActive).toBe(3);
  });

  it('gère une liste vide et une concurrence invalide', async () => {
    await expect(
      mapWithConcurrency([], 3, async (n: number) => n),
    ).resolves.toEqual([]);
    await expect(
      mapWithConcurrency([1, 2], 0, async (n) => n),
    ).resolves.toEqual([1, 2]);
  });
});
