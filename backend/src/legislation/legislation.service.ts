import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  toPage,
} from '../common/dto/pagination-query.dto';
import { SpeciesPlusService } from './services/speciesplus.service';

@Injectable()
export class LegislationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly speciesPlusService: SpeciesPlusService,
  ) {}

  async getSpeciesLegislation(speciesId: number, country?: string, page?: PaginationQueryDto) {
    // Try to get editorial content from database
    let legislations: Awaited<ReturnType<typeof this.prisma.speciesLegislation.findUnique>>[];

    if (country) {
      const item = await this.prisma.speciesLegislation.findUnique({
        where: {
          speciesId_country: {
            speciesId,
            country: country.toUpperCase(),
          },
        },
      });
      legislations = item ? [item] : [];
    } else {
      const items = await this.prisma.speciesLegislation.findMany({
        where: { speciesId },
        orderBy: [{ country: 'asc' }, { id: 'asc' }],
        ...toPage(page),
      });
      legislations = items;
    }

    // TODO: Fetch from Species+ API
    // For now, this would require the scientific name
    // const species = await gbifService.getSpecies(speciesId);
    // const speciesPlusResults = await this.speciesPlusService.searchByScientificName(species.scientificName);
    // const citesData = await this.speciesPlusService.getCitesLegislation(speciesPlusResults[0].id);
    // const euData = await this.speciesPlusService.getEULegislation(speciesPlusResults[0].id);

    return {
      speciesId,
      country: country?.toUpperCase(),
      editorial: legislations?.filter(Boolean) || [],
      speciesPlus: {
        cites: null, // Will be populated when integrated with GBIF
        eu: null,
      },
      disclaimer:
        'Informations indicatives. Vérifiez toujours la réglementation locale en vigueur.',
      sources: [
        'https://api.speciesplus.net/',
        'https://eur-lex.europa.eu/',
        'https://www.aphis.usda.gov/',
      ],
    };
  }

  async createOrUpdateLegislation(
    speciesId: number,
    country: string,
    status: string,
    details: any,
    sources: string[],
  ) {
    return this.prisma.speciesLegislation.upsert({
      where: {
        speciesId_country: {
          speciesId,
          country: country.toUpperCase(),
        },
      },
      create: {
        speciesId,
        country: country.toUpperCase(),
        status,
        details,
        sources,
      },
      update: {
        status,
        details,
        sources,
      },
    });
  }

  async searchSpeciesPlus(scientificName: string) {
    return this.speciesPlusService.searchByScientificName(scientificName);
  }

  async getCitesLegislation(taxonId: number) {
    return this.speciesPlusService.getCitesLegislation(taxonId);
  }

  async getEULegislation(taxonId: number) {
    return this.speciesPlusService.getEULegislation(taxonId);
  }
}
