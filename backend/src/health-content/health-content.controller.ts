import { Throttle } from '@nestjs/throttler';
import { EXTERNAL_API_THROTTLE } from '../config/throttle.config';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HealthContentService } from './health-content.service';
import { HealthQueryDto, PubMedSearchDto } from './dto/health-query.dto';
import { CreateHealthContentDto } from './dto/health-content.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('health')
@Controller('species/:speciesId/health')
export class HealthContentController {
  constructor(private readonly healthContentService: HealthContentService) {}

  @Get()
  @ApiOperation({
    summary: 'Get health information for a species',
    description:
      'Returns health information including diseases, symptoms, prevention, and PubMed references',
  })
  @ApiParam({ name: 'speciesId', description: 'GBIF species key', type: Number })
  @ApiQuery({ name: 'disease', required: false, description: 'Filter by specific disease' })
  @ApiQuery({ name: 'locale', required: false, description: 'Language code (fr, en, etc.)' })
  @ApiResponse({ status: 200, description: 'Health information retrieved' })
  async getSpeciesHealth(
    @Param('speciesId', ParseIntPipe) speciesId: number,
    @Query() query: HealthQueryDto,
  ) {
    return this.healthContentService.getSpeciesHealth(
      speciesId,
      query.disease,
      query.locale || 'fr',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or update health content (admin only)',
    description: 'Add or update editorial health content for a species',
  })
  @ApiParam({ name: 'speciesId', description: 'GBIF species key', type: Number })
  @ApiResponse({ status: 201, description: 'Health content created/updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOrUpdateHealthContent(
    @Param('speciesId', ParseIntPipe) speciesId: number,
    @Body() body: CreateHealthContentDto,
  ) {
    return this.healthContentService.createOrUpdateHealthContent(
      speciesId,
      body.locale,
      body.diseases,
      body.sources ?? [],
    );
  }
}

@ApiTags('pubmed')
@Controller('pubmed')
@Throttle(EXTERNAL_API_THROTTLE)
export class PubMedController {
  constructor(private readonly healthContentService: HealthContentService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search PubMed articles',
    description: 'Search for veterinary and animal health articles in PubMed',
  })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'PubMed search results' })
  @ApiResponse({ status: 503, description: 'PubMed temporarily unavailable' })
  async searchPubMed(@Query() query: PubMedSearchDto): Promise<unknown[]> {
    return this.healthContentService.searchPubMed(query.q, query.limit || 10);
  }
}
