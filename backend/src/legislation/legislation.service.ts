import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, toPage } from '../common/dto/pagination-query.dto';
import { SpeciesPlusService } from './services/speciesplus.service';
import { describeHttpError } from '../external/http-safety';

@Injectable()
export class LegislationService {
  private readonly logger = new Logger(LegislationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly speciesPlusService: SpeciesPlusService,
  ) {}

  async getSpeciesLegislation(
    speciesId: number,
    country?: string,
    page?: PaginationQueryDto,
  ) {
    // Try to get editorial content from database
    let legislations: Awaited<
      ReturnType<typeof this.prisma.speciesLegislation.findUnique>
    >[];

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

    // Species+ (CITES / UE) : uniquement si l'intégration est configurée (jeton), via le nom
    // scientifique du profil local. Jamais de donnée inventée : `status` dit ce qu'il en est.
    const speciesPlus = await this.getSpeciesPlusInfo(speciesId);

    return {
      speciesId,
      country: country?.toUpperCase(),
      editorial: legislations?.filter(Boolean) || [],
      speciesPlus,
      disclaimer:
        'Informations indicatives. Vérifiez toujours la réglementation locale en vigueur.',
      sources: [
        'https://api.speciesplus.net/',
        'https://eur-lex.europa.eu/',
        'https://www.aphis.usda.gov/',
      ],
    };
  }

  /**
   * Statut Species+ d'une espèce :
   * - `disabled`    : pas de jeton SPECIESPLUS_API_TOKEN (intégration désactivée) ;
   * - `not_found`   : pas de profil local, ou taxon absent de Species+ ;
   * - `unavailable` : Species+ en panne (disjoncteur / réseau) — la fiche reste servie ;
   * - `ok`          : listes CITES et UE issues de Species+.
   */
  private async getSpeciesPlusInfo(speciesId: number): Promise<{
    status: 'disabled' | 'not_found' | 'unavailable' | 'ok';
    taxonId?: number;
    cites: unknown[] | null;
    eu: unknown[] | null;
  }> {
    if (!this.speciesPlusService.isConfigured()) {
      return { status: 'disabled', cites: null, eu: null };
    }
    const profile = await this.prisma.speciesProfile.findUnique({
      where: { speciesId },
      select: { scientificName: true },
    });
    if (!profile?.scientificName) {
      return { status: 'not_found', cites: null, eu: null };
    }
    try {
      const taxa = await this.speciesPlusService.searchByScientificName(
        profile.scientificName,
      );
      const wanted = profile.scientificName.trim().toLowerCase();
      const taxon =
        taxa.find(
          (t: any) => String(t?.full_name ?? '').toLowerCase() === wanted,
        ) ?? taxa[0];
      if (!taxon || typeof taxon.id !== 'number') {
        return { status: 'not_found', cites: null, eu: null };
      }
      const [cites, eu] = await Promise.all([
        this.speciesPlusService.getCitesLegislation(taxon.id),
        this.speciesPlusService.getEULegislation(taxon.id),
      ]);
      return { status: 'ok', taxonId: taxon.id, cites, eu };
    } catch (error) {
      this.logger.warn(
        `Species+ indisponible pour l'espèce ${speciesId}: ${describeHttpError(error)}`,
      );
      return { status: 'unavailable', cites: null, eu: null };
    }
  }

  async createOrUpdateLegislation(
    speciesId: number,
    country: string,
    status: string,
    details: any,
    sources: string[],
  ) {
    try {
      return await this.prisma.speciesLegislation.upsert({
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
    } catch (e) {
      // W1-09 : FK SpeciesLegislation.speciesId -> SpeciesProfile (P2003) = fiche espèce inexistante.
      if ((e as { code?: string })?.code === 'P2003') {
        throw new NotFoundException('Species not found');
      }
      throw e;
    }
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
