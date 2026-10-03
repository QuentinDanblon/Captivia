import type { PrismaClient } from '@prisma/client';

/**
 * Race → espèce parente.
 *
 * Les races ont un identifiant artificiel (≥ 2 000 000 001, voir schema.prisma) et aucune clé
 * étrangère vers leur espèce : le lien passe par le nom scientifique (« Felis catus » pour un
 * Persan). Quand une section éditoriale (alimentation, santé…) d'une race est absente, l'API
 * sert celle de l'espèce parente, qui est sourcée, plutôt qu'une section générée par modèle.
 */

/** Plus petit identifiant artificiel de race (les clés GBIF sont en dessous). */
export const BREED_ID_MIN = 2_000_000_001;

export function isBreedId(speciesId: number): boolean {
  return speciesId >= BREED_ID_MIN;
}

/**
 * Synonymes taxonomiques présents dans le catalogue : les races suivent la nomenclature récente
 * (« Canis lupus familiaris »), certaines fiches espèces l'ancienne (« Canis familiaris »).
 * Chaque groupe désigne un seul et même taxon.
 */
const SYNONYM_GROUPS: string[][] = [
  ['canis lupus familiaris', 'canis familiaris'],
  ['equus ferus caballus', 'equus caballus'],
  ['capra aegagrus hircus', 'capra hircus'],
  ['sus scrofa domesticus', 'sus domesticus'],
  ['bos taurus', 'bos taurus taurus'],
  ['ovis aries', 'ovis orientalis aries'],
  ['anas platyrhynchos domesticus', 'anas platyrhynchos f. domestica'],
  ['columba livia domestica', 'columba livia'],
];

export function normalizeScientificName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Nom scientifique normalisé et ses synonymes (minuscules). */
export function scientificNameVariants(name: string): string[] {
  const normalized = normalizeScientificName(name);
  if (!normalized) return [];
  const group = SYNONYM_GROUPS.find((g) => g.includes(normalized));
  return group ? [...group] : [normalized];
}

export interface ParentSpecies {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
  category: string;
  subcategory: string | null;
}

/** Client Prisma (ou transaction) : seule la table des fiches espèces est lue. */
export type ParentLookupDb = Pick<PrismaClient, 'speciesProfile'>;

const PARENT_SELECT = {
  speciesId: true,
  commonNameFr: true,
  scientificName: true,
  category: true,
  subcategory: true,
} as const;

/**
 * Espèce parente d'une race : fiche NON-race portant le même nom scientifique (ou un synonyme).
 * Null pour une espèce, une race inconnue ou une race sans parent identifiable (nom scientifique
 * non latin, espèce absente du catalogue).
 */
export async function findParentSpecies(
  db: ParentLookupDb,
  speciesId: number,
  scientificName?: string,
): Promise<ParentSpecies | null> {
  if (!isBreedId(speciesId)) return null;
  let name = scientificName;
  if (name === undefined) {
    const breed = await db.speciesProfile.findUnique({
      where: { speciesId },
      select: { speciesId: true, scientificName: true },
    });
    if (!breed) return null;
    name = breed.scientificName;
  }
  const variants = scientificNameVariants(name);
  if (variants.length === 0) return null;
  return db.speciesProfile.findFirst({
    where: {
      speciesId: { lt: BREED_ID_MIN },
      OR: variants.map((v) => ({
        scientificName: { equals: v, mode: 'insensitive' },
      })),
    },
    select: PARENT_SELECT,
    orderBy: { speciesId: 'asc' },
  });
}

/** Indication renvoyée par l'API quand des sections viennent de l'espèce parente. */
export interface InheritedFrom {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
}

export function toInheritedFrom(parent: ParentSpecies): InheritedFrom {
  return {
    speciesId: parent.speciesId,
    commonNameFr: parent.commonNameFr,
    scientificName: parent.scientificName,
  };
}
