import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface SpeciesFilterProfile {
  category?: string;
  domesticationType?: string;
}

interface SpeciesProfileDetail {
  profile: any;
  feeding?: any;
  habitat?: any;
  behavior?: any;
}

@Injectable()
export class SpeciesProfileService {
  private readonly logger = new Logger(SpeciesProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchFromProfile(
    query: string,
    limit: number = 20,
    offset: number = 0,
    filters?: SpeciesFilterProfile,
  ): Promise<any> {
    this.logger.log(
      `Searching profiles: query="${query}", limit=${limit}, offset=${offset}, filters=${JSON.stringify(filters)}`,
    );

    const whereConditions: Prisma.SpeciesProfileWhereInput[] = [
      {
        OR: [
          { commonNameFr: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { scientificName: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      },
    ];

    if (filters?.category) {
      whereConditions.push({ category: filters.category });
    }

    if (filters?.domesticationType) {
      whereConditions.push({ domesticationType: filters.domesticationType });
    }

    const where: Prisma.SpeciesProfileWhereInput =
      whereConditions.length > 1
        ? { AND: whereConditions }
        : whereConditions[0];

    const [profiles, total] = await Promise.all([
      this.prisma.speciesProfile.findMany({
        where,
        orderBy: [{ commonNameFr: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.speciesProfile.count({ where }),
    ]);

    const results = profiles.map(
      (profile) => this.transformProfileToSearchResult(profile),
    );

    return {
      results,
      total,
      source: 'profile',
    };
  }

  async getBySpeciesId(
    speciesId: number,
    locale: string = 'fr',
  ): Promise<SpeciesProfileDetail> {
    this.logger.log(
      `Getting species detail: speciesId=${speciesId}, locale=${locale}`,
    );

    const [profile, feeding, habitat, behavior] = await Promise.all([
      this.prisma.speciesProfile.findUnique({
        where: { speciesId },
      }),
      this.prisma.speciesFeeding.findUnique({
        where: {
          speciesId_locale: {
            speciesId,
            locale,
          },
        },
      }),
      this.prisma.speciesHabitat.findUnique({
        where: {
          speciesId_locale: {
            speciesId,
            locale,
          },
        },
      }),
      this.prisma.speciesBehavior.findUnique({
        where: {
          speciesId_locale: {
            speciesId,
            locale,
          },
        },
      }),
    ]);

    return {
      profile,
      feeding,
      habitat,
      behavior,
    };
  }

  /**
   * Fiche reproduction éditoriale (Module B) : ligne SpeciesReproduction pour
   * speciesId, locale 'fr' en priorité, fallback sur n'importe quelle autre
   * locale si la fiche fr n'existe pas encore.
   */
  async getReproduction(speciesId: number): Promise<any> {
    const fr = await this.prisma.speciesReproduction.findUnique({
      where: {
        speciesId_locale: {
          speciesId,
          locale: 'fr',
        },
      },
    });
    if (fr) {
      return fr;
    }
    return this.prisma.speciesReproduction.findFirst({
      where: { speciesId },
      orderBy: { locale: 'asc' },
    });
  }

  private transformProfileToSearchResult(profile: any): any {
    return {
      key: profile.speciesId,
      name: profile.commonNameFr || profile.scientificName,
      canonicalName: profile.commonNameFr || profile.scientificName,
      scientificName: profile.scientificName,
      vernacularName: profile.commonNameFr,
      category: profile.category,
      subcategory: profile.subcategory,
      domesticationType: profile.domesticationType,
      description: profile.description,
      lastReviewedAt: profile.lastReviewedAt ?? null,
    };
  }
}
