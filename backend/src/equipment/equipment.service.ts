import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  domesticGroup,
  equipmentDefaults,
  type EquipmentItem,
} from './equipment-defaults';
import {
  PaginationQueryDto,
  PAGINATION_MAX_LIMIT,
  toPage,
} from '../common/dto/pagination-query.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendedEquipment(
    speciesId?: number,
    category?: string,
    size?: string,
    page?: PaginationQueryDto,
  ): Promise<unknown> {
    const species = speciesId
      ? await this.prisma.speciesProfile.findUnique({
          where: { speciesId },
          select: {
            speciesId: true,
            scientificName: true,
            category: true,
            habitats: {
              where: { locale: 'fr' },
              take: 1,
              select: {
                habitatType: true,
                activityEnrichment: true,
                lightNeeds: true,
                sources: true,
              },
            },
          },
        })
      : null;
    if (
      species &&
      !species.habitats.length &&
      !domesticGroup(species.scientificName)
    ) {
      // Les races sans section propre reprennent l'habitat documenté de leur espèce parente.
      const parent = await this.prisma.speciesProfile.findFirst({
        where: {
          scientificName: {
            equals: species.scientificName,
            mode: 'insensitive',
          },
          habitats: { some: { locale: 'fr' } },
        },
        orderBy: { speciesId: 'asc' },
        select: {
          habitats: {
            where: { locale: 'fr' },
            take: 1,
            select: {
              habitatType: true,
              activityEnrichment: true,
              lightNeeds: true,
              sources: true,
            },
          },
        },
      });
      species.habitats = parent?.habitats ?? [];
    }
    const where: Prisma.RecommendedEquipmentWhereInput = {};
    if (speciesId) {
      where.OR = [{ speciesId }];
      // Les anciennes lignes « générales » sont du matériel de terrarium, pas du matériel universel.
      if (species?.category === 'reptile') {
        where.OR.push({
          speciesId: null,
          category: { in: ['thermostat', 'thermometre'] },
        });
      }
    }
    if (category) where.category = category;
    if (size) where.size = size;

    const defaults = species
      ? equipmentDefaults(species)
      : { recommendations: [], sources: [] };
    const { take, skip } = toPage(page);
    const records = await this.prisma.recommendedEquipment.findMany({
      where,
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });
    const recommendations: EquipmentItem[] = records.map((rec) => ({
      id: rec.id,
      label: rec.label,
      category: rec.category,
      size: rec.size,
      speciesId: rec.speciesId,
    }));
    // Les suggestions viennent après les entrées spécifiques, avec la même pagination.
    if (species && records.length < take && !size) {
      const total =
        skip === 0
          ? records.length
          : await this.prisma.recommendedEquipment.count({ where });
      const categories =
        skip === 0
          ? records
          : await this.prisma.recommendedEquipment.findMany({
              where,
              select: { category: true },
              distinct: ['category'],
              take: PAGINATION_MAX_LIMIT,
            });
      const existingCategories = new Set(categories.map((rec) => rec.category));
      const housingCategories = [
        'cage',
        'terrarium',
        'vivarium',
        'aquarium',
        'aquaterrarium',
        'voliere',
        'enclos',
        'bassin',
      ];
      if (housingCategories.some((value) => existingCategories.has(value))) {
        housingCategories.forEach((value) => existingCategories.add(value));
      }
      const fallback = defaults.recommendations.filter(
        (rec) =>
          !existingCategories.has(rec.category) &&
          (!category || rec.category === category),
      );
      const start = Math.max(0, skip - total);
      recommendations.push(
        ...fallback.slice(start, start + take - records.length),
      );
    }

    // Recommandations éditoriales uniquement (taxonomie locale). L'intégration produits
    // Amazon (PA-API / Creators API) n'est pas branchée : aucune liste de produits n'est
    // renvoyée, donc aucune donnée inventée (décision D-09, tâche W3-05).
    return {
      speciesId,
      category,
      size,
      recommendations,
      ...(defaults.sources.length ? { sources: defaults.sources } : {}),
      affiliate: {
        disclaimer:
          'Certains liens de la boutique Captivia sont des liens affiliés. En achetant via ces liens, vous soutenez Captivia sans coût supplémentaire.',
        transparencyUrl: '/transparency',
      },
    };
  }

  async createRecommendation(data: {
    speciesId?: number;
    category: string;
    label: string;
    size?: string;
    searchTerms: string[];
    order?: number;
  }) {
    return this.prisma.recommendedEquipment.create({
      data: {
        speciesId: data.speciesId,
        category: data.category,
        label: data.label,
        size: data.size,
        searchTerms: data.searchTerms,
        order: data.order || 0,
      },
    });
  }

  async updateRecommendation(
    id: string,
    data: {
      category?: string;
      label?: string;
      size?: string;
      searchTerms?: string[];
      order?: number;
    },
  ) {
    return this.prisma.recommendedEquipment.update({
      where: { id },
      data,
    });
  }

  async deleteRecommendation(id: string) {
    try {
      return await this.prisma.recommendedEquipment.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Equipment recommendation ${id} not found`);
      }
      throw error;
    }
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.prisma.recommendedEquipment.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return categories.map((c) => c.category);
  }
}
