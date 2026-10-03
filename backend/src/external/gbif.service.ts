import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { describeHttpError } from './http-safety';
import { ExternalHttpService } from './http/external-http.service';

/** Clé GBIF : entier positif — elle est interpolée dans l'URL, donc validée ici aussi. */
const GBIF_KEY_REGEX = /^[1-9]\d{0,14}$/;

/**
 * Client GBIF. Tous les appels passent par le client HTTP partagé
 * (timeout 5 s, 3 tentatives max avec backoff + jitter sur erreur réseau / 5xx / 429,
 * budget total 7,5 s, disjoncteur « gbif »). Les erreurs sont propagées : c'est
 * `SpeciesService` qui choisit le repli (profil local, cache périmé).
 */
@Injectable()
export class GbifService {
  private readonly logger = new Logger(GbifService.name);
  private readonly gbifBaseUrl = 'https://api.gbif.org/v1';

  constructor(private readonly http: ExternalHttpService) {}

  private speciesPath(key: string, suffix = ''): string {
    if (!GBIF_KEY_REGEX.test(String(key))) {
      throw new NotFoundException('Species not found');
    }
    return `${this.gbifBaseUrl}/species/${key}${suffix}`;
  }

  async searchSpecies(query: string, limit: number = 20, offset: number = 0) {
    const response = await this.http.get('gbif', `${this.gbifBaseUrl}/species/search`, {
      params: {
        q: query,
        limit,
        offset,
        rank: 'SPECIES',
        highertaxonRank: 'SPECIES',
      },
    });
    return response.data;
  }

  async getSpecies(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key));
    return response.data;
  }

  async getVernacularNames(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key, '/vernacularNames'));
    return response.data?.results || [];
  }

  async getIucn(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key, '/iucn'));
    return response.data;
  }

  async getDistributions(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key, '/distributions'));
    return response.data?.results || [];
  }

  async getMedia(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key, '/media'));
    return response.data?.results || [];
  }

  async getMetrics(key: string) {
    const response = await this.http.get('gbif', this.speciesPath(key, '/metrics'));
    return response.data;
  }

  async countOccurrences(key: string) {
    if (!GBIF_KEY_REGEX.test(String(key))) {
      throw new NotFoundException('Species not found');
    }
    const response = await this.http.get('gbif', `${this.gbifBaseUrl}/occurrence/search`, {
      params: { speciesKey: key, limit: 1 },
    });
    return {
      count: parseInt(response.data.count, 10),
      limit: response.data.limit,
      offset: response.data.offset,
    };
  }

  /** Sonde de santé : une seule tentative, sans retry. */
  async checkApiHealth() {
    const started = Date.now();
    try {
      await this.http.get('gbif', `${this.gbifBaseUrl}/occurrence/search`, {
        params: { limit: 1 },
        retry: false,
      });
      return {
        status: 'healthy',
        responseTime: `${Date.now() - started}ms`,
        circuit: this.http.circuitState('gbif'),
      };
    } catch (error) {
      this.logger.warn(`GBIF API health check failed: ${describeHttpError(error)}`);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'unknown error',
        circuit: this.http.circuitState('gbif'),
      };
    }
  }
}
