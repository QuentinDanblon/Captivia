/**
 * IMPORT BREEDS — Importe backend/prisma/breeds-data.json en base.
 * Idempotent : upserts par speciesId. Ajoute/remplace les profils + les
 * 6 tables satellites (feeding, habitat, behavior, health, legislation,
 * reproduction). Les speciesId artificiels ≥ 2 000 000 001 sont les races ;
 * les autres mettent à jour les fiches espèces existantes (comble les onglets).
 *
 * Usage : depuis backend/ : npx ts-node prisma/import-breeds.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BreedFeed {
  dietType: string;
  recommendedFoods: Array<{ name: string; frequency: string; notes?: string }>;
  foodsToAvoid: Array<{ name: string; reason: string }>;
  mealFrequency: string;
  specificNeeds?: string;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface BreedHabitat {
  habitatType: string;
  tempMin: number;
  tempMax: number;
  humidityMin?: number | null;
  humidityMax?: number | null;
  minSpaceSize: string;
  lightNeeds: string;
  activityEnrichment: string;
  hygieneNotes?: string;
  costEstimate: string;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface BreedBehavior {
  generalBehavior: string;
  sociability: string;
  difficultyLevel: string;
  compatibilityWithChildren?: string;
  compatibilityWithOtherAnimals?: string;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface BreedHealth {
  diseases: Array<{ name: string; symptoms: string; prevention: string; whenToConsult: string }>;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface BreedLegislation {
  country: string;
  status: string;
  details: Record<string, unknown>;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface BreedReproduction {
  season?: string;
  gestationDays?: number | null;
  incubationDays?: number | null;
  litterSizeMin?: number | null;
  litterSizeMax?: number | null;
  sexualMaturityMonths?: number | null;
  breedingDifficulty?: string;
  notes?: string;
  sources?: Array<{ type: string; url: string; title: string }>;
}
interface Breed {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
  category: string;
  subcategory?: string;
  domesticationType: string;
  description?: string | null;
  sourceUrl?: string | null;
  feeding: BreedFeed;
  habitat: BreedHabitat;
  behavior: BreedBehavior;
  health: BreedHealth;
  legislation: BreedLegislation;
  reproduction: BreedReproduction;
  template: string;
}

const VALID_CATEGORIES = ['mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte', 'arachnide'];
const VALID_DOMESTICATION = ['domestique', 'semi-domestique', 'NAC'];

async function main() {
  const dataPath = path.resolve(__dirname, 'breeds-data.json');
  const breeds: Breed[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`📦 ${breeds.length} fiches à importer`);

  let ok = 0;
  const errors: string[] = [];
  for (const b of breeds) {
    try {
      if (!VALID_CATEGORIES.includes(b.category)) {
        errors.push(`[${b.speciesId}] ${b.commonNameFr}: catégorie invalide "${b.category}"`);
        continue;
      }
      if (!VALID_DOMESTICATION.includes(b.domesticationType)) {
        errors.push(`[${b.speciesId}] ${b.commonNameFr}: domesticationType invalide "${b.domesticationType}"`);
        continue;
      }
      if (!b.feeding?.recommendedFoods?.length || !b.feeding?.foodsToAvoid?.length) {
        errors.push(`[${b.speciesId}] ${b.commonNameFr}: feeding incomplet`);
        continue;
      }

      await prisma.speciesProfile.upsert({
        where: { speciesId: b.speciesId },
        update: {
          commonNameFr: b.commonNameFr,
          scientificName: b.scientificName,
          category: b.category,
          subcategory: b.subcategory,
          domesticationType: b.domesticationType,
          description: b.description,
          sourceUrl: b.sourceUrl,
        },
        create: {
          speciesId: b.speciesId,
          commonNameFr: b.commonNameFr,
          scientificName: b.scientificName,
          category: b.category,
          subcategory: b.subcategory,
          domesticationType: b.domesticationType,
          description: b.description,
          sourceUrl: b.sourceUrl,
        },
      });

      await prisma.speciesFeeding.upsert({
        where: { speciesId_locale: { speciesId: b.speciesId, locale: 'fr' } },
        update: {
          dietType: b.feeding.dietType,
          recommendedFoods: b.feeding.recommendedFoods as never,
          foodsToAvoid: b.feeding.foodsToAvoid as never,
          mealFrequency: b.feeding.mealFrequency,
          specificNeeds: b.feeding.specificNeeds,
          sources: (b.feeding.sources ?? []) as never,
        },
        create: {
          speciesId: b.speciesId,
          locale: 'fr',
          dietType: b.feeding.dietType,
          recommendedFoods: b.feeding.recommendedFoods as never,
          foodsToAvoid: b.feeding.foodsToAvoid as never,
          mealFrequency: b.feeding.mealFrequency,
          specificNeeds: b.feeding.specificNeeds,
          sources: (b.feeding.sources ?? []) as never,
        },
      });

      await prisma.speciesHabitat.upsert({
        where: { speciesId_locale: { speciesId: b.speciesId, locale: 'fr' } },
        update: {
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
          sources: (b.habitat.sources ?? []) as never,
        },
        create: {
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
          sources: (b.habitat.sources ?? []) as never,
        },
      });

      await prisma.speciesBehavior.upsert({
        where: { speciesId_locale: { speciesId: b.speciesId, locale: 'fr' } },
        update: {
          generalBehavior: b.behavior.generalBehavior,
          sociability: b.behavior.sociability,
          difficultyLevel: b.behavior.difficultyLevel,
          compatibilityWithChildren: b.behavior.compatibilityWithChildren,
          compatibilityWithOtherAnimals: b.behavior.compatibilityWithOtherAnimals,
          sources: (b.behavior.sources ?? []) as never,
        },
        create: {
          speciesId: b.speciesId,
          locale: 'fr',
          generalBehavior: b.behavior.generalBehavior,
          sociability: b.behavior.sociability,
          difficultyLevel: b.behavior.difficultyLevel,
          compatibilityWithChildren: b.behavior.compatibilityWithChildren,
          compatibilityWithOtherAnimals: b.behavior.compatibilityWithOtherAnimals,
          sources: (b.behavior.sources ?? []) as never,
        },
      });

      await prisma.speciesHealthContent.upsert({
        where: { speciesId_locale: { speciesId: b.speciesId, locale: 'fr' } },
        update: {
          diseases: b.health.diseases as never,
          sources: (b.health.sources ?? []) as never,
        },
        create: {
          speciesId: b.speciesId,
          locale: 'fr',
          diseases: b.health.diseases as never,
          sources: (b.health.sources ?? []) as never,
        },
      });

      await prisma.speciesLegislation.upsert({
        where: { speciesId_country: { speciesId: b.speciesId, country: b.legislation.country } },
        update: {
          status: b.legislation.status,
          details: b.legislation.details as never,
          sources: (b.legislation.sources ?? []).map((s) => s.url),
        },
        create: {
          speciesId: b.speciesId,
          country: b.legislation.country,
          status: b.legislation.status,
          details: b.legislation.details as never,
          sources: (b.legislation.sources ?? []).map((s) => s.url),
        },
      });

      await prisma.speciesReproduction.upsert({
        where: { speciesId_locale: { speciesId: b.speciesId, locale: 'fr' } },
        update: {
          season: b.reproduction.season,
          gestationDays: b.reproduction.gestationDays ?? null,
          incubationDays: b.reproduction.incubationDays ?? null,
          litterSizeMin: b.reproduction.litterSizeMin ?? null,
          litterSizeMax: b.reproduction.litterSizeMax ?? null,
          sexualMaturityMonths: b.reproduction.sexualMaturityMonths ?? null,
          breedingDifficulty: b.reproduction.breedingDifficulty,
          notes: b.reproduction.notes,
          sources: (b.reproduction.sources ?? []) as never,
        },
        create: {
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
          sources: (b.reproduction.sources ?? []) as never,
        },
      });

      ok++;
    } catch (e) {
      errors.push(`[${b.speciesId}] ${b.commonNameFr}: ${(e as Error).message}`);
    }
  }

  console.log(`✅ Importés: ${ok}/${breeds.length}`);
  if (errors.length) {
    console.log(`❌ Erreurs (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.log('  -', e);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
