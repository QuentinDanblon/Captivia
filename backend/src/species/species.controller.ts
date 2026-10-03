import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { SpeciesService } from './species.service';
import { SpeciesFilter } from '../filters/species-filter.interface';
import { SearchSpeciesDto, GetSpeciesDto } from '../dto/species.dto';
import {
  isUpstreamNotFound,
  toUpstreamHttpException,
} from '../external/http/external-errors';

@UseGuards(RateLimitGuard)
@ApiTags('species')
@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for species by name with optional filters' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, default: 20 })
  @ApiQuery({ name: 'offset', required: false, default: 0 })
  @ApiQuery({ name: 'kingdom', required: false })
  @ApiQuery({ name: 'phylum', required: false })
  @ApiQuery({ name: 'class', required: false })
  @ApiQuery({ name: 'order', required: false })
  @ApiQuery({ name: 'family', required: false })
  @ApiQuery({ name: 'genus', required: false })
  @ApiQuery({ name: 'rank', required: false })
  @ApiQuery({ name: 'iucnStatus', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 200, description: 'Species found' })
  @ApiResponse({ status: 404, description: 'Invalid query' })
  async search(@Query() searchDto: SearchSpeciesDto) {
    // La recherche peut se faire par texte OU par filtre(s) seul(s) (ex. catégorie
    // depuis la page d'accueil). 400 uniquement si aucun critère n'est fourni.
    const hasQuery = !!searchDto.q?.trim();
    const hasFilters = !!(
      searchDto.kingdom ||
      searchDto.phylum ||
      searchDto.class ||
      searchDto.order ||
      searchDto.family ||
      searchDto.genus ||
      searchDto.rank ||
      searchDto.iucnStatus ||
      searchDto.country
    );
    if (!hasQuery && !hasFilters) {
      throw new BadRequestException('Query parameter is required');
    }

    const filters = {
      kingdom: searchDto.kingdom,
      phylum: searchDto.phylum,
      class: searchDto.class,
      order: searchDto.order,
      family: searchDto.family,
      genus: searchDto.genus,
      rank: searchDto.rank,
      iucnStatus: searchDto.iucnStatus,
      country: searchDto.country,
      limit: searchDto.limit,
      offset: searchDto.offset,
    };

    const results = await this.speciesService.searchSpecies(
      searchDto.q || '',
      searchDto.limit || 20,
      searchDto.offset || 0,
      Object.fromEntries(
        Object.entries(filters).filter(
          ([, v]) => v !== undefined && v !== null && v !== '',
        ),
      ) as SpeciesFilter,
    );
    return results;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get species details by ID' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Species details' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getSpecies(@Param() getSpeciesDto: GetSpeciesDto) {
    const id = getSpeciesDto.id;
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException('Species not found');
    }
    try {
      const response = await this.speciesService.getSpecies(id);
      return response;
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch species details');
    }
  }

  @Get(':id/vernacular')
  @ApiOperation({ summary: 'Get vernacular names for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Vernacular names' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getVernacularNames(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      const response = await this.speciesService.getVernacularNames(
        getSpeciesDto.id,
      );
      return response.results || [];
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch vernacular names');
    }
  }

  @Get(':id/iucn')
  @ApiOperation({ summary: 'Get IUCN status for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'IUCN status' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getIucn(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      return await this.speciesService.getIucn(getSpeciesDto.id);
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException(
          'IUCN status not available for this species',
        );
      }
      throw toUpstreamHttpException(error, 'Failed to fetch IUCN status');
    }
  }

  @Get(':id/reproduction')
  @ApiOperation({ summary: 'Get reproduction factsheet for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Reproduction factsheet' })
  @ApiResponse({
    status: 404,
    description: 'Reproduction data not available for this species',
  })
  async getReproduction(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      return await this.speciesService.getReproduction(getSpeciesDto.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          'Reproduction data not available for this species',
        );
      }
      throw new InternalServerErrorException(
        'Failed to fetch reproduction data',
      );
    }
  }

  @Get(':id/distributions')
  @ApiOperation({ summary: 'Get distribution data for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Distribution data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getDistributions(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      const response = await this.speciesService.getDistributions(
        getSpeciesDto.id,
      );
      return response;
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch distribution data');
    }
  }

  @Get(':id/media')
  @ApiOperation({ summary: 'Get media for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Media data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getMedia(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      const response = await this.speciesService.getMedia(getSpeciesDto.id);
      return response.results || [];
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch media data');
    }
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get metrics for a species' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Metrics data' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async getMetrics(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      return await this.speciesService.getMetrics(getSpeciesDto.id);
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch metrics');
    }
  }

  @Get(':id/occurrences/count')
  @ApiOperation({ summary: 'Get occurrence count by country' })
  @ApiParam({ name: 'id', description: 'Species ID' })
  @ApiResponse({ status: 200, description: 'Occurrence count' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  async countOccurrences(@Param() getSpeciesDto: GetSpeciesDto) {
    try {
      return await this.speciesService.countOccurrences(getSpeciesDto.id);
    } catch (error) {
      // Check if error is a 404 (not found) - either from axios or NotFoundException
      if (isUpstreamNotFound(error) || error instanceof NotFoundException) {
        throw new NotFoundException('Species not found');
      }
      throw toUpstreamHttpException(error, 'Failed to fetch occurrence count');
    }
  }
}
