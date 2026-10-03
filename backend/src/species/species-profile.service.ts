import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  SpeciesBehavior,
  SpeciesFeeding,
  SpeciesHabitat,
  SpeciesProfile,
  SpeciesReproduction,
} from '@prisma/client';
import { matchAliases } from './species-aliases';
import {
  BREED_ID_MIN,
  findParentSpecies,
  InheritedFrom,
  isBreedId,
  scientificNameVariants,
  toInheritedFrom,
} from './species-parent';

/** Échappe les jokers de LIKE (barre oblique inverse, %, _) : la requête est cherchée telle quelle. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface SpeciesFilterProfile {
  category?: string;
  domesticationType?: string;
}

interface Sections {
  feeding: SpeciesFeeding | null;
  habitat: SpeciesHabitat | null;
  behavior: SpeciesBehavior | null;
}
type SectionKey = keyof Sections;

function isComplete(sections: Sections): boolean {
  return !!(sections.feeding && sections.habitat && sections.behavior);
}

/** Sections reprises de l'espèce parente d'une race (null : aucune). */
export type SectionsInheritedFrom = InheritedFrom & { sections: SectionKey[] };

export interface SpeciesProfileDetail {
  profile: SpeciesProfile | null;
  feeding?: SpeciesFeeding | null;
  habitat?: SpeciesHabitat | null;
  behavior?: SpeciesBehavior | null;
  inheritedFrom?: SectionsInheritedFrom | null;
}

/** Résultat de recherche construit à partir d'une fiche espèce locale. */
export interface ProfileSearchItem {
  key: number;
  name: string;
  canonicalName: string;
  scientificName: string;
  vernacularName: string;
  category: string;
  subcategory: string | null;
  domesticationType: string;
  description: string | null;
  lastReviewedAt: Date | null;
}

export interface ProfileSearchResult {
  results: ProfileSearchItem[];
  total: number;
  source: 'profile';
}

@Injectable()
export class SpeciesProfileService {
  private readonly logger = new Logger(SpeciesProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche dans le catalogue local, triée par pertinence (M10) :
   *  0. nom commun égal à la requête (ou alias exact : « chat », « dog », « Hund »…) ;
   *  1. nom commun qui commence par la requête ;
   *  2. un mot du nom commun commence par la requête, ou race d'une espèce trouvée par alias ;
   *  3. nom commun qui contient la requête ;
   *  4. nom scientifique qui commence par la requête, 5. qui la contient ;
   *  6. description qui la contient.
   * À pertinence égale : les espèces avant les races, puis l'ordre alphabétique. Les filtres
   * « contient » s'appuient sur les index trigram (pg_trgm) de commonNameFr et scientificName.
   */
  async searchFromProfile(
    query: string,
    limit: number = 20,
    offset: number = 0,
    filters?: SpeciesFilterProfile,
  ): Promise<ProfileSearchResult> {
    this.logger.log(
      `Searching profiles: query="${query}", limit=${limit}, offset=${offset}, filters=${JSON.stringify(filters)}`,
    );

    const q = (query ?? '').trim();
    const like = escapeLike(q);
    const aliasHits = matchAliases(q);
    const aliasIds = [...aliasHits.keys()];
    const aliasRanks = aliasIds.map((id) => aliasHits.get(id) as number);
    // Races des espèces trouvées par alias (« chat » → Persan, Abyssin…), rang 2.
    const aliasSpecies =
      aliasIds.length > 0
        ? await this.prisma.speciesProfile.findMany({
            where: { speciesId: { in: aliasIds } },
            select: { scientificName: true },
          })
        : [];
    const breedOf = [
      ...new Set(
        aliasSpecies.flatMap((a) => scientificNameVariants(a.scientificName)),
      ),
    ];

    const conditions: Prisma.Sql[] = [
      Prisma.sql`(
        p."commonNameFr" ILIKE ${'%' + like + '%'}
        OR p."scientificName" ILIKE ${'%' + like + '%'}
        OR p."description" ILIKE ${'%' + like + '%'}
        OR a."sid" IS NOT NULL
        OR (p."speciesId" >= ${BREED_ID_MIN}
          AND lower(p."scientificName") = ANY(${breedOf}::text[]))
      )`,
    ];
    if (filters?.category) {
      conditions.push(Prisma.sql`p."category" = ${filters.category}`);
    }
    if (filters?.domesticationType) {
      conditions.push(
        Prisma.sql`p."domesticationType" = ${filters.domesticationType}`,
      );
    }
    const where = Prisma.join(conditions, ' AND ');
    const aliasJoin = Prisma.sql`LEFT JOIN unnest(${aliasIds}::int[], ${aliasRanks}::int[]) AS a("sid", "rank") ON a."sid" = p."speciesId"`;
    const relevance = Prisma.sql`LEAST(
      COALESCE(a."rank", 99),
      CASE
        WHEN p."speciesId" >= ${BREED_ID_MIN}
          AND lower(p."scientificName") = ANY(${breedOf}::text[]) THEN 2
        ELSE 99
      END,
      CASE
        WHEN lower(p."commonNameFr") = lower(${q}) THEN 0
        WHEN p."commonNameFr" ILIKE ${like + '%'} THEN 1
        WHEN p."commonNameFr" ILIKE ${'% ' + like + '%'}
          OR p."commonNameFr" ILIKE ${"%'" + like + '%'}
          OR p."commonNameFr" ILIKE ${'%-' + like + '%'} THEN 2
        WHEN p."commonNameFr" ILIKE ${'%' + like + '%'} THEN 3
        WHEN p."scientificName" ILIKE ${like + '%'} THEN 4
        WHEN p."scientificName" ILIKE ${'%' + like + '%'} THEN 5
        ELSE 6
      END
    )`;

    const [profiles, counted] = await Promise.all([
      this.prisma.$queryRaw<SpeciesProfile[]>`
        SELECT p.*
        FROM "SpeciesProfile" p
        ${aliasJoin}
        WHERE ${where}
        ORDER BY ${relevance} ASC,
          (p."speciesId" >= ${BREED_ID_MIN}) ASC,
          p."commonNameFr" ASC,
          p."id" ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS "total"
        FROM "SpeciesProfile" p
        ${aliasJoin}
        WHERE ${where}
      `,
    ]);

    const results = profiles.map((profile) =>
      this.transformProfileToSearchResult(profile),
    );

    return {
      results,
      total: Number(counted[0]?.total ?? 0),
      source: 'profile',
    };
  }

  /**
   * Fiche locale et sections éditoriales (alimentation, habitat, comportement). Pour une race,
   * une section absente est héritée de l'espèce parente (`inheritedFrom`) : jamais de section
   * générée par modèle, toujours la donnée sourcée de l'espèce.
   */
  async getBySpeciesId(
    speciesId: number,
    locale: string = 'fr',
  ): Promise<SpeciesProfileDetail> {
    this.logger.log(
      `Getting species detail: speciesId=${speciesId}, locale=${locale}`,
    );

    const [profile, own] = await Promise.all([
      this.prisma.speciesProfile.findUnique({
        where: { speciesId },
      }),
      this.loadSections(speciesId, locale),
    ]);

    if (!profile || !isBreedId(speciesId) || isComplete(own)) {
      return { profile, ...own, inheritedFrom: null };
    }

    const parent = await findParentSpecies(
      this.prisma,
      speciesId,
      profile.scientificName,
    );
    if (!parent) {
      return { profile, ...own, inheritedFrom: null };
    }
    const fromParent = await this.loadSections(parent.speciesId, locale);
    const sections: Sections = {
      feeding: own.feeding ?? fromParent.feeding,
      habitat: own.habitat ?? fromParent.habitat,
      behavior: own.behavior ?? fromParent.behavior,
    };
    const inherited = (Object.keys(sections) as SectionKey[]).filter(
      (k) => !own[k] && sections[k],
    );
    return {
      profile,
      ...sections,
      inheritedFrom:
        inherited.length > 0
          ? { ...toInheritedFrom(parent), sections: inherited }
          : null,
    };
  }

  /** Nom scientifique d'une fiche locale (null : pas de fiche). */
  async getScientificName(speciesId: number): Promise<string | null> {
    const profile = await this.prisma.speciesProfile.findUnique({
      where: { speciesId },
      select: { scientificName: true },
    });
    return profile ? profile.scientificName : null;
  }

  private async loadSections(
    speciesId: number,
    locale: string,
  ): Promise<Sections> {
    const where = { speciesId_locale: { speciesId, locale } };
    const [feeding, habitat, behavior] = await Promise.all([
      this.prisma.speciesFeeding.findUnique({ where }),
      this.prisma.speciesHabitat.findUnique({ where }),
      this.prisma.speciesBehavior.findUnique({ where }),
    ]);
    return { feeding, habitat, behavior };
  }

  /**
   * Fiche reproduction éditoriale (Module B) : ligne SpeciesReproduction pour
   * speciesId, locale 'fr' en priorité, fallback sur n'importe quelle autre
   * locale si la fiche fr n'existe pas encore. Une race sans fiche hérite de
   * celle de son espèce parente.
   */
  async getReproduction(
    speciesId: number,
  ): Promise<SpeciesReproduction | null> {
    const own = await this.findReproduction(speciesId);
    if (own || !isBreedId(speciesId)) {
      return own;
    }
    const parent = await findParentSpecies(this.prisma, speciesId);
    return parent ? this.findReproduction(parent.speciesId) : null;
  }

  private async findReproduction(
    speciesId: number,
  ): Promise<SpeciesReproduction | null> {
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

  private transformProfileToSearchResult(
    profile: SpeciesProfile,
  ): ProfileSearchItem {
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
