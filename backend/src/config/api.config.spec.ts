import { ConfigService } from '@nestjs/config';
import { ApiConfigService } from './api.config';

function buildService(values: Record<string, unknown>): ApiConfigService {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in values ? values[key] : fallback,
    ),
  } as unknown as ConfigService;
  return new ApiConfigService(config);
}

describe('ApiConfigService', () => {
  it('getWikipediaRateLimit lit WIKIPEDIA_RATE_WINDOW (et non WIKIDATA_RATE_WINDOW)', () => {
    const service = buildService({
      WIKIPEDIA_RATE_LIMIT: 50,
      WIKIPEDIA_RATE_WINDOW: 1234,
      WIKIDATA_RATE_WINDOW: 9999,
    });
    expect(service.getWikipediaRateLimit()).toEqual({
      limit: 50,
      window: 1234,
    });
  });

  it('getWikidataRateLimit lit WIKIDATA_RATE_WINDOW', () => {
    const service = buildService({
      WIKIPEDIA_RATE_WINDOW: 1234,
      WIKIDATA_RATE_WINDOW: 9999,
    });
    expect(service.getWikidataRateLimit().window).toBe(9999);
  });
});
