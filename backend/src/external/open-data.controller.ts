/**
 * Contrôleur pour l'intégration des APIs open-source
 * APIs sans clé API requise
 * Source: plans/resource-improvement-plan.md
 */

import { Throttle } from '@nestjs/throttler';
import { EXTERNAL_API_THROTTLE } from '../config/throttle.config';
import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { OpenDataService } from './open-data.service';
import {
  ExternalQueryDto,
  ExternalTaxonQueryDto,
  ExternalTitleDto,
} from './dto/external-query.dto';

@ApiTags('Open Data')
@Controller('api/open-data')
@Throttle(EXTERNAL_API_THROTTLE)
export class OpenDataController {
  constructor(private readonly openDataService: OpenDataService) {}

  /**
   * Recherche sur Wikipedia
   */
  @Get('wikipedia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche sur Wikipedia' })
  @ApiQuery({ name: 'title', required: true, description: 'Titre de l\'article' })
  @ApiResponse({ status: 200, description: 'Données Wikipedia' })
  async searchWikipedia(@Query() query: ExternalTitleDto) {
    return this.openDataService.searchWikipedia(query.title);
  }

  /**
   * Recherche sur Wikidata
   */
  @Get('wikidata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche sur Wikidata' })
  @ApiQuery({ name: 'title', required: true, description: 'Titre de l\'entité' })
  @ApiResponse({ status: 200, description: 'Données Wikidata' })
  async searchWikidata(@Query() query: ExternalTitleDto) {
    return this.openDataService.searchWikidata(query.title);
  }

  /**
   * Recherche sur iNaturalist
   */
  @Get('inaturalist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche sur iNaturalist' })
  @ApiQuery({ name: 'query', required: true, description: 'Recherche' })
  @ApiResponse({ status: 200, description: 'Observations iNaturalist' })
  async searchINaturalist(@Query() dto: ExternalQueryDto) {
    return this.openDataService.searchINaturalist(dto.query);
  }

  /**
   * Recherche sur EOL
   */
  @Get('eol')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche sur EOL' })
  @ApiQuery({ name: 'query', required: true, description: 'Recherche' })
  @ApiResponse({ status: 200, description: 'Données EOL' })
  async searchEOL(@Query() dto: ExternalQueryDto) {
    return this.openDataService.searchEOL(dto.query);
  }

  /**
   * Recherche combinée sur plusieurs APIs
   */
  @Get('multi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche combinée sur plusieurs APIs' })
  @ApiQuery({ name: 'query', required: true, description: 'Recherche' })
  @ApiResponse({ status: 200, description: 'Résultats de toutes les APIs' })
  async multiSourceSearch(@Query() dto: ExternalQueryDto) {
    return this.openDataService.multiSourceSearch(dto.query);
  }

  /**
   * Recherche iNaturalist par taxon ID
   */
  @Get('inaturalist/taxon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche iNaturalist par taxon ID' })
  @ApiQuery({ name: 'taxonId', required: true, description: 'ID du taxon' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Observations iNaturalist' })
  async searchINaturalistByTaxon(@Query() query: ExternalTaxonQueryDto) {
    return this.openDataService.searchINaturalistByTaxon(query.taxonId, query.limit ?? 20);
  }

  /**
   * Recherche EOL par taxon ID
   */
  @Get('eol/taxon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche EOL par taxon ID' })
  @ApiQuery({ name: 'taxonId', required: true, description: 'ID du taxon' })
  @ApiQuery({ name: 'limit', required: false, default: 20, description: 'Nombre de résultats' })
  @ApiResponse({ status: 200, description: 'Données EOL' })
  async searchEOLByTaxon(@Query() query: ExternalTaxonQueryDto) {
    return this.openDataService.searchEOLByTaxon(query.taxonId, query.limit ?? 20);
  }
}