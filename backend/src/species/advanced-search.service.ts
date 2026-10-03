/**
 * Service de recherche avancée avec filtres contextuels
 * Source: plans/resource-improvement-plan.md
 */

import { Injectable, Logger } from '@nestjs/common';
import { SpeciesService, SpeciesSearchItem } from './species.service';
import { SpeciesTransformerService } from '../transformers/species-transformer.service';
import { SpeciesFilterService } from '../filters/species-filter.service';
import { DataValidatorService, SpeciesData } from '../external/data-validator';
import { SpeciesFilter } from '../filters/species-filter.interface';
import { AdvancedSearchDto } from '../dto/advanced-search.dto';
import { SpeciesFilterDto } from '../dto/advanced-search.dto';

@Injectable()
export class AdvancedSearchService {
  private readonly logger = new Logger(AdvancedSearchService.name);

  constructor(
    private speciesService: SpeciesService,
    private transformerService: SpeciesTransformerService,
    private filterService: SpeciesFilterService,
    private validatorService: DataValidatorService,
  ) {}

  /**
   * Recherche avancée avec tous les filtres
   */
  async advancedSearch(dto: AdvancedSearchDto) {
    this.logger.log(`Advanced search with query: ${dto.query}`);

    // Validation des filtres
    const filters = this.buildFiltersFromDto(dto);

    // Recherche avec filtres
    const results = await this.speciesService.searchSpecies(
      dto.query,
      dto.limit || 50,
      dto.offset || 0,
      filters,
    );

    // Calcul du score de qualité moyen
    const avgQualityScore = this.calculateAverageQuality(results.results);

    return {
      results: results.results,
      total: results.total,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
      source: results.source,
      avgQualityScore,
    };
  }

  /**
   * Recherche avec suggestions
   */
  async searchSuggestions(
    query: string,
    limit: number = 10,
    language: string = 'french',
  ) {
    this.logger.log(`Search suggestions for: ${query}`);

    // Recherche GBIF
    const gbifResults = await this.speciesService.searchSpecies(
      query,
      limit * 5,
      0,
    );

    // Extraire les noms vernaculaires en français
    const suggestions = gbifResults.results
      .map((species) => {
        const vernacularNames: unknown[] = species.vernacularNames ?? [];
        const vernacular = vernacularNames.find(
          (vn): vn is { language?: string; name?: string } =>
            typeof vn === 'object' &&
            vn !== null &&
            (vn as { language?: string }).language === language,
        );
        return vernacular?.name || species.canonicalName;
      })
      .filter((name): name is string => !!name && name.trim().length > 0);

    // Supprimer les doublons et limiter
    const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, limit);

    return {
      suggestions: uniqueSuggestions,
      count: uniqueSuggestions.length,
    };
  }

  /**
   * Recherche par filtres contextuels
   */
  async searchByFilters(dto: SpeciesFilterDto) {
    this.logger.log(`Search by filters: ${JSON.stringify(dto)}`);

    const filters = this.buildContextualFilters(dto);

    const results = await this.speciesService.searchSpecies(
      dto.query || '',
      20,
      0,
      filters,
    );

    return {
      results: results.results,
      total: results.total,
      filtersApplied: Object.keys(filters).filter(
        (k) => filters[k as keyof SpeciesFilter] !== undefined,
      ),
      source: results.source,
    };
  }

  /**
   * Recherche par conservation
   */
  async searchByConservation(status: string, limit: number = 20) {
    this.logger.log(`Search by conservation status: ${status}`);

    const filters: SpeciesFilter = {
      iucnStatus: status,
      limit,
    };

    const results = await this.speciesService.searchSpecies(
      '',
      limit,
      0,
      filters,
    );

    return {
      results: results.results,
      total: results.total,
      status,
      source: results.source,
    };
  }

  /**
   * Recherche par région
   */
  async searchByRegion(region: string, limit: number = 20) {
    this.logger.log(`Search by region: ${region}`);

    // Codes ISO pour les régions
    const regionCodes: Record<string, string[]> = {
      france: ['FR', 'FRA'],
      belgium: ['BE', 'BEL'],
      switzerland: ['CH', 'CHE'],
      europe: ['EU'],
    };

    const countryCodes = regionCodes[region.toLowerCase()] || [];

    const filters: SpeciesFilter = {
      country: countryCodes.join(','),
      limit,
    };

    const results = await this.speciesService.searchSpecies(
      '',
      limit,
      0,
      filters,
    );

    return {
      results: results.results,
      total: results.total,
      region,
      source: results.source,
    };
  }

  /**
   * Recherche par taxonomie
   */
  async searchByTaxonomy(taxonomic: string, limit: number = 20) {
    this.logger.log(`Search by taxonomy: ${taxonomic}`);

    // Mapping des taxonomies
    const taxonomyMap: Record<string, SpeciesFilter> = {
      reptiles: { rank: 'SPECIES', phylum: 'Chordata', class: 'Reptilia' },
      amphibians: { rank: 'SPECIES', phylum: 'Chordata', class: 'Amphibia' },
      birds: { rank: 'SPECIES', phylum: 'Chordata', class: 'Aves' },
      mammals: { rank: 'SPECIES', phylum: 'Chordata', class: 'Mammalia' },
      fish: { rank: 'SPECIES', phylum: 'Chordata', class: 'Actinopterygii' },
      plants: { kingdom: 'Plantae' },
      fungi: { kingdom: 'Fungi' },
    };

    const filters = taxonomyMap[taxonomic.toLowerCase()] || {};

    const results = await this.speciesService.searchSpecies(
      '',
      limit,
      0,
      filters,
    );

    return {
      results: results.results,
      total: results.total,
      taxonomic,
      source: results.source,
    };
  }

  /**
   * Recherche avec présence de médias
   */
  async searchWithMedia(hasMedia: boolean, limit: number = 20) {
    this.logger.log(`Search with media: ${hasMedia}`);

    const filters: SpeciesFilter = {
      limit,
    };

    const results = await this.speciesService.searchSpecies(
      '',
      limit,
      0,
      filters,
    );

    // Filtrer les espèces avec médias
    const filteredResults = results.results.filter((species) => {
      return hasMedia
        ? species.media && species.media.length > 0
        : !species.media || species.media.length === 0;
    });

    return {
      results: filteredResults,
      total: filteredResults.length,
      hasMedia,
      source: results.source,
    };
  }

  /**
   * Recherche avec présence d'IUCN
   */
  async searchWithIucn(hasIucn: boolean, limit: number = 20) {
    this.logger.log(`Search with IUCN: ${hasIucn}`);

    const filters: SpeciesFilter = {
      limit,
    };

    const results = await this.speciesService.searchSpecies(
      '',
      limit,
      0,
      filters,
    );

    // Filtrer les espèces avec IUCN
    const filteredResults = results.results.filter((species) => {
      return hasIucn
        ? species.iucnStatus && species.iucnStatus !== 'UNKNOWN'
        : !species.iucnStatus || species.iucnStatus === 'UNKNOWN';
    });

    return {
      results: filteredResults,
      total: filteredResults.length,
      hasIucn,
      source: results.source,
    };
  }

  /**
   * Construit les filtres à partir du DTO
   */
  private buildFiltersFromDto(dto: AdvancedSearchDto): SpeciesFilter {
    const filters: SpeciesFilter = {
      query: dto.query,
      rank: dto.rank,
      kingdom: dto.kingdom,
      phylum: dto.phylum,
      class: dto.class,
      order: dto.order,
      family: dto.family,
      genus: dto.genus,
      iucnStatus: dto.iucnStatus,
      country: dto.country,
      language: dto.language,
      limit: dto.limit,
      offset: dto.offset,
    };

    // Filtrer les valeurs undefined
    return Object.fromEntries(
      Object.entries(filters).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      ),
    ) as SpeciesFilter;
  }

  /**
   * Construit les filtres contextuels
   */
  private buildContextualFilters(dto: SpeciesFilterDto): SpeciesFilter {
    const filters: SpeciesFilter = {};

    if (dto.query) filters.query = dto.query;
    if (dto.rank) filters.rank = dto.rank;
    if (dto.kingdom) filters.kingdom = dto.kingdom;
    if (dto.phylum) filters.phylum = dto.phylum;
    if (dto.class) filters.class = dto.class;
    if (dto.order) filters.order = dto.order;
    if (dto.family) filters.family = dto.family;
    if (dto.genus) filters.genus = dto.genus;
    if (dto.iucnStatus) filters.iucnStatus = dto.iucnStatus;
    if (dto.country) filters.country = dto.country;
    if (dto.language) filters.language = dto.language;

    // Filtrer les valeurs undefined
    return Object.fromEntries(
      Object.entries(filters).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      ),
    ) as SpeciesFilter;
  }

  /**
   * Calcule le score de qualité moyen
   */
  private calculateAverageQuality(speciesArray: SpeciesSearchItem[]): number {
    if (!speciesArray || speciesArray.length === 0) return 0;

    let totalScore = 0;
    let validCount = 0;

    for (const species of speciesArray) {
      const stats = this.validatorService.getValidationStats(
        species as Partial<SpeciesData>,
      );
      totalScore += stats.qualityScore;
      validCount++;
    }

    return validCount > 0 ? Math.round(totalScore / validCount) : 0;
  }
}
