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
import { LegislationService } from './legislation.service';
import { CreateLegislationDto } from './dto/legislation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@ApiTags('legislation')
@Controller('species/:speciesId/legislation')
export class LegislationController {
  constructor(private readonly legislationService: LegislationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get legislation information for a species',
    description:
      'Returns legislation status including CITES, EU Wildlife Trade Regulation, and country-specific rules',
  })
  @ApiParam({ name: 'speciesId', description: 'GBIF species key', type: Number })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO country code (FR, US, GB, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Legislation information retrieved' })
  async getSpeciesLegislation(
    @Param('speciesId', ParseIntPipe) speciesId: number,
    @Query('country') country?: string,
  ) {
    return this.legislationService.getSpeciesLegislation(speciesId, country);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OperatorGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or update legislation content (admin only)',
    description: 'Add or update editorial legislation content for a species',
  })
  @ApiParam({ name: 'speciesId', description: 'GBIF species key', type: Number })
  @ApiResponse({ status: 201, description: 'Legislation content created/updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOrUpdateLegislation(
    @Param('speciesId', ParseIntPipe) speciesId: number,
    @Body() body: CreateLegislationDto,
  ) {
    return this.legislationService.createOrUpdateLegislation(
      speciesId,
      body.country,
      body.status,
      body.details ?? {},
      body.sources ?? [],
    );
  }
}

@ApiTags('speciesplus')
@Controller('speciesplus')
@Throttle(EXTERNAL_API_THROTTLE)
export class SpeciesPlusController {
  constructor(private readonly legislationService: LegislationService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search Species+ database',
    description: 'Search for species in Species+ (CITES/EU database)',
  })
  @ApiQuery({ name: 'name', description: 'Scientific name' })
  @ApiResponse({ status: 200, description: 'Species+ search results' })
  async searchSpeciesPlus(@Query('name') name: string) {
    return this.legislationService.searchSpeciesPlus(name);
  }

  @Get('taxon/:taxonId/cites')
  @ApiOperation({
    summary: 'Get CITES legislation for a taxon',
    description: 'Returns CITES appendix listings for a Species+ taxon',
  })
  @ApiParam({ name: 'taxonId', description: 'Species+ taxon ID' })
  @ApiResponse({ status: 200, description: 'CITES legislation' })
  async getCitesLegislation(@Param('taxonId', ParseIntPipe) taxonId: number) {
    return this.legislationService.getCitesLegislation(taxonId);
  }

  @Get('taxon/:taxonId/eu')
  @ApiOperation({
    summary: 'Get EU legislation for a taxon',
    description: 'Returns EU Wildlife Trade Regulation annexes for a Species+ taxon',
  })
  @ApiParam({ name: 'taxonId', description: 'Species+ taxon ID' })
  @ApiResponse({ status: 200, description: 'EU legislation' })
  async getEULegislation(@Param('taxonId', ParseIntPipe) taxonId: number) {
    return this.legislationService.getEULegislation(taxonId);
  }
}
