/**
 * Service d'intégration des APIs open-source gratuites
 * APIs sans clé API requise
 * Source: plans/resource-improvement-plan.md
 */

import { Injectable, Logger } from '@nestjs/common';
import { describeHttpError } from './http-safety';
import { ExternalHttpService } from './http/external-http.service';

export interface OpenDataResult {
  source: string;
  data: any;
  timestamp: number;
}

export interface WikipediaData {
  title: string;
  extract: string;
  url: string;
  thumbnail?: { source: string; width: number; height: number };
}

export interface WikidataData {
  label: string;
  description: string;
  claims: Record<string, any[]>;
}

export interface INaturalistObservation {
  id: number;
  species_guess: string;
  taxon_id: number;
  latitude: number;
  longitude: number;
  date_observed: string;
  quality_grade: string;
  user: string;
}

export interface EOLData {
  id: number;
  title: string;
  description: string;
  urls: string[];
  images: any[];
}

export interface WikipediaResult extends OpenDataResult {
  data: WikipediaData | null;
}

export interface WikidataResult extends OpenDataResult {
  data: WikidataData | null;
}

export interface INaturalistResult extends OpenDataResult {
  data: INaturalistObservation[];
}

export interface EOLResult extends OpenDataResult {
  data: EOLData[];
}

export interface MultiSourceResult extends OpenDataResult {
  data: {
    wikipedia: WikipediaResult | null;
    wikidata: WikidataResult | null;
    iNaturalist: INaturalistResult | null;
    eol: EOLResult | null;
  };
}

@Injectable()
export class OpenDataService {
  private readonly logger = new Logger(OpenDataService.name);

  // APIs sans clé API (appels via le client HTTP partagé : timeout 5 s, disjoncteur par fournisseur)
  private readonly wikipediaUrl = 'https://fr.wikipedia.org/api/rest_v1';
  private readonly wikidataUrl = 'https://www.wikidata.org/w/api.php';
  private readonly iNaturalistUrl = 'https://api.inaturalist.org/v2';
  private readonly eolUrl = 'https://eol.org/api';

  constructor(private readonly http: ExternalHttpService) {}

  private iNaturalistObservations(params: Record<string, unknown>) {
    return this.http.get('inaturalist', `${this.iNaturalistUrl}/observations`, {
      params: {
        per_page: 20,
        order: 'desc',
        order_by: 'created_at',
        ...params,
      },
    });
  }

  private eolPages(params: Record<string, unknown>) {
    return this.http.get('eol', `${this.eolUrl}/pages`, {
      params: { per_page: 20, sort: 'relevance', ...params },
    });
  }

  /**
   * Recherche sur Wikipedia
   */
  async searchWikipedia(title: string): Promise<WikipediaResult> {
    this.logger.log(`Searching Wikipedia for: ${title}`);

    try {
      const response = await this.http.get(
        'wikipedia',
        `${this.wikipediaUrl}/page/summary/${encodeURIComponent(title)}`,
      );

      const data = response.data;
      return {
        source: 'wikipedia',
        data: {
          title: data.title,
          extract: data.extract,
          url:
            data.content_urls?.desktop?.page || data.content_urls?.mobile?.page,
          thumbnail: data.thumbnail,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `Wikipedia search failed for: ${title}: ${describeHttpError(error)}`,
      );
      return {
        source: 'wikipedia',
        data: null,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Recherche sur Wikidata
   */
  async searchWikidata(title: string): Promise<WikidataResult> {
    this.logger.log(`Searching Wikidata for: ${title}`);

    try {
      // D'abord chercher l'entité par titre
      const searchResponse = await this.http.get('wikidata', this.wikidataUrl, {
        params: {
          action: 'wbsearchentities',
          search: title,
          language: 'fr',
          format: 'json',
          limit: 1,
        },
      });

      const results = searchResponse.data.search;
      if (!results || results.length === 0) {
        throw new Error('No results found');
      }

      const entityId = results[0].id;

      // Récupérer les données de l'entité
      const dataResponse = await this.http.get('wikidata', this.wikidataUrl, {
        params: {
          action: 'wbgetentities',
          format: 'json',
          language: 'fr',
          ids: entityId,
          props: 'labels|descriptions|claims',
          languages: 'fr',
        },
      });

      const entities = dataResponse.data.entities;
      const entity = entities[entityId];

      if (!entity) {
        throw new Error('Entity not found');
      }

      return {
        source: 'wikidata',
        data: {
          label:
            entity.labels?.fr?.value ||
            entity.labels?.en?.value ||
            entity.labels?.fr?.value,
          description:
            entity.descriptions?.fr?.value || entity.descriptions?.en?.value,
          claims: entity.claims,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `Wikidata search failed for: ${title}: ${describeHttpError(error)}`,
      );
      return {
        source: 'wikidata',
        data: null,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Recherche sur iNaturalist
   */
  async searchINaturalist(query: string): Promise<INaturalistResult> {
    this.logger.log(`Searching iNaturalist for: ${query}`);

    try {
      const response = await this.iNaturalistObservations({
        q: query,
        taxon_name: query,
      });

      const results = response.data.results;

      return {
        source: 'inaturalist',
        data: results,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `iNaturalist search failed for: ${query}: ${describeHttpError(error)}`,
      );
      return {
        source: 'inaturalist',
        data: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Recherche sur EOL (Encyclopedia of Life)
   */
  async searchEOL(query: string): Promise<EOLResult> {
    this.logger.log(`Searching EOL for: ${query}`);

    try {
      const response = await this.eolPages({
        q: query,
        type: 'taxon',
      });

      const results = response.data.results;

      return {
        source: 'eol',
        data: results,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `EOL search failed for: ${query}: ${describeHttpError(error)}`,
      );
      return {
        source: 'eol',
        data: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Recherche combinée sur plusieurs APIs
   */
  async multiSourceSearch(query: string): Promise<MultiSourceResult> {
    this.logger.log(`Multi-source search for: ${query}`);

    const [wikipedia, wikidata, iNaturalist, eol] = await Promise.allSettled([
      this.searchWikipedia(query),
      this.searchWikidata(query),
      this.searchINaturalist(query),
      this.searchEOL(query),
    ]);

    const results = {
      wikipedia: wikipedia.status === 'fulfilled' ? wikipedia.value : null,
      wikidata: wikidata.status === 'fulfilled' ? wikidata.value : null,
      iNaturalist:
        iNaturalist.status === 'fulfilled' ? iNaturalist.value : null,
      eol: eol.status === 'fulfilled' ? eol.value : null,
    };

    return {
      source: 'multi',
      data: results,
      timestamp: Date.now(),
    };
  }

  /**
   * Recherche par taxon ID sur iNaturalist
   */
  async searchINaturalistByTaxon(taxonId: number, limit: number = 20) {
    this.logger.log(`Searching iNaturalist by taxon: ${taxonId}`);

    try {
      const response = await this.iNaturalistObservations({
        taxon_id: taxonId,
        per_page: limit,
      });

      return {
        source: 'inaturalist',
        data: response.data.results,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `iNaturalist search by taxon failed: ${taxonId}: ${describeHttpError(error)}`,
      );
      return {
        source: 'inaturalist',
        data: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Recherche par taxon ID sur EOL
   */
  async searchEOLByTaxon(taxonId: number, limit: number = 20) {
    this.logger.log(`Searching EOL by taxon: ${taxonId}`);

    try {
      const response = await this.eolPages({
        id: taxonId,
        per_page: limit,
      });

      return {
        source: 'eol',
        data: response.data.results,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(
        `EOL search by taxon failed: ${taxonId}: ${describeHttpError(error)}`,
      );
      return {
        source: 'eol',
        data: [],
        timestamp: Date.now(),
      };
    }
  }
}
