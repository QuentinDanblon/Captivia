import { Injectable, Logger } from '@nestjs/common';
import { WikipediaService } from '../external/wikipedia/wikipedia.service';
import { WikidataService } from '../external/wikidata/wikidata.service';
import { GbifService } from '../external/gbif.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilterService } from '../filters/species-filter.service';
import { CacheService } from '../cache/cache.service';
import {
  WikipediaData,
  TransformedSpecies,
} from '../transformers/data-transformer.interface';
import type { GbifSpecies } from '../external/gbif.types';
import { mapWithConcurrency } from './concurrency.util';
import {
  GATEWAY_LIMIT_DEFAULT,
  GATEWAY_LIMIT_MAX,
  GATEWAY_LIMIT_MIN,
} from './dto/gateway-search.dto';

/** Champs Wikipedia repris à la fusion (la source peut être un résumé ou un résultat de recherche). */
export type WikipediaMergeInput = Partial<
  Omit<WikipediaData, 'source' | 'timestamp'>
>;
/** Champs Wikidata repris à la fusion (entité ou résultat de recherche : formes libres). */
export interface WikidataMergeInput {
  id?: string;
  labels?: unknown;
  descriptions?: unknown;
  aliases?: unknown;
  claims?: unknown;
  sitelinks?: unknown;
}

/** Données brutes collectées auprès des sources avant fusion. */
export interface SourceResults {
  gbif?: GbifSpecies | null;
  wikipedia?: WikipediaMergeInput | null;
  wikidata?: WikidataMergeInput | null;
}

/** Résultat fusionné d'une espèce (réponses `enriched` et `complete`). */
export interface MergedSpecies {
  key?: string;
  query?: string;
  sources: string[];
  timestamp: string;
  gbif?: TransformedSpecies;
  wikipedia?: WikipediaMergeInput | null;
  wikidata?: WikidataMergeInput | null;
}

/** Réponse de `searchSpecies` : résultats GBIF transformés + enrichissement. */
export interface GatewaySearchResult {
  results: Array<TransformedSpecies & { enriched: MergedSpecies | null }>;
  total: number;
}

/** Nombre maximal de résultats de recherche enrichis via Wikipedia/Wikidata. */
export const MAX_ENRICHED_RESULTS = 5;
/** Appels d'enrichissement simultanés au maximum. */
export const ENRICH_CONCURRENCY = 3;

/**
 * API Gateway Service - Coordinates requests across multiple data sources
 * Implements fallback strategies and data enrichment
 */
@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);

  constructor(
    private wikipediaService: WikipediaService,
    private wikidataService: WikidataService,
    private gbifService: GbifService,
    private transformerService: SpeciesTransformerService,
    private filterService: SpeciesFilterService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get enriched species data with fallback sources
   * @param query Search query or species ID
   * @param sources Array of preferred sources (gbif, wikipedia, wikidata)
   * @returns Enriched species data
   */
  async getEnrichedSpecies(
    query: string,
    sources: ('gbif' | 'wikipedia' | 'wikidata')[] = [
      'gbif',
      'wikipedia',
      'wikidata',
    ],
  ) {
    const cacheKey = `enriched:${query}:${sources.join(',')}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for enriched species: ${query}`);
      return cached as MergedSpecies;
    }

    const results: SourceResults = {
      gbif: null,
      wikipedia: null,
      wikidata: null,
    };

    // Fetch from primary source (GBIF)
    if (sources.includes('gbif')) {
      try {
        results.gbif = await this.fetchGbifData(query);
      } catch (error) {
        this.logger.warn(
          `GBIF fetch failed for ${query}:`,
          (error as Error).message,
        );
      }
    }

    // Fetch from Wikipedia for additional info
    if (sources.includes('wikipedia')) {
      try {
        results.wikipedia = await this.fetchWikipediaData(query);
      } catch (error) {
        this.logger.warn(
          `Wikipedia fetch failed for ${query}:`,
          (error as Error).message,
        );
      }
    }

    // Fetch from Wikidata for structured data
    if (sources.includes('wikidata')) {
      try {
        results.wikidata = await this.fetchWikidataData(query);
      } catch (error) {
        this.logger.warn(
          `Wikidata fetch failed for ${query}:`,
          (error as Error).message,
        );
      }
    }

    const enriched = this.mergeEnrichedData(query, results);

    // Cache enriched data for 24 hours
    this.cacheService.set(cacheKey, enriched, 86400);

    return enriched;
  }

  /**
   * Get species details with all available sources
   * @param speciesKey GBIF species key
   * @returns Complete species information
   */
  async getCompleteSpecies(speciesKey: string) {
    const cacheKey = `complete:${speciesKey}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached as MergedSpecies;
    }

    const [gbifData, wikipediaData, wikidataData] = await Promise.allSettled([
      this.gbifService.getSpecies(speciesKey),
      this.fetchWikipediaDataById(speciesKey),
      this.fetchWikidataDataById(speciesKey),
    ]);

    const results: SourceResults = {
      gbif: gbifData.status === 'fulfilled' ? gbifData.value : null,
      wikipedia:
        wikipediaData.status === 'fulfilled' ? wikipediaData.value : null,
      wikidata: wikidataData.status === 'fulfilled' ? wikidataData.value : null,
    };

    const complete = this.mergeCompleteSpecies(speciesKey, results);

    this.cacheService.set(cacheKey, complete, 86400);

    return complete;
  }

  /**
   * Search species with fallback sources.
   * Protection contre l'amplification : `limit` borné à 1..20 (transmis à GBIF) et
   * enrichissement Wikipedia/Wikidata limité aux MAX_ENRICHED_RESULTS premiers résultats,
   * avec au plus ENRICH_CONCURRENCY appels simultanés. Les autres résultats sont renvoyés
   * sans enrichissement (`enriched: null`).
   * @param query Search query
   * @param limit Result limit (1..20, défaut 10)
   * @param sources Preferred sources
   * @returns Search results with enriched data
   */
  async searchSpecies(
    query: string,
    limit: number = GATEWAY_LIMIT_DEFAULT,
    sources: ('gbif' | 'wikipedia' | 'wikidata')[] = ['gbif'],
  ) {
    const safeLimit = this.clampLimit(limit);
    const cacheKey = `search:${query}:${safeLimit}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached as GatewaySearchResult;
    }

    let gbifResults: GbifSpecies[] = [];

    if (sources.includes('gbif')) {
      try {
        const response = await this.gbifService.searchSpecies(
          query,
          safeLimit,
          0,
        );
        gbifResults = (response?.results ?? []).slice(0, safeLimit);
      } catch (error) {
        this.logger.warn(`GBIF search failed: ${(error as Error)?.message}`);
      }
    }

    const toEnrich = gbifResults.slice(0, MAX_ENRICHED_RESULTS);
    const enrichments = await mapWithConcurrency(
      toEnrich,
      ENRICH_CONCURRENCY,
      async (gbifSpecies) => {
        const name = gbifSpecies.canonicalName || gbifSpecies.name;
        try {
          return await this.getEnrichedSpecies(name, ['wikipedia', 'wikidata']);
        } catch (error) {
          this.logger.warn(
            `Enrichment failed for ${name}: ${(error as Error)?.message}`,
          );
          return null;
        }
      },
    );

    const enrichedResults = gbifResults.map((gbifSpecies, index) => ({
      ...this.transformerService.transformSpecies(gbifSpecies),
      enriched: index < enrichments.length ? enrichments[index] : null,
    }));

    this.cacheService.set(
      cacheKey,
      { results: enrichedResults, total: enrichedResults.length },
      86400,
    );

    return { results: enrichedResults, total: enrichedResults.length };
  }

  /** Ramène `limit` dans [GATEWAY_LIMIT_MIN, GATEWAY_LIMIT_MAX] (défaut si non numérique). */
  private clampLimit(limit: number): number {
    const value = Math.trunc(Number(limit));
    if (!Number.isFinite(value)) return GATEWAY_LIMIT_DEFAULT;
    return Math.min(GATEWAY_LIMIT_MAX, Math.max(GATEWAY_LIMIT_MIN, value));
  }

  /**
   * Get conservation status from multiple sources
   * @param speciesKey Species key
   * @returns Combined conservation data
   */
  async getConservationStatus(speciesKey: string) {
    const cacheKey = `conservation:${speciesKey}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [iucnData, wikidataData] = await Promise.allSettled([
      this.gbifService.getIucn(speciesKey),
      this.wikidataService.getConservationStatus(speciesKey),
    ]);

    const result = {
      gbif: iucnData.status === 'fulfilled' ? iucnData.value : null,
      wikidata: wikidataData.status === 'fulfilled' ? wikidataData.value : null,
    };

    this.cacheService.set(cacheKey, result, 86400);

    return result;
  }

  /**
   * Get species classification from multiple sources
   * @param speciesKey Species key
   * @returns Combined classification data
   */
  async getClassification(speciesKey: string) {
    const cacheKey = `classification:${speciesKey}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [gbifData, wikidataData] = await Promise.allSettled([
      this.gbifService.getSpecies(speciesKey),
      this.wikidataService.getClassification(speciesKey),
    ]);

    const result = {
      gbif: gbifData.status === 'fulfilled' ? gbifData.value : null,
      wikidata: wikidataData.status === 'fulfilled' ? wikidataData.value : null,
    };

    this.cacheService.set(cacheKey, result, 86400);

    return result;
  }

  /**
   * Get species distributions from multiple sources
   * @param speciesKey Species key
   * @returns Combined distribution data
   */
  async getDistributions(speciesKey: string) {
    const cacheKey = `distributions:${speciesKey}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [gbifData, wikidataData] = await Promise.allSettled([
      this.gbifService.getDistributions(speciesKey),
      this.wikidataService.getImages(speciesKey),
    ]);

    const result = {
      gbif: gbifData.status === 'fulfilled' ? gbifData.value : null,
      wikidata: wikidataData.status === 'fulfilled' ? wikidataData.value : null,
    };

    this.cacheService.set(cacheKey, result, 86400);

    return result;
  }

  /**
   * Get species media/images from multiple sources
   * @param speciesKey Species key
   * @returns Combined media data
   */
  async getMedia(speciesKey: string) {
    const cacheKey = `media:${speciesKey}`;
    const cached = this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [gbifData, wikidataData] = await Promise.allSettled([
      this.gbifService.getMedia(speciesKey),
      this.wikidataService.getImages(speciesKey),
    ]);

    const result = {
      gbif: gbifData.status === 'fulfilled' ? gbifData.value : null,
      wikidata: wikidataData.status === 'fulfilled' ? wikidataData.value : null,
    };

    this.cacheService.set(cacheKey, result, 86400);

    return result;
  }

  /**
   * Fetch GBIF data
   */
  private async fetchGbifData(query: string) {
    const response = await this.gbifService.searchSpecies(query, 1, 0);
    return response.results?.[0];
  }

  /**
   * Fetch Wikipedia data by name
   */
  private async fetchWikipediaData(query: string) {
    const data = await this.wikipediaService.searchSpecies(query);
    return data;
  }

  /**
   * Fetch Wikipedia data by species key
   */
  private async fetchWikipediaDataById(speciesKey: string) {
    // Try to find Wikipedia page by scientific name
    const speciesData = await this.gbifService.getSpecies(speciesKey);
    const scientificName =
      speciesData?.scientificName || speciesData?.canonicalName;

    if (scientificName) {
      return await this.wikipediaService.getArticle(scientificName);
    }
    return null;
  }

  /**
   * Fetch Wikidata data by name
   */
  private async fetchWikidataData(query: string) {
    const data = await this.wikidataService.searchSpecies(query);
    return data.results?.[0];
  }

  /**
   * Fetch Wikidata data by species key
   */
  private async fetchWikidataDataById(speciesKey: string) {
    const speciesData = await this.gbifService.getSpecies(speciesKey);

    // Try to find Wikidata QID by scientific name
    const scientificName =
      speciesData?.scientificName || speciesData?.canonicalName;

    if (scientificName) {
      const wikidataSpecies =
        await this.wikidataService.getSpeciesByScientificName(scientificName);
      return wikidataSpecies;
    }
    return null;
  }

  /**
   * Merge enriched data from multiple sources
   */
  private mergeEnrichedData(
    query: string,
    results: SourceResults,
  ): MergedSpecies {
    const enriched: MergedSpecies = {
      query,
      sources: [],
      timestamp: new Date().toISOString(),
    };

    // Add GBIF data if available
    if (results.gbif) {
      enriched.sources.push('gbif');
      enriched.gbif = this.transformerService.transformSpecies(results.gbif);
    }

    // Add Wikipedia data if available
    if (results.wikipedia) {
      enriched.sources.push('wikipedia');
      enriched.wikipedia = this.transformWikipediaData(results.wikipedia);
    }

    // Add Wikidata data if available
    if (results.wikidata) {
      enriched.sources.push('wikidata');
      enriched.wikidata = this.transformWikidataData(results.wikidata);
    }

    return enriched;
  }

  /**
   * Merge complete species data
   */
  private mergeCompleteSpecies(
    speciesKey: string,
    results: SourceResults,
  ): MergedSpecies {
    const complete: MergedSpecies = {
      key: speciesKey,
      sources: [],
      timestamp: new Date().toISOString(),
    };

    if (results.gbif) {
      complete.sources.push('gbif');
      complete.gbif = this.transformerService.transformSpecies(results.gbif);
    }

    if (results.wikipedia) {
      complete.sources.push('wikipedia');
      complete.wikipedia = this.transformWikipediaData(results.wikipedia);
    }

    if (results.wikidata) {
      complete.sources.push('wikidata');
      complete.wikidata = this.transformWikidataData(results.wikidata);
    }

    return complete;
  }

  /**
   * Transform Wikipedia data for merging
   */
  private transformWikipediaData(data: WikipediaMergeInput | null | undefined) {
    if (!data) return null;
    return {
      title: data.title,
      pageid: data.pageid,
      url: data.url,
      thumbnail: data.thumbnail,
      extract: data.extract,
      extractHtml: data.extractHtml,
      originalimage: data.originalimage,
      terms: data.terms,
    };
  }

  /**
   * Transform Wikidata data for merging
   */
  private transformWikidataData(data: WikidataMergeInput | null | undefined) {
    if (!data) return null;
    return {
      id: data.id,
      labels: data.labels,
      descriptions: data.descriptions,
      aliases: data.aliases,
      claims: data.claims,
      sitelinks: data.sitelinks,
    };
  }

  /**
   * Get Wikipedia article by title
   */
  async getWikipediaArticle(title: string) {
    return this.wikipediaService.getArticle(title);
  }

  /**
   * Get Wikidata entity by QID
   */
  async getWikidataEntity(qid: string) {
    return this.wikidataService.getEntity(qid);
  }

  /**
   * Check GBIF health
   */
  async checkGbifHealth() {
    return this.gbifService.checkApiHealth();
  }

  /**
   * Check Wikipedia health
   */
  async checkWikipediaHealth() {
    return this.wikipediaService.checkApiHealth();
  }

  /**
   * Check Wikidata health
   */
  async checkWikidataHealth() {
    return this.wikidataService.checkApiHealth();
  }

  /**
   * Check service health
   */
  async checkServiceHealth(service: 'gbif' | 'wikipedia' | 'wikidata') {
    switch (service) {
      case 'gbif':
        return this.checkGbifHealth();
      case 'wikipedia':
        return this.checkWikipediaHealth();
      case 'wikidata':
        return this.checkWikidataHealth();
      default:
        return { status: 'unknown', error: 'Unknown service' };
    }
  }

  /**
   * Clear cache for a species
   */
  clearSpeciesCache(speciesKey: string): void {
    const keys = [
      `enriched:${speciesKey}`,
      `complete:${speciesKey}`,
      `conservation:${speciesKey}`,
      `classification:${speciesKey}`,
      `distributions:${speciesKey}`,
      `media:${speciesKey}`,
    ];

    for (const key of keys) {
      this.cacheService.clearKey(key);
    }
  }
}
