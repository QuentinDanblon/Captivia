import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PubmedService } from './services/pubmed.service';
import { describeHttpError } from '../external/http-safety';
import {
  findParentSpecies,
  InheritedFrom,
  isBreedId,
  toInheritedFrom,
} from '../species/species-parent';

@Injectable()
export class HealthContentService {
  private readonly logger = new Logger(HealthContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubmedService: PubmedService,
  ) {}

  async getSpeciesHealth(speciesId: number, disease?: string, locale = 'fr') {
    // Try to get editorial content from database
    let editorialContent = await this.prisma.speciesHealthContent.findUnique({
      where: {
        speciesId_locale: {
          speciesId,
          locale,
        },
      },
    });
    // Race sans fiche santé : celle de son espèce parente (sourcée), jamais un modèle générique.
    let inheritedFrom: InheritedFrom | null = null;
    if (!editorialContent && isBreedId(speciesId)) {
      const parent = await findParentSpecies(this.prisma, speciesId);
      if (parent) {
        editorialContent = await this.prisma.speciesHealthContent.findUnique({
          where: {
            speciesId_locale: { speciesId: parent.speciesId, locale },
          },
        });
        if (editorialContent) inheritedFrom = toInheritedFrom(parent);
      }
    }

    // Références PubMed : recherche par nom scientifique (profil local de l'espèce).
    // Pas de profil → aucun appel PubMed. Panne PubMed → fiche servie sans références,
    // signalée par `pubmedAvailable: false` (jamais une erreur 5xx ni un résultat caché).
    let pubmedArticles: unknown[] = [];
    let pubmedAvailable = true;
    const profile = await this.prisma.speciesProfile.findUnique({
      where: { speciesId },
      select: { scientificName: true },
    });
    if (profile?.scientificName) {
      try {
        pubmedArticles = await this.pubmedService.searchBySpeciesAndDisease(
          profile.scientificName,
          disease,
        );
      } catch (error) {
        pubmedAvailable = false;
        this.logger.warn(
          `PubMed indisponible pour l'espèce ${speciesId}: ${describeHttpError(error)}`,
        );
      }
    }

    return {
      speciesId,
      locale,
      editorial: editorialContent
        ? {
            diseases: editorialContent.diseases,
            sources: editorialContent.sources,
            updatedAt: editorialContent.updatedAt,
          }
        : null,
      inheritedFrom,
      pubmed: pubmedArticles,
      pubmedAvailable,
      disclaimer:
        'Cette information ne remplace pas un avis vétérinaire. Consultez toujours un professionnel en cas de doute.',
    };
  }

  async createOrUpdateHealthContent(
    speciesId: number,
    locale: string,
    diseases: Prisma.InputJsonValue,
    sources: Prisma.InputJsonValue,
  ) {
    try {
      return await this.prisma.speciesHealthContent.upsert({
        where: {
          speciesId_locale: {
            speciesId,
            locale,
          },
        },
        create: {
          speciesId,
          locale,
          diseases,
          sources,
        },
        update: {
          diseases,
          sources,
        },
      });
    } catch (e) {
      // W1-09 : FK SpeciesHealthContent.speciesId -> SpeciesProfile (P2003) = fiche espèce inexistante.
      if ((e as { code?: string })?.code === 'P2003') {
        throw new NotFoundException('Species not found');
      }
      throw e;
    }
  }

  async searchPubMed(query: string, maxResults = 10): Promise<unknown[]> {
    return this.pubmedService.searchArticles(query, maxResults);
  }
}
