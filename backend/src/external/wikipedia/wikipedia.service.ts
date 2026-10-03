import { Injectable, Logger } from '@nestjs/common';
import { describeHttpError } from '../http-safety';
import { ExternalHttpService } from '../http/external-http.service';
import { isUpstreamNotFound } from '../http/external-errors';

/**
 * Wikipedia API Service for fetching species information from Wikipedia
 * Uses Wikipedia API to get article content, summaries, and related species
 */
@Injectable()
export class WikipediaService {
  private readonly logger = new Logger(WikipediaService.name);
  private readonly wikipediaBaseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private readonly wikipediaSearchUrl = 'https://en.wikipedia.org/w/api.php';

  constructor(private readonly http: ExternalHttpService) {}

  /**
   * Search Wikipedia for a species by name
   * @param query Search query string
   * @returns Best matching article from Wikipedia
   */
  async searchSpecies(query: string) {
    try {
      const response = await this.http.get('wikipedia', this.wikipediaSearchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: query,
          srlimit: 5,
          format: 'json',
        },
      });

      return this.transformSearchResult(response.data);
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return null;
      }
      this.logger.error(`Wikipedia search failed: ${describeHttpError(error)}`);
      throw error;
    }
  }

  /**
   * Get Wikipedia article content for a species
   * @param title Article title (e.g., "Panthera leo")
   * @returns Article content and metadata
   */
  async getArticle(title: string) {
    try {
      const response = await this.http.get(
        'wikipedia',
        `${this.wikipediaBaseUrl}/page/summary/${encodeURIComponent(title)}`,
      );

      if (!response.data) {
        return null;
      }

      return this.transformArticle(response.data);
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return null;
      }
      this.logger.error(`Wikipedia article fetch failed: ${describeHttpError(error)}`);
      throw error;
    }
  }

  /**
   * Get Wikipedia extract (short summary) for a species
   * @param title Article title
   * @returns Extract text
   */
  async getExtract(title: string) {
    try {
      const response = await this.http.get('wikipedia', this.wikipediaSearchUrl, {
        params: {
          action: 'query',
          prop: 'extracts',
          titles: title,
          exintro: true,
          explaintext: true,
          redirects: true,
          format: 'json',
        },
      });

      const pages = response.data?.query?.pages;
      if (!pages) {
        return null;
      }

      const page = pages[Object.keys(pages)[0]];
      if (!page || !page.extract) {
        return null;
      }

      return {
        extract: page.extract,
        title: page.title,
        pageid: page.pageid,
        source: 'wikipedia',
      };
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return null;
      }
      this.logger.error(`Wikipedia extract fetch failed: ${describeHttpError(error)}`);
      throw error;
    }
  }

  /**
   * Get Wikipedia page with full content (including sections)
   * @param title Article title
   * @returns Full page content
   */
  async getPage(title: string) {
    try {
      const response = await this.http.get('wikipedia', this.wikipediaSearchUrl, {
        params: {
          action: 'parse',
          page: title,
          prop: 'text',
          redirects: true,
          format: 'json',
        },
      });

      if (!response.data || !response.data.parse || !response.data.parse.text) {
        return null;
      }

      return {
        content: response.data.parse.text['*'],
        title: response.data.parse.title,
        pageid: response.data.parse.pageid,
        source: 'wikipedia',
      };
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return null;
      }
      this.logger.error(`Wikipedia page fetch failed: ${describeHttpError(error)}`);
      throw error;
    }
  }

  /**
   * Get Wikipedia images for a species
   * @param title Article title
   * @returns List of images
   */
  async getImages(title: string) {
    try {
      const response = await this.http.get('wikipedia', `${this.wikipediaBaseUrl}/page/coordinates`, {
        params: {
          titles: title,
          format: 'json',
        },
      });

      if (!response.data || !response.data.query?.pages) {
        return null;
      }

      const pages = response.data.query.pages;
      const pageId = Object.keys(pages)[0];

      return {
        pageId,
        coordinates: pages[pageId]?.coordinates || [],
        source: 'wikipedia',
      };
    } catch (error) {
      if (isUpstreamNotFound(error)) {
        return null;
      }
      this.logger.error(`Wikipedia images fetch failed: ${describeHttpError(error)}`);
      throw error;
    }
  }

  /**
   * Check Wikipedia API health
   * @returns Health status
   */
  async checkApiHealth() {
    const started = Date.now();
    try {
      // Titre réel : « /page/summary » sans titre renvoie toujours 404 (faux « unhealthy »).
      await this.http.get(
        'wikipedia',
        `${this.wikipediaBaseUrl}/page/summary/Panthera_leo`,
        { retry: false },
      );
      return {
        status: 'healthy',
        responseTime: `${Date.now() - started}ms`,
        circuit: this.http.circuitState('wikipedia'),
      };
    } catch (error) {
      this.logger.warn(`Wikipedia API health check failed: ${describeHttpError(error)}`);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'unknown error',
        circuit: this.http.circuitState('wikipedia'),
      };
    }
  }

  /**
   * Transform Wikipedia search result (top match)
   */
  private transformSearchResult(data: any) {
    if (!data || !data.query || !Array.isArray(data.query.search) || data.query.search.length === 0) {
      return null;
    }

    const result = data.query.search[0];

    return {
      title: result.title,
      pageid: result.pageid,
      thumbnail: undefined,
      extract: result.snippet ? result.snippet.replace(/<[^>]*>/g, '') : undefined,
      source: 'wikipedia',
      timestamp: new Date(),
    };
  }

  /**
   * Transform Wikipedia article data
   */
  private transformArticle(data: any) {
    if (!data || data.error) {
      return null;
    }

    return {
      title: data.title,
      pageid: data.pageid,
      url: data.content_urls?.desktop?.page,
      thumbnail: data.thumbnail?.source,
      extract: data.extract,
      extractHtml: data.extract_html,
      originalimage: data.originalimage?.source,
      terms: data.terms || {},
      source: 'wikipedia',
      timestamp: new Date(),
    };
  }
}