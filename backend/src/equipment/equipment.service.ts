import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  PAGINATION_MAX_LIMIT,
  toPage,
} from '../common/dto/pagination-query.dto';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  // Mapping of GBIF class to template species ID for fallback
  private readonly classTemplateMapping: Record<string, number> = {
    Reptilia: 2448340, // Boa constrictor as reptile template
    Aves: 0, // No bird template yet
    Mammalia: 0, // No mammal template yet
    Amphibia: 0, // No amphibian template yet
  };

  constructor(private readonly prisma: PrismaService) {}

  async getRecommendedEquipment(
    speciesId?: number,
    category?: string,
    size?: string,
    page?: PaginationQueryDto,
  ): Promise<unknown> {
    const where: any = {};

    if (speciesId) {
      where.OR = [{ speciesId }, { speciesId: null }]; // Include general items
    }

    if (category) {
      where.category = category;
    }

    if (size) {
      where.size = size;
    }

    let recommendations = await this.prisma.recommendedEquipment.findMany({
      where,
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      ...toPage(page),
    });

    // If no species-specific equipment found (only general), try fallback by class
    if (speciesId && recommendations.length === 0) {
      this.logger.debug(
        `No specific equipment found for species ${speciesId}, attempting class fallback`,
      );
      recommendations = await this.getEquipmentFallbackByClass(
        speciesId,
        category,
        size,
      );
    }

    // Recommandations éditoriales uniquement (taxonomie locale). L'intégration produits
    // Amazon (PA-API / Creators API) n'est pas branchée : aucune liste de produits n'est
    // renvoyée, donc aucune donnée inventée (décision D-09, tâche W3-05).
    return {
      speciesId,
      category,
      size,
      recommendations: recommendations.map((rec) => ({
        id: rec.id,
        label: rec.label,
        category: rec.category,
        size: rec.size,
        speciesId: rec.speciesId,
      })),
      affiliate: {
        disclaimer:
          'Certains liens de la boutique Captivia sont des liens affiliés. En achetant via ces liens, vous soutenez Captivia sans coût supplémentaire.',
        transparencyUrl: '/transparency',
      },
    };
  }

  /**
   * Get equipment fallback by species class (e.g., use Reptilia template for reptiles)
   */
  private async getEquipmentFallbackByClass(
    speciesId: number,
    category?: string,
    size?: string,
  ): Promise<any[]> {
    try {
      // Try to fetch species data to get its class
      // Note: This is a simple implementation; in production, you'd want to cache this
      const where: any = {
        OR: [{ speciesId: null }], // Get general items first
      };

      // Try to determine the class (simplified approach)
      // In a full implementation, we'd fetch the species from GBIF/database
      // For now, we use general equipment only as fallback
      // If you implement species fetching, you can map the class to a template species

      if (category) {
        where.category = category;
      }

      if (size) {
        where.size = size;
      }

      const generalEquipment = await this.prisma.recommendedEquipment.findMany({
        where,
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: PAGINATION_MAX_LIMIT,
      });

      this.logger.debug(
        `Returning ${generalEquipment.length} general equipment as fallback`,
      );
      return generalEquipment;
    } catch (error) {
      this.logger.error(`Error in equipment fallback: ${error.message}`);
      return [];
    }
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
