import {
  HttpException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { GbifService } from '../external/gbif.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilterService } from '../filters/species-filter.service';
import { SpeciesProfileService } from './species-profile.service';
import { SpeciesFilter } from '../filters/species-filter.interface';
import { Media } from '../transformers/data-transformer.interface';
import type {
  GbifDistribution,
  GbifIucn,
  GbifMetrics,
  GbifOccurrenceCount,
  GbifSpecies,
} from '../external/gbif.types';
import type {
  SpeciesBehavior,
  SpeciesFeeding,
  SpeciesHabitat,
  SpeciesProfile,
  SpeciesReproduction,
} from '@prisma/client';
import {
  isUpstreamError,
  isUpstreamNotFound,
  toUpstreamHttpException,
  upstreamUnavailable,
} from '../external/http/external-errors';

/**
 * Résultat de recherche : fiche locale (`ProfileSearchItem`) ou espèce GBIF
 * transformée (`TransformedSpecies`). Seuls les champs communs ou lus par les
 * appelants sont décrits.
 */
export interface SpeciesSearchItem {
  key?: number;
  name?: string;
  canonicalName?: string;
  scientificName?: string;
  vernacularNames?: unknown[];
  media?: unknown[];
  iucnStatus?: string;
  metrics?: { usage?: number };
  occurrenceCount?: number;
}

export interface SpeciesSearchResponse {
  results: SpeciesSearchItem[];
  total: number;
  source?: string;
  cachedAt?: Date;
  /** GBIF indisponible : résultat local (éventuellement vide), non mis en cache. */
  degraded?: boolean;
  /** Réponse servie depuis le cache périmé. */
  stale?: boolean;
}

/** Fiche espèce détaillée (profil local et/ou taxonomie GBIF). */
export interface SpeciesDetail {
  key: number;
  name: string | undefined;
  canonicalName: string | undefined;
  scientificName: string;
  rank: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  status: string;
  vernacularNames: string[];
  iucnStatus: string | undefined;
  distributions: never[];
  media: never[];
  metrics: Record<string, never>;
  occurrenceCount: number;
  source: 'profile' | 'gbif';
  /** W5-04 — date de la dernière vérification éditoriale (ISO 8601) ; null = jamais vérifiée. */
  lastReviewedAt: Date | null;
  profile: SpeciesProfile | null;
  feeding: SpeciesFeeding | null | undefined;
  habitat: SpeciesHabitat | null | undefined;
  behavior: SpeciesBehavior | null | undefined;
  /** Fiche renvoyée sans taxonomie (GBIF indisponible), non mise en cache. */
  degraded?: boolean;
  /** Fiche servie depuis le cache périmé. */
  stale?: boolean;
}

interface VernacularResult {
  results: string[];
}

interface MediaResult {
  results: Media[];
}

@Injectable()
export class SpeciesService {
  private readonly logger = new Logger(SpeciesService.name);

  constructor(
    private cacheService: CacheService,
    private gbifService: GbifService,
    private transformerService: SpeciesTransformerService,
    private filterService: SpeciesFilterService,
    private speciesProfileService: SpeciesProfileService,
  ) {}

  async searchSpecies(
    query: string,
    limit: number = 20,
    offset: number = 0,
    filters?: SpeciesFilter,
  ): Promise<SpeciesSearchResponse> {
    this.logger.log(
      `Searching for species: ${query}, filters=${JSON.stringify(filters)}`,
    );

    const profileFilters: { category?: string; domesticationType?: string } =
      {};
    if (filters?.class) {
      profileFilters.category = this.mapGbifClassToCategory(filters.class);
    }
    if (filters?.domesticationType) {
      profileFilters.domesticationType = filters.domesticationType;
    }

    let result: SpeciesSearchResponse =
      await this.speciesProfileService.searchFromProfile(
        query,
        limit,
        offset,
        profileFilters,
      );

    // Fallback to GBIF when no profile results (recherche vide ou base profils limitée)
    if ((result.results?.length ?? 0) === 0) {
      const searchQuery = (query?.trim() || 'animal').slice(0, 100);
      const gbifLimit = Math.min(limit * 3, 60);
      const cacheKey = `search:gbif:${searchQuery.toLowerCase()}:${limit}:${offset}:${filters?.class ?? ''}`;
      const cached = this.cacheService.get(cacheKey) as
        | SpeciesSearchResponse
        | undefined;
      if (cached) {
        return cached;
      }
      this.logger.log(
        `Profile empty, falling back to GBIF with query="${searchQuery}"`,
      );
      try {
        const gbifResponse = await this.gbifService.searchSpecies(
          searchQuery,
          gbifLimit,
          offset,
        );
        let gbifResults = gbifResponse.results || [];
        if (filters?.class) {
          gbifResults = gbifResults.filter(
            (item) =>
              item.class &&
              String(item.class).toLowerCase() === filters.class!.toLowerCase(),
          );
          if (gbifResults.length === 0) {
            gbifResults = (gbifResponse.results || []).slice(0, limit);
          }
        }
        const sliced = gbifResults.slice(0, limit);
        result = this.transformerService.transformSearchResults(sliced);
        result.total = gbifResults.length;
        result.source = 'gbif';
        // Réponse GBIF valide (même vide : « aucune espèce ») : mise en cache 1 h.
        this.cacheService.set(cacheKey, result, 3600);
      } catch (err) {
        // Panne GBIF : jamais de 500 sur une recherche. Repli sur la dernière réponse
        // connue (même périmée), sinon sur le résultat local (vide) — NON mis en cache.
        this.logger.warn(`GBIF fallback failed: ${(err as Error).message}`);
        const stale = this.cacheService.getStale(cacheKey) as
          | SpeciesSearchResponse
          | undefined;
        if (stale) {
          return { ...stale, stale: true };
        }
        result = { ...result, degraded: true };
      }
    }

    return result;
  }

  private getCategorySearchQuery(gbifClass: string): string {
    const queryByClass: Record<string, string> = {
      Aves: 'bird',
      Mammalia: 'mammal',
      Reptilia: 'reptile',
      Amphibia: 'amphibian',
      Actinopterygii: 'fish',
      Insecta: 'insect',
      Arachnida: 'spider',
    };
    return queryByClass[gbifClass] || gbifClass.toLowerCase();
  }

  async getSpecies(id: string): Promise<SpeciesDetail> {
    this.logger.log(`Getting species details: ${id}`);

    // Try to get from cache first
    const cacheKey = `species:${id}`;
    const cachedSpecies = this.cacheService.get(cacheKey);

    if (cachedSpecies) {
      this.logger.log(`Cache hit for species: ${id}`);
      return cachedSpecies as SpeciesDetail;
    }

    // Parse species ID as number
    const speciesId = parseInt(id, 10);
    if (isNaN(speciesId)) {
      throw new NotFoundException('Species not found');
    }

    // Get from profile database
    const profileDetail = await this.speciesProfileService.getBySpeciesId(
      speciesId,
      'fr',
    );

    // Fetch classification from GBIF (speciesId is the GBIF key)
    let kingdom = '';
    let phylum = '';
    let taxClass = '';
    let order = '';
    let family = '';
    let genus = '';
    let rank: string = 'SPECIES';
    let iucnStatus: string | undefined;
    let gbifSpecies: GbifSpecies | null = null;
    // Panne GBIF (réseau, 5xx, disjoncteur ouvert) : distincte d'un 404 (espèce inconnue
    // de GBIF, normal pour les races au speciesId artificiel).
    let gbifUnavailable = false;
    try {
      gbifSpecies = await this.gbifService.getSpecies(id);
      if (gbifSpecies) {
        kingdom = gbifSpecies.kingdom ?? '';
        phylum = gbifSpecies.phylum ?? '';
        taxClass = gbifSpecies.class ?? '';
        order = gbifSpecies.order ?? '';
        family = gbifSpecies.family ?? '';
        genus = gbifSpecies.genus ?? '';
        if (gbifSpecies.rank) rank = gbifSpecies.rank;
        if (gbifSpecies.iucnRedListCategory)
          iucnStatus = gbifSpecies.iucnRedListCategory;
      }
    } catch (err) {
      this.logger.warn(
        `GBIF taxonomy for species ${id} failed: ${(err as Error).message}`,
      );
      gbifUnavailable = isUpstreamError(err) && !isUpstreamNotFound(err);
    }

    if (gbifUnavailable) {
      // Dernière fiche complète connue (même périmée) : meilleure qu'une fiche sans taxonomie.
      const stale = this.cacheService.getStale(cacheKey);
      if (stale) {
        return { ...(stale as SpeciesDetail), stale: true };
      }
    }

    // If no local profile AND no GBIF data, species truly does not exist
    if (!profileDetail.profile && !gbifSpecies) {
      if (gbifUnavailable) {
        // On ne peut pas affirmer que l'espèce n'existe pas : 503, pas 404.
        throw upstreamUnavailable('Species data temporarily unavailable');
      }
      throw new NotFoundException('Species not found');
    }

    let response: SpeciesDetail;

    if (profileDetail.profile) {
      // Build response with local profile data + GBIF classification
      response = {
        key: profileDetail.profile.speciesId,
        name:
          profileDetail.profile.commonNameFr ||
          profileDetail.profile.scientificName,
        canonicalName:
          profileDetail.profile.commonNameFr ||
          profileDetail.profile.scientificName,
        scientificName: profileDetail.profile.scientificName,
        rank,
        kingdom,
        phylum,
        class: taxClass,
        order,
        family,
        genus,
        status: 'UNKNOWN',
        vernacularNames: [profileDetail.profile.commonNameFr],
        iucnStatus,
        distributions: [],
        media: [],
        metrics: {},
        occurrenceCount: 0,
        source: 'profile',
        // W5-04 — date de la dernière vérification éditoriale (ISO 8601) ; null = jamais vérifiée.
        lastReviewedAt: profileDetail.profile.lastReviewedAt ?? null,
        profile: profileDetail.profile,
        feeding: profileDetail.feeding,
        habitat: profileDetail.habitat,
        behavior: profileDetail.behavior,
      };
    } else {
      // Fallback: build response from GBIF data only (no local editorial content).
      // Ici `gbifSpecies` est forcément défini (garde « ni profil ni GBIF » plus haut).
      const gbif = gbifSpecies as GbifSpecies;
      const vernacularName =
        gbif.vernacularName || gbif.canonicalName || gbif.scientificName;
      response = {
        key: gbif.key ?? speciesId,
        name: vernacularName,
        canonicalName: gbif.canonicalName || gbif.scientificName,
        scientificName: gbif.scientificName || '',
        rank,
        kingdom,
        phylum,
        class: taxClass,
        order,
        family,
        genus,
        status: gbif.taxonomicStatus || 'UNKNOWN',
        vernacularNames: vernacularName ? [vernacularName] : [],
        iucnStatus,
        distributions: [],
        media: [],
        metrics: {},
        occurrenceCount: 0,
        source: 'gbif',
        lastReviewedAt: null,
        profile: null,
        feeding: null,
        habitat: null,
        behavior: null,
      };
    }

    if (gbifUnavailable) {
      // Fiche locale sans taxonomie : renvoyée, mais JAMAIS mise en cache (sinon la panne
      // GBIF serait figée 24 h dans la réponse).
      return { ...response, degraded: true };
    }

    // Cache the results with species-specific TTL (24h)
    this.cacheService.set(cacheKey, response, 86400);

    return response;
  }

  private mapGbifClassToCategory(gbifClass: string): string {
    const classMapping: Record<string, string> = {
      Mammalia: 'mammifère',
      Aves: 'oiseau',
      Reptilia: 'reptile',
      Amphibia: 'amphibien',
      Actinopterygii: 'poisson',
      Insecta: 'insecte',
      Arachnida: 'arachnide',
    };
    return classMapping[gbifClass] || gbifClass.toLowerCase();
  }

  async getVernacularNames(
    id: string,
  ): Promise<{ results: string[]; source: string }> {
    this.logger.log(`Getting vernacular names for species: ${id}`);

    // Try to get from cache first
    const cacheKey = `vernacular:${id}`;
    const cachedNames = this.cacheService.get(cacheKey);

    if (cachedNames) {
      this.logger.log(`Cache hit for vernacular names: ${id}`);
      return {
        results: (cachedNames as VernacularResult).results,
        source: 'cache',
      };
    }

    // If not in cache, fetch from GBIF
    try {
      const gbifNames = await this.gbifService.getVernacularNames(id);

      // Transform the vernacular names using the transformer service
      const transformedNames =
        this.transformerService.transformVernacularNames(gbifNames);

      // Cache the results with vernacular-specific TTL (12h)
      this.cacheService.set(cacheKey, transformedNames, 43200);

      return {
        results: transformedNames.results,
        source: 'gbif',
      };
    } catch (error) {
      return this.onGbifFailure(
        error,
        'Species not found',
        `vernacular:${id}`,
        (stale) => ({
          results: (stale as VernacularResult).results,
          source: 'stale-cache',
        }),
      );
    }
  }

  async getIucn(id: string): Promise<GbifIucn> {
    this.logger.log(`Getting IUCN status for species: ${id}`);
    const cacheKey = `iucn:${id}`;
    const cachedIucn = this.cacheService.get(cacheKey);
    if (cachedIucn) {
      return cachedIucn as GbifIucn;
    }
    try {
      const gbifIucn = await this.gbifService.getIucn(id);
      // Mise en cache 24 h d'une réponse valide uniquement (jamais d'un échec).
      if (gbifIucn) this.cacheService.set(cacheKey, gbifIucn, 86400);
      return gbifIucn;
    } catch (error) {
      return this.onGbifFailure(
        error,
        'IUCN status not available for this species',
        `iucn:${id}`,
        (stale) => stale as GbifIucn,
      );
    }
  }

  /**
   * Fiche reproduction d'une espèce (Module B). Retourne 404 propre si aucune
   * ligne SpeciesReproduction n'existe pour ce speciesId (le contenu éditorial
   * est rempli par le Module E).
   */
  async getReproduction(id: string): Promise<SpeciesReproduction> {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new NotFoundException(
        'Reproduction data not available for this species',
      );
    }
    const speciesId = Number(id);
    const record = await this.speciesProfileService.getReproduction(speciesId);
    if (!record) {
      throw new NotFoundException(
        'Reproduction data not available for this species',
      );
    }
    return record;
  }

  async getDistributions(id: string): Promise<GbifDistribution[]> {
    this.logger.log(`Getting distributions for species: ${id}`);

    // Try to get from cache first
    const cacheKey = `distributions:${id}`;
    const cachedDistributions = this.cacheService.get(cacheKey);

    if (cachedDistributions) {
      this.logger.log(`Cache hit for distributions: ${id}`);
      return cachedDistributions as GbifDistribution[];
    }

    // If not in cache, fetch from GBIF
    try {
      const gbifDistributions = await this.gbifService.getDistributions(id);

      // Cache the results with distributions-specific TTL (24h)
      this.cacheService.set(cacheKey, gbifDistributions, 86400);

      return gbifDistributions;
    } catch (error) {
      return this.onGbifFailure(
        error,
        'Species not found',
        `distributions:${id}`,
        (stale) => stale as GbifDistribution[],
      );
    }
  }

  async getMedia(id: string): Promise<{ results: Media[]; source: string }> {
    this.logger.log(`Getting media for species: ${id}`);

    // Try to get from cache first
    const cacheKey = `media:${id}`;
    const cachedMedia = this.cacheService.get(cacheKey);

    if (cachedMedia) {
      this.logger.log(`Cache hit for media: ${id}`);
      const results = Array.isArray(cachedMedia)
        ? (cachedMedia as Media[])
        : (cachedMedia as MediaResult).results;
      return {
        results: results ?? [],
        source: 'cache',
      };
    }

    // If not in cache, fetch from GBIF
    try {
      const gbifMedia = await this.gbifService.getMedia(id);

      // Transform the media using the transformer service
      const transformedMedia =
        this.transformerService.transformMedia(gbifMedia);

      // Cache the results with media-specific TTL (1h)
      this.cacheService.set(cacheKey, { results: transformedMedia }, 3600);

      return {
        results: transformedMedia,
        source: 'gbif',
      };
    } catch (error) {
      return this.onGbifFailure(
        error,
        'Species not found',
        `media:${id}`,
        (stale) => ({
          results: Array.isArray(stale)
            ? (stale as Media[])
            : ((stale as MediaResult).results ?? []),
          source: 'stale-cache',
        }),
      );
    }
  }

  async getMetrics(id: string): Promise<GbifMetrics> {
    this.logger.log(`Getting metrics for species: ${id}`);

    // Try to get from cache first
    const cacheKey = `metrics:${id}`;
    const cachedMetrics = this.cacheService.get(cacheKey);

    if (cachedMetrics) {
      this.logger.log(`Cache hit for metrics: ${id}`);
      return cachedMetrics as GbifMetrics;
    }

    // If not in cache, fetch from GBIF
    try {
      const gbifMetrics = await this.gbifService.getMetrics(id);

      // Cache the results with metrics-specific TTL (7d)
      this.cacheService.set(cacheKey, gbifMetrics, 604800);

      return gbifMetrics;
    } catch (error) {
      return this.onGbifFailure(
        error,
        'Species not found',
        `metrics:${id}`,
        (stale) => stale as GbifMetrics,
      );
    }
  }

  async countOccurrences(id: string): Promise<GbifOccurrenceCount> {
    this.logger.log(`Counting occurrences for species: ${id}`);

    // Try to get from cache first
    const cacheKey = `occurrences:${id}`;
    const cachedCount = this.cacheService.get(cacheKey);

    if (cachedCount) {
      this.logger.log(`Cache hit for occurrences: ${id}`);
      return cachedCount as GbifOccurrenceCount;
    }

    // If not in cache, fetch from GBIF
    try {
      const gbifCount = await this.gbifService.countOccurrences(id);

      // Cache the results with occurrences-specific TTL (7d)
      this.cacheService.set(cacheKey, gbifCount, 604800);

      return gbifCount;
    } catch (error) {
      return this.onGbifFailure(
        error,
        'Species not found',
        `occurrences:${id}`,
        (stale) => stale as GbifOccurrenceCount,
      );
    }
  }

  /**
   * Traite l'échec d'un appel GBIF pour un sous-endpoint (noms, IUCN, médias…) :
   * 404 → NotFound ; panne (réseau, 5xx, disjoncteur ouvert) → dernière valeur connue
   * même périmée, sinon 503 explicite. Jamais de 500 pour une indisponibilité GBIF.
   */
  private onGbifFailure<T>(
    error: unknown,
    notFoundMessage: string,
    staleKey: string,
    fromStale: (stale: unknown) => T,
  ): T {
    if (error instanceof HttpException) {
      throw error;
    }
    if (isUpstreamNotFound(error)) {
      throw new NotFoundException(notFoundMessage);
    }
    const stale = this.cacheService.getStale(staleKey);
    if (stale) {
      this.logger.warn(
        `GBIF indisponible, réponse périmée servie pour ${staleKey}`,
      );
      return fromStale(stale);
    }
    throw toUpstreamHttpException(
      error,
      'Species data temporarily unavailable',
    );
  }

  clearCacheForSpecies(id: string): void {
    const keys = [
      `species:${id}`,
      `media:${id}`,
      `vernacular:${id}`,
      `iucn:${id}`,
      `distributions:${id}`,
      `metrics:${id}`,
      `occurrences:${id}`,
    ];

    keys.forEach((key) => this.cacheService.clearKey(key));
    this.logger.log(`Cache cleared for species: ${id}`);
  }

  /**
   * Apply advanced filters to species search results
   * @param query Search query string
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @param filters Filter criteria object
   * @returns Filtered and transformed search results
   */
  async searchSpeciesWithFilters(
    query: string,
    limit: number = 20,
    offset: number = 0,
    filters?: SpeciesFilter,
  ) {
    return this.searchSpecies(query, limit, offset, filters);
  }
}
