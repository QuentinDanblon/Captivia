/**
 * BREEDS BULK — Import idempotent des 1 379 races/fiches de breeds-data.json,
 * appelé à la fin du seed (`seed-prod.ts`).
 *
 * Contrairement à `import-breeds.ts` (upsert ligne à ligne, écrase les fiches
 * existantes), ce module utilise `createMany({ skipDuplicates })` par lots :
 *  - quelques dizaines de requêtes au lieu de ~10 000 ;
 *  - ne modifie JAMAIS une fiche déjà présente (les fiches espèces curatées
 *    par seed-prod restent intactes) ; seul `sourceUrl` est complété s'il est
 *    encore vide ;
 *  - relançable à volonté (clés uniques speciesId / locale / country).
 * Pour forcer la mise à jour de fiches existantes : `npm run seed:breeds`.
 *
 * B1 — les sections (alimentation, santé…) d'une race sont facultatives : null = la race hérite,
 * dans l'API, des sections sourcées de son espèce parente. Une section présente doit passer
 * `validation.ts` (sources non génériques, catégorie et régime compatibles avec l'espèce
 * parente) ; sinon l'import échoue (le seed s'arrête), plutôt que d'écrire une donnée fausse.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { BREED_ID_MIN, scientificNameVariants } from '../src/species/species-parent';
import { BreedEntryLike, ParentInfo, validateBreedEntry } from './validation';

const VALID_CATEGORIES = ['mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte', 'arachnide'];
const VALID_DOMESTICATION = ['domestique', 'semi-domestique', 'NAC'];
const BATCH_SIZE = 500;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Breed = Record<string, any>;

const json = (v: unknown): Prisma.InputJsonValue => (v ?? []) as Prisma.InputJsonValue;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface BreedsBulkResult {
  total: number;
  valid: number;
  profilesCreated: number;
  errors: string[];
}

/**
 * Espèces parentes possibles (fiches non-races) : nom scientifique normalisé → catégorie et
 * régime alimentaire en base.
 */
async function loadParents(prisma: PrismaClient): Promise<Map<string, ParentInfo>> {
  const species = await prisma.speciesProfile.findMany({
    where: { speciesId: { lt: BREED_ID_MIN } },
    select: { scientificName: true, category: true, feedings: { where: { locale: 'fr' }, select: { dietType: true } } },
    orderBy: { speciesId: 'asc' },
  });
  const parents = new Map<string, ParentInfo>();
  for (const s of species) {
    const key = s.scientificName.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!parents.has(key)) parents.set(key, { category: s.category, dietType: s.feedings[0]?.dietType ?? null });
  }
  return parents;
}

function parentOf(parents: Map<string, ParentInfo>, scientificName: string): ParentInfo | null {
  for (const v of scientificNameVariants(scientificName)) {
    const p = parents.get(v);
    if (p) return p;
  }
  return null;
}

export async function importBreedsBulk(prisma: PrismaClient): Promise<BreedsBulkResult> {
  const dataPath = path.resolve(__dirname, 'breeds-data.json');
  const all: Breed[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const errors: string[] = [];
  // Entrées qui ne sont pas des animaux (outils, objets, Q-ids Wikidata non résolus).
  const excluded = new Set<number>(
    (JSON.parse(fs.readFileSync(path.resolve(__dirname, 'enrichment', 'excluded-breed-ids.json'), 'utf-8')) as { ids: number[] }).ids,
  );

  const breeds = all.filter((b) => {
    const label = `[${b.speciesId}] ${b.commonNameFr}`;
    if (excluded.has(b.speciesId)) return false;
    if (!VALID_CATEGORIES.includes(b.category)) errors.push(`${label}: catégorie invalide "${b.category}"`);
    else if (!VALID_DOMESTICATION.includes(b.domesticationType))
      errors.push(`${label}: domesticationType invalide "${b.domesticationType}"`);
    else if (b.feeding && (!b.feeding.recommendedFoods?.length || !b.feeding.foodsToAvoid?.length))
      errors.push(`${label}: feeding incomplet`);
    else return true;
    return false;
  });

  // Sections : sourcées (sources non génériques) et compatibles avec l'espèce parente.
  const parents = await loadParents(prisma);
  for (const b of breeds) {
    if (b.speciesId < BREED_ID_MIN) continue;
    errors.push(...validateBreedEntry(b as BreedEntryLike, parentOf(parents, b.scientificName)));
  }
  if (errors.length > 0) {
    return { total: all.length, valid: 0, profilesCreated: 0, errors };
  }

  let profilesCreated = 0;
  for (const batch of chunk(breeds, BATCH_SIZE)) {
    const profiles = await prisma.speciesProfile.createMany({
      skipDuplicates: true,
      data: batch.map((b) => ({
        speciesId: b.speciesId,
        commonNameFr: b.commonNameFr,
        scientificName: b.scientificName,
        category: b.category,
        subcategory: b.subcategory,
        domesticationType: b.domesticationType,
        description: b.description,
        sourceUrl: b.sourceUrl,
      })),
    });
    profilesCreated += profiles.count;

    await prisma.speciesFeeding.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.feeding).map((b) => ({
        speciesId: b.speciesId,
        locale: 'fr',
        dietType: b.feeding.dietType,
        recommendedFoods: json(b.feeding.recommendedFoods),
        foodsToAvoid: json(b.feeding.foodsToAvoid),
        mealFrequency: b.feeding.mealFrequency,
        specificNeeds: b.feeding.specificNeeds,
        sources: json(b.feeding.sources),
      })),
    });

    await prisma.speciesHabitat.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.habitat).map((b) => ({
        speciesId: b.speciesId,
        locale: 'fr',
        habitatType: b.habitat.habitatType,
        tempMin: b.habitat.tempMin,
        tempMax: b.habitat.tempMax,
        humidityMin: b.habitat.humidityMin ?? null,
        humidityMax: b.habitat.humidityMax ?? null,
        minSpaceSize: b.habitat.minSpaceSize,
        lightNeeds: b.habitat.lightNeeds,
        activityEnrichment: b.habitat.activityEnrichment,
        hygieneNotes: b.habitat.hygieneNotes,
        costEstimate: b.habitat.costEstimate,
        sources: json(b.habitat.sources),
      })),
    });

    await prisma.speciesBehavior.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.behavior).map((b) => ({
        speciesId: b.speciesId,
        locale: 'fr',
        generalBehavior: b.behavior.generalBehavior,
        sociability: b.behavior.sociability,
        difficultyLevel: b.behavior.difficultyLevel,
        compatibilityWithChildren: b.behavior.compatibilityWithChildren,
        compatibilityWithOtherAnimals: b.behavior.compatibilityWithOtherAnimals,
        sources: json(b.behavior.sources),
      })),
    });

    await prisma.speciesHealthContent.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.health).map((b) => ({
        speciesId: b.speciesId,
        locale: 'fr',
        diseases: json(b.health.diseases),
        sources: json(b.health.sources),
      })),
    });

    await prisma.speciesLegislation.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.legislation).map((b) => ({
        speciesId: b.speciesId,
        country: b.legislation.country,
        status: b.legislation.status,
        details: json(b.legislation.details),
        sources: (b.legislation.sources ?? []).map((s: { url: string }) => s.url),
      })),
    });

    await prisma.speciesReproduction.createMany({
      skipDuplicates: true,
      data: batch.filter((b) => b.reproduction).map((b) => ({
        speciesId: b.speciesId,
        locale: 'fr',
        season: b.reproduction.season,
        gestationDays: b.reproduction.gestationDays ?? null,
        incubationDays: b.reproduction.incubationDays ?? null,
        litterSizeMin: b.reproduction.litterSizeMin ?? null,
        litterSizeMax: b.reproduction.litterSizeMax ?? null,
        sexualMaturityMonths: b.reproduction.sexualMaturityMonths ?? null,
        breedingDifficulty: b.reproduction.breedingDifficulty,
        notes: b.reproduction.notes,
        sources: json(b.reproduction.sources),
      })),
    });
  }

  // Fiches espèces préexistantes : compléter sourceUrl uniquement s'il est vide.
  for (const b of breeds) {
    if (b.sourceUrl) {
      await prisma.speciesProfile.updateMany({
        where: { speciesId: b.speciesId, sourceUrl: null },
        data: { sourceUrl: b.sourceUrl },
      });
    }
  }

  return { total: all.length, valid: breeds.length, profilesCreated, errors };
}
