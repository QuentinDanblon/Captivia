import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GbifService } from '../external/gbif.service';
import { isUpstreamNotFound } from '../external/http/external-errors';
import { isBreedId } from './species-parent';

/** Codes d'erreur renvoyés au client quand l'espèce d'un animal ne peut pas être retenue. */
export const SpeciesCatalogErrorCode = {
  /** Identifiant inconnu du catalogue et de GBIF. */
  NOT_FOUND: 'SPECIES_NOT_FOUND',
  /** Taxon GBIF qui n'est pas un animal au rang espèce (plante, genre, famille…). */
  NOT_ANIMAL: 'SPECIES_NOT_ANIMAL',
  /** Animal d'un groupe que le catalogue ne classe pas encore (mollusque, crustacé…). */
  UNSUPPORTED_GROUP: 'SPECIES_UNSUPPORTED_GROUP',
  /** GBIF momentanément indisponible : réessayer plus tard. */
  LOOKUP_UNAVAILABLE: 'SPECIES_LOOKUP_UNAVAILABLE',
} as const;

/** Classe GBIF → catégorie du catalogue (contrainte "SpeciesProfile_category_check"). */
const CATEGORY_BY_CLASS: Record<string, string> = {
  Mammalia: 'mammifère',
  Aves: 'oiseau',
  Reptilia: 'reptile',
  Squamata: 'reptile',
  Testudines: 'reptile',
  Crocodylia: 'reptile',
  Rhynchocephalia: 'reptile',
  Amphibia: 'amphibien',
  Actinopterygii: 'poisson',
  Elasmobranchii: 'poisson',
  Holocephali: 'poisson',
  Sarcopterygii: 'poisson',
  Myxini: 'poisson',
  Petromyzonti: 'poisson',
  Cephalaspidomorphi: 'poisson',
  Insecta: 'insecte',
  Arachnida: 'arachnide',
};

const SPECIES_RANKS = new Set(['SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM']);

/** Langues GBIF du français (ISO 639-2/B et /T, ISO 639-1). */
const FRENCH = new Set(['fra', 'fre', 'fr']);

function speciesError(
  status: 400 | 503,
  code: string,
  message: string,
): HttpException {
  const body = { statusCode: status, code, message };
  return status === 503
    ? new ServiceUnavailableException(body)
    : new BadRequestException(body);
}

/**
 * Catalogue des espèces vu depuis le carnet : garantit qu'un animal référence une fiche
 * existante. Une espèce choisie dans le repli GBIF (absente de la base) reçoit une fiche
 * minimale tirée de GBIF — noms, catégorie, lien vers la fiche GBIF — sans aucune donnée
 * d'élevage ni de santé (les sections restent vides).
 */
@Injectable()
export class SpeciesCatalogService {
  private readonly logger = new Logger(SpeciesCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbif: GbifService,
  ) {}

  /** Lève une 400 (ou 503 si GBIF est en panne) avec un `code` si l'espèce ne peut être retenue. */
  async ensureSpecies(speciesId: number): Promise<void> {
    const existing = await this.prisma.speciesProfile.findUnique({
      where: { speciesId },
      select: { speciesId: true },
    });
    if (existing) return;
    if (
      !Number.isSafeInteger(speciesId) ||
      speciesId < 1 ||
      isBreedId(speciesId)
    ) {
      throw speciesError(
        400,
        SpeciesCatalogErrorCode.NOT_FOUND,
        'Unknown species.',
      );
    }

    let taxon: Awaited<ReturnType<GbifService['getSpecies']>>;
    try {
      taxon = await this.gbif.getSpecies(String(speciesId));
    } catch (error) {
      if (isUpstreamNotFound(error) || error instanceof HttpException) {
        throw speciesError(
          400,
          SpeciesCatalogErrorCode.NOT_FOUND,
          'Unknown species.',
        );
      }
      throw speciesError(
        503,
        SpeciesCatalogErrorCode.LOOKUP_UNAVAILABLE,
        'Species data temporarily unavailable.',
      );
    }

    if (
      !taxon ||
      taxon.kingdom !== 'Animalia' ||
      !SPECIES_RANKS.has(String(taxon.rank))
    ) {
      throw speciesError(
        400,
        SpeciesCatalogErrorCode.NOT_ANIMAL,
        'This taxon is not an animal species.',
      );
    }
    const category = CATEGORY_BY_CLASS[String(taxon.class)];
    if (!category) {
      throw speciesError(
        400,
        SpeciesCatalogErrorCode.UNSUPPORTED_GROUP,
        'This group of animals is not supported yet.',
      );
    }

    const scientificName = (
      taxon.canonicalName ||
      taxon.scientificName ||
      ''
    ).trim();
    if (!scientificName) {
      throw speciesError(
        400,
        SpeciesCatalogErrorCode.NOT_FOUND,
        'Unknown species.',
      );
    }
    const commonNameFr = (await this.frenchName(speciesId)) ?? scientificName;

    // skipDuplicates : deux créations simultanées de la même espèce ne se gênent pas.
    await this.prisma.speciesProfile.createMany({
      data: [
        {
          speciesId,
          commonNameFr: commonNameFr.slice(0, 200),
          scientificName: scientificName.slice(0, 200),
          category,
          subcategory: null,
          // Espèce hors catalogue choisie par un particulier : animal de compagnie non
          // conventionnel par défaut (classement, pas une donnée d'élevage).
          domesticationType: 'NAC',
          description: null,
          sourceUrl: `https://www.gbif.org/species/${speciesId}`,
        },
      ],
      skipDuplicates: true,
    });
    this.logger.log(
      `Fiche espèce minimale créée depuis GBIF : ${speciesId} (${scientificName})`,
    );
  }

  /** Nom vernaculaire français GBIF, s'il existe (une panne n'empêche pas la création). */
  private async frenchName(speciesId: number): Promise<string | null> {
    try {
      const names = await this.gbif.getVernacularNames(String(speciesId));
      const fr = names.find(
        (n) => !!n.name?.trim() && FRENCH.has(String(n.language).toLowerCase()),
      );
      if (!fr) return null;
      const name = fr.name.trim();
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return null;
    }
  }
}
