import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Wikipedia API Service for fetching species information from Wikipedia
 * Uses Wikipedia API to get article content, summaries, and related species
 */
@Injectable()
export class WikipediaService {
  private readonly logger = new Logger(WikipediaService.name);
  private readonly wikipediaApi: AxiosInstance;
  private readonly wikipediaSearchApi: AxiosInstance;
  private readonly wikipediaBaseUrl = 'https://en.wikipedia.org/api/rest_v1';

  constructor() {
    this.wikipediaApi = axios.create({
      baseURL: this.wikipediaBaseUrl,
      headers: {
        'User-Agent': 'Captivia/1.0 (https://captivia.com)',
      },
      timeout: 10000,
    });

    this.wikipediaSearchApi = axios.create({
      baseURL: 'https://en.wikipedia.org/w/api.php',
      headers: {
        'User-Agent': 'Captivia/1.0 (https://captivia.com)',
      },
      timeout: 10000,
    });
  }

  /**
   * Search Wikipedia for a species by name
   * @param query Search query string
   * @returns Best matching article from Wikipedia
   */
  async searchSpecies(query: string) {
    try {
      const response = await this.wikipediaSearchApi.get('', {
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
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikipedia search failed', error);
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
      const response = await this.wikipediaApi.get(`/page/summary/${encodeURIComponent(title)}`);

      if (!response.data) {
        return null;
      }

      return this.transformArticle(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikipedia article fetch failed', error);
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
      const response = await this.wikipediaSearchApi.get('', {
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
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikipedia extract fetch failed', error);
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
      const response = await this.wikipediaSearchApi.get('', {
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
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikipedia page fetch failed', error);
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
      const response = await this.wikipediaApi.get('/page/coordinates', {
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
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Wikipedia images fetch failed', error);
      throw error;
    }
  }

  /**
   * Check Wikipedia API health
   * @returns Health status
   */
  async checkApiHealth() {
    try {
      const response = await this.wikipediaApi.get('/page/summary', {
        params: {
          titles: 'Panthera leo',
          format: 'json',
        },
        timeout: 5000,
      });
      return {
        status: 'healthy',
        responseTime: response.headers['request-duration'] || 'unknown',
      };
    } catch (error) {
      this.logger.error('Wikipedia API health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message,
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