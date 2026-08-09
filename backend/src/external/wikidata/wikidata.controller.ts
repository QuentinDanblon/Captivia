import {
  Controller,
  Get,
  Query,
  NotFoundException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { WikidataService } from './wikidata.service';
import { GetWikidataDto, ConservationStatusDto } from '../../dto/species.dto';

@UseGuards(RateLimitGuard)
@ApiTags('wikidata')
@Controller('wikidata')
export class WikidataController {
  constructor(private readonly wikidataService: WikidataService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search Wikidata for a species' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async search(@Query('q') q: string) {
    try {
      return await this.wikidataService.searchSpecies(q);
    } catch (error) {
      throw new InternalServerErrorException('Failed to search Wikidata');
    }
  }

  @Get('entity')
  @ApiOperation({ summary: 'Get Wikidata entity by QID' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Entity data' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getEntity(@Query('qid') qid: string) {
    try {
      return await this.wikidataService.getEntity(qid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch Wikidata entity');
    }
  }

  @Get('species')
  @ApiOperation({ summary: 'Get species info by scientific name' })
  @ApiQuery({ name: 'scientificName', description: 'Scientific name' })
  @ApiResponse({ status: 200, description: 'Species data' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getSpecies(@Query('scientificName') scientificName: string) {
    try {
      return await this.wikidataService.getSpeciesByScientificName(
        scientificName,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch species data');
    }
  }

  @Get('conservation')
  @ApiOperation({ summary: 'Get conservation status for a species' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Conservation status' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getConservationStatus(@Query() conservationDto: ConservationStatusDto) {
    try {
      return await this.wikidataService.getConservationStatus(
        conservationDto.qid,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch conservation status',
      );
    }
  }

  @Get('classification')
  @ApiOperation({ summary: 'Get classification data for a species' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Classification data' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getClassification(@Query('qid') qid: string) {
    try {
      return await this.wikidataService.getClassification(qid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch classification');
    }
  }

  @Get('descriptions')
  @ApiOperation({ summary: 'Get descriptions for a species' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Description data' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getDescriptions(@Query('qid') qid: string) {
    try {
      return await this.wikidataService.getDescriptions(qid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch descriptions');
    }
  }

  @Get('images')
  @ApiOperation({ summary: 'Get images for a species' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Image data' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getImages(@Query('qid') qid: string) {
    try {
      return await this.wikidataService.getImages(qid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch images');
    }
  }

  @Get('related')
  @ApiOperation({ summary: 'Get related species for a species' })
  @ApiQuery({ name: 'qid', description: 'Wikidata QID' })
  @ApiResponse({ status: 200, description: 'Related species' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getRelatedSpecies(@Query('qid') qid: string) {
    try {
      return await this.wikidataService.getRelatedSpecies(qid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch related species');
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check Wikidata API health' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async checkHealth() {
    return await this.wikidataService.checkApiHealth();
  }
}