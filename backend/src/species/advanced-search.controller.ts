/**
 * Contrôleur pour la recherche avancée d'espèces
 * Source: plans/resource-improvement-plan.md
 */

import { Throttle } from '@nestjs/throttler';
import { EXTERNAL_API_THROTTLE } from '../config/throttle.config';
import { Controller, Get, Query, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AdvancedSearchService } from './advanced-search.service';
import { AdvancedSearchDto } from '../dto/advanced-search.dto';
import { SpeciesFilterDto } from '../dto/advanced-search.dto';

@ApiTags('Species')
@Controller('species')
@Throttle(EXTERNAL_API_THROTTLE)
export class AdvancedSearchController {
  constructor(private readonly advancedSearchService: AdvancedSearchService) {}

  /**
   * Recherche avancée avec tous les filtres
   */
  @Get('search/advanced')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche avancée d\'espèces avec filtres' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async advancedSearch(@Query() params: any) {
    const dto: AdvancedSearchDto = {
      ...params,
      query: params.query ?? params.q,
      limit: params.limit ? Number(params.limit) : undefined,
      offset: params.offset ? Number(params.offset) : undefined,
      minOccurrences: params.minOccurrences ? Number(params.minOccurrences) : undefined,
    };
    return this.advancedSearchService.advancedSearch(dto);
  }

  /**
   * Recherche avec suggestions
   */
  @Get('search/suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suggestions de recherche' })
  @ApiQuery({ name: 'query', required: true, description: 'Recherche partielle' })
  @ApiQuery({ name: 'limit', required: false, default: 10, description: 'Nombre de suggestions' })
  @ApiQuery({ name: 'language', required: false, default: 'french', description: 'Langue' })
  @ApiResponse({ status: 200, description: 'Suggestions' })
  async searchSuggestions(
    @Query('query') query: string,
    @Query('limit') limit?: string,
    @Query('language') language?: string,
  ) {
    return this.advancedSearchService.searchSuggestions(
      query,
      limit ? parseInt(limit, 10) : 10,
      language || 'french',
    );
  }

  /**
   * Recherche par filtres contextuels
   */
  @Get('search/filters')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche par filtres contextuels' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchByFilters(@Query() dto: any) {
    return this.advancedSearchService.searchByFilters(dto);
  }

  /**
   * Recherche par statut de conservation
   */
  @Get('search/conservation/:status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche par statut de conservation' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchByConservation(
    @Param('status') status: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancedSearchService.searchByConservation(status, limit ? parseInt(limit, 10) : 20);
  }

  /**
   * Recherche par région
   */
  @Get('search/region/:region')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche par région' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchByRegion(
    @Param('region') region: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancedSearchService.searchByRegion(region, limit ? parseInt(limit, 10) : 20);
  }

  /**
   * Recherche par taxonomie
   */
  @Get('search/taxonomy/:taxonomic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche par taxonomie' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchByTaxonomy(
    @Param('taxonomic') taxonomic: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancedSearchService.searchByTaxonomy(taxonomic, limit ? parseInt(limit, 10) : 20);
  }

  /**
   * Recherche avec présence de médias
   */
  @Get('search/media/:hasMedia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche avec présence de médias' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchWithMedia(
    @Param('hasMedia') hasMedia: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancedSearchService.searchWithMedia(hasMedia === 'true', limit ? parseInt(limit, 10) : 20);
  }

  /**
   * Recherche avec présence d'IUCN
   */
  @Get('search/iucn/:hasIucn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche avec présence d\'IUCN' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async searchWithIucn(
    @Param('hasIucn') hasIucn: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancedSearchService.searchWithIucn(hasIucn === 'true', limit ? parseInt(limit, 10) : 20);
  }
}