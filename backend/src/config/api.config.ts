import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuration for external API services
 * Handles Wikipedia and Wikidata API settings
 */
@Injectable()
export class ApiConfigService {
  private readonly logger = new Logger(ApiConfigService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get Wikipedia API base URL
   */
  getWikipediaApiBaseUrl(): string {
    const url = this.configService.get<string>(
      'WIKIPEDIA_API_BASE_URL',
      'https://en.wikipedia.org/api/rest_v1',
    );
    this.logger.debug(`Wikipedia API URL: ${url}`);
    return url;
  }

  /**
   * Get Wikipedia rate limit configuration
   */
  getWikipediaRateLimit(): { limit: number; window: number } {
    const limit = this.configService.get<number>(
      'WIKIPEDIA_RATE_LIMIT',
      100,
    );
    const window = this.configService.get<number>(
      'WIKIPEDIA_RATE_WINDOW',
      60000,
    );
    return { limit, window };
  }

  /**
   * Get Wikidata API base URL
   */
  getWikidataApiBaseUrl(): string {
    const url = this.configService.get<string>(
      'WIKIDATA_API_BASE_URL',
      'https://query.wikidata.org/sparql',
    );
    this.logger.debug(`Wikidata API URL: ${url}`);
    return url;
  }

  /**
   * Get Wikidata rate limit configuration
   */
  getWikidataRateLimit(): { limit: number; window: number } {
    const limit = this.configService.get<number>(
      'WIKIDATA_RATE_LIMIT',
      100,
    );
    const window = this.configService.get<number>(
      'WIKIDATA_RATE_WINDOW',
      60000,
    );
    return { limit, window };
  }

  /**
   * Get API rate limiting configuration
   */
  getApiRateLimitConfig(): {
    enabled: boolean;
    ttl: number;
  } {
    return {
      enabled: this.configService.get<boolean>(
        'API_RATE_LIMIT_ENABLED',
        true,
      ),
      ttl: this.configService.get<number>('API_RATE_LIMIT_TTL', 3600),
    };
  }

  /**
   * Get log level configuration
   */
  getLogLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info');
  }
}
