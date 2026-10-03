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
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiGatewayService } from './api-gateway.service';
import { Throttle } from '@nestjs/throttler';
import { EXTERNAL_API_THROTTLE } from '../config/throttle.config';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isValidQid } from '../external/http-safety';
import { GatewayEnrichedDto, GatewaySearchDto } from './dto/gateway-search.dto';
import {
  WikipediaData,
  WikidataData,
} from '../transformers/data-transformer.interface';

const VALID_SOURCES = ['gbif', 'wikipedia', 'wikidata'];

/**
 * API Gateway Controller - Multi-source species data endpoints
 */
@ApiTags('gateway')
@Controller('gateway')
@UseGuards(RateLimitGuard)
// Toutes les routes appellent des API externes : limite stricte 20 req/min/IP (ThrottlerGuard global).
@Throttle(EXTERNAL_API_THROTTLE)
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
  @ApiQuery({
    name: 'query',
    required: true,
    description: 'Search query or species key (2 à 100 caractères)',
  })
  @ApiQuery({
    name: 'sources',
    required: false,
    description: 'Comma-separated sources (gbif,wikipedia,wikidata)',
    example: 'gbif,wikipedia,wikidata',
  })
  @ApiResponse({ status: 200, description: 'Enriched species data' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getEnrichedSpecies(@Query() dto: GatewayEnrichedDto) {
    const sourceArray = this.parseSources(
      dto.sources,
      'gbif,wikipedia,wikidata',
    );
    return this.apiGatewayService.getEnrichedSpecies(dto.query, sourceArray);
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
  @ApiQuery({
    name: 'query',
    required: true,
    description: 'Search query (2 à 100 caractères)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Result limit (1 à 20)',
    example: 10,
  })
  @ApiQuery({
    name: 'sources',
    required: false,
    description: 'Comma-separated sources',
    example: 'gbif',
  })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Invalid query or limit' })
  async searchSpecies(@Query() dto: GatewaySearchDto) {
    const sourceArray = this.parseSources(dto.sources, 'gbif');
    return this.apiGatewayService.searchSpecies(
      dto.query,
      dto.limit,
      sourceArray,
    );
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
    const result =
      await this.apiGatewayService.getConservationStatus(speciesKey);
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
  @ApiQuery({
    name: 'title',
    required: true,
    description: 'Wikipedia article title',
  })
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
    if (!isValidQid(qid)) {
      throw new BadRequestException(
        'qid must match Q followed by digits (e.g. Q140)',
      );
    }
    return this.apiGatewayService.getWikidataEntity(qid);
  }

  /**
   * Clear cache for a species
   * @param speciesKey Species key
   * @returns Success message
   */
  @Post('clear-cache/:speciesKey')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear cache for a species (opérateurs uniquement)',
  })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Réservé aux opérateurs' })
  async clearCache(@Param('speciesKey') speciesKey: string) {
    this.validateSpeciesKey(speciesKey);
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
    const [gbif, wikipedia, wikidata] = await Promise.all([
      this.apiGatewayService.checkGbifHealth(),
      this.apiGatewayService.checkWikipediaHealth(),
      this.apiGatewayService.checkWikidataHealth(),
    ]);
    const services = { gbif, wikipedia, wikidata };
    const allHealthy = Object.values(services).every(
      (service) => service?.status === 'healthy',
    );
    return {
      // « degraded » dès qu'un fournisseur ne répond pas : l'API reste utilisable
      // (repli sur les profils locaux / le cache), mais l'état n'est plus « healthy ».
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
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
  async checkServiceHealth(
    @Param('service') service: 'gbif' | 'wikipedia' | 'wikidata',
  ) {
    return this.apiGatewayService.checkServiceHealth(service);
  }

  /**
   * Parse et valide la liste de sources (séparées par des virgules)
   */
  private parseSources(
    raw: string | undefined,
    fallback: string,
  ): ('gbif' | 'wikipedia' | 'wikidata')[] {
    const sourceArray = (raw || fallback).split(',');
    for (const source of sourceArray) {
      if (!VALID_SOURCES.includes(source)) {
        throw new BadRequestException(`Invalid source: ${source}`);
      }
    }
    return sourceArray as ('gbif' | 'wikipedia' | 'wikidata')[];
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
