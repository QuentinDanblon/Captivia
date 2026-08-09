import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiGatewayService } from './api-gateway.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WikipediaData, WikidataData } from '../transformers/data-transformer.interface';

const VALID_SOURCES = ['gbif', 'wikipedia', 'wikidata'];

/**
 * API Gateway Controller - Multi-source species data endpoints
 */
@ApiTags('gateway')
@Controller('gateway')
@UseGuards(RateLimitGuard)
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  /**
   * Get enriched species data from multiple sources
   * @param query Search query or species key
   * @param sources Preferred sources (comma-separated)
   * @returns Enriched species data
   */
  @Get('enriched')
  @ApiOperation({ summary: 'Get enriched species data from multiple sources' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query or species key' })
  @ApiQuery({ name: 'sources', required: false, description: 'Comma-separated sources (gbif,wikipedia,wikidata)', example: 'gbif,wikipedia,wikidata' })
  @ApiResponse({ status: 200, description: 'Enriched species data' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getEnrichedSpecies(
    @Query('query') query: string,
    @Query('sources') sources: string = 'gbif,wikipedia,wikidata',
  ) {
    if (!query || !query.trim()) {
      throw new BadRequestException('Query parameter is required');
    }
    const sourceArray = sources.split(',');
    for (const source of sourceArray) {
      if (!VALID_SOURCES.includes(source)) {
        throw new BadRequestException(`Invalid source: ${source}`);
      }
    }
    return this.apiGatewayService.getEnrichedSpecies(query, sourceArray as ('gbif' | 'wikipedia' | 'wikidata')[]);
  }

  /**
   * Get complete species information with all available sources
   * @param speciesKey GBIF species key
   * @returns Complete species information
   */
  @Get('complete/:speciesKey')
  @ApiOperation({ summary: 'Get complete species information' })
  @ApiResponse({ status: 200, description: 'Complete species information' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getCompleteSpecies(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
    const result = await this.apiGatewayService.getCompleteSpecies(speciesKey);
    if (!result || result.sources.length === 0) {
      throw new NotFoundException('Species not found');
    }
    return result;
  }

  /**
   * Search species with multi-source enrichment
   * @param query Search query
   * @param limit Result limit
   * @param sources Preferred sources
   * @returns Search results with enriched data
   */
  @Get('search')
  @ApiOperation({ summary: 'Search species with multi-source enrichment' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit', example: 20 })
  @ApiQuery({ name: 'sources', required: false, description: 'Comma-separated sources', example: 'gbif' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchSpecies(
    @Query('query') query: string,
    @Query('limit') limit: string = '20',
    @Query('sources') sources: string = 'gbif',
  ) {
    const sourceArray = sources.split(',');
    for (const source of sourceArray) {
      if (!VALID_SOURCES.includes(source)) {
        throw new BadRequestException(`Invalid source: ${source}`);
      }
    }
    return this.apiGatewayService.searchSpecies(query, parseInt(limit), sourceArray as ('gbif' | 'wikipedia' | 'wikidata')[]);
  }

  /**
   * Get conservation status from multiple sources
   * @param speciesKey Species key
   * @returns Conservation status data
   */
  @Get('conservation/:speciesKey')
  @ApiOperation({ summary: 'Get conservation status from multiple sources' })
  @ApiResponse({ status: 200, description: 'Conservation status data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getConservationStatus(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
    const result = await this.apiGatewayService.getConservationStatus(speciesKey);
    if (!result || Object.values(result).every((value) => value === null)) {
      throw new NotFoundException('Species not found');
    }
    return result;
  }

  /**
   * Get species classification from multiple sources
   * @param speciesKey Species key
   * @returns Classification data
   */
  @Get('classification/:speciesKey')
  @ApiOperation({ summary: 'Get species classification from multiple sources' })
  @ApiResponse({ status: 200, description: 'Classification data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getClassification(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
    const result = await this.apiGatewayService.getClassification(speciesKey);
    if (!result || Object.values(result).every((value) => value === null)) {
      throw new NotFoundException('Species not found');
    }
    return result;
  }

  /**
   * Get species distributions from multiple sources
   * @param speciesKey Species key
   * @returns Distribution data
   */
  @Get('distributions/:speciesKey')
  @ApiOperation({ summary: 'Get species distributions from multiple sources' })
  @ApiResponse({ status: 200, description: 'Distribution data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getDistributions(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
    const result = await this.apiGatewayService.getDistributions(speciesKey);
    if (!result || Object.values(result).every((value) => value === null)) {
      throw new NotFoundException('Species not found');
    }
    return result;
  }

  /**
   * Get species media/images from multiple sources
   * @param speciesKey Species key
   * @returns Media data
   */
  @Get('media/:speciesKey')
  @ApiOperation({ summary: 'Get species media/images from multiple sources' })
  @ApiResponse({ status: 200, description: 'Media data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getMedia(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
    const result = await this.apiGatewayService.getMedia(speciesKey);
    if (!result || Object.values(result).every((value) => value === null)) {
      throw new NotFoundException('Species not found');
    }
    return result;
  }

  /**
   * Get Wikipedia data by article title
   * @param title Wikipedia article title
   * @returns Wikipedia article data
   */
  @Get('wikipedia/article')
  @ApiOperation({ summary: 'Get Wikipedia article by title' })
  @ApiQuery({ name: 'title', required: true, description: 'Wikipedia article title' })
  @ApiResponse({ status: 200, description: 'Wikipedia article data' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getWikipediaArticle(@Query('title') title: string) {
    return this.apiGatewayService.getWikipediaArticle(title);
  }

  /**
   * Get Wikidata entity by QID
   * @param qid Wikidata QID
   * @returns Wikidata entity data
   */
  @Get('wikidata/entity/:qid')
  @ApiOperation({ summary: 'Get Wikidata entity by QID' })
  @ApiResponse({ status: 200, description: 'Wikidata entity data' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async getWikidataEntity(@Param('qid') qid: string) {
    return this.apiGatewayService.getWikidataEntity(qid);
  }

  /**
   * Clear cache for a species
   * @param speciesKey Species key
   * @returns Success message
   */
  @Post('clear-cache/:speciesKey')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear cache for a species' })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCache(@Param('speciesKey') speciesKey: string) {
    await this.apiGatewayService.clearSpeciesCache(speciesKey);
    return { message: 'Cache cleared successfully' };
  }

  /**
   * Get API health status
   * @returns Health status
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get API gateway health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        gbif: await this.apiGatewayService.checkGbifHealth(),
        wikipedia: await this.apiGatewayService.checkWikipediaHealth(),
        wikidata: await this.apiGatewayService.checkWikidataHealth(),
      },
    };
  }

  /**
   * Check individual service health
   * @param service Service name (gbif, wikipedia, wikidata)
   * @returns Health status
   */
  @Get('health/:service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check individual service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async checkServiceHealth(@Param('service') service: 'gbif' | 'wikipedia' | 'wikidata') {
    return this.apiGatewayService.checkServiceHealth(service);
  }

  /**
   * Validate that a species key is numeric
   * @param speciesKey Species key to validate
   */
  private validateSpeciesKey(speciesKey: string): void {
    if (!/^\d+$/.test(speciesKey)) {
      throw new BadRequestException('speciesKey must be numeric');
    }
  }
}