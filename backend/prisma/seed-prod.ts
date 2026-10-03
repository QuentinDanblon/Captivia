import { Prisma, PrismaClient } from '@prisma/client';
import { importBreedsBulk } from './breeds-bulk';
import { importEnrichment } from './import-enrichment';

// ============================================
// SEED PROD — Données éditoriales uniquement
// ============================================
// Ce seed est SÛR pour la production :
//  - Aucun compte utilisateur, aucun animal, aucune routine, aucune préférence créés.
//  - Idempotent : uniquement des upserts (findUnique/create/update) par ID explicite
//    ou par clé naturelle (speciesId, locale) / (speciesId, country) / (speciesId, type, order).
//  - SpeciesRoutineTemplate (Module D) : générés par catégorie depuis SpeciesProfile.
//  - Aucun deleteMany : rien n'est jamais détruit.
//  - Exécutable autant de fois que nécessaire (`npx prisma db seed`).
//
// Pour les fixtures de démo (user test, Rango, routine), voir seed-dev.ts.

const prisma = new PrismaClient();

// Exporté pour permettre aux seed-dev/seed (wrappers) de fermer le client
// après avoir appelé main().
export { prisma };

// GBIF species IDs
const SPECIES_IDS = {
  BOA_CONSTRICTOR: 2448340,
  IGUANA_IGUANA: 5220648,
  GECKO_LEOPARD: 5221172, // Eublepharis macularius
  TORTUE: 551789, // Trachemys scripta
  PYTHON_ROYAL: 7587934, // Python regius
};

// ============================================
// Validation helpers
// ============================================

interface SpeciesProfileData {
  speciesId: number;
  commonNameFr: string;
  scientificName: string;
  category: string;
  subcategory?: string;
  domesticationType: string;
  description?: string;
  /** URL de la page Wikipedia FR d'où provient la description (traçabilité).
   *  Présente dans les fichiers de données ; non persistée (pas de colonne en base). */
  sourceUrl?: string;
}

interface SpeciesFeedingData {
  speciesId: number;
  locale?: string;
  dietType: string;
  recommendedFoods: Array<{ name: string; frequency: string; notes?: string }>;
  foodsToAvoid: Array<{ name: string; reason: string }>;
  mealFrequency: string;
  specificNeeds?: string;
}

interface SpeciesHabitatData {
  speciesId: number;
  locale?: string;
  habitatType: string;
  tempMin: number;
  tempMax: number;
  humidityMin?: number;
  humidityMax?: number;
  minSpaceSize: string;
  lightNeeds: string;
  activityEnrichment: string;
  hygieneNotes?: string;
  costEstimate: string;
}

interface SpeciesBehaviorData {
  speciesId: number;
  locale?: string;
  generalBehavior: string;
  sociability: string;
  difficultyLevel: string;
  compatibilityWithChildren?: string;
  compatibilityWithOtherAnimals?: string;
}

function validateSpeciesProfile(data: SpeciesProfileData): boolean {
  if (!data.speciesId || !data.commonNameFr || !data.scientificName || !data.category || !data.domesticationType) {
    console.warn(`⚠️ Invalid SpeciesProfile: missing required fields for species ${data.speciesId}`);
    return false;
  }
  const validCategories = ['mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte', 'arachnide'];
  if (!validCategories.includes(data.category)) {
    console.warn(`⚠️ Invalid category for species ${data.speciesId}: ${data.category}`);
    return false;
  }
  const validDomestication = ['domestique', 'semi-domestique', 'NAC'];
  if (!validDomestication.includes(data.domesticationType)) {
    console.warn(`⚠️ Invalid domesticationType for species ${data.speciesId}: ${data.domesticationType}`);
    return false;
  }
  return true;
}

function validateSpeciesFeeding(data: SpeciesFeedingData): boolean {
  if (!data.speciesId || !data.dietType || !data.mealFrequency || !Array.isArray(data.recommendedFoods) || !Array.isArray(data.foodsToAvoid)) {
    console.warn(`⚠️ Invalid SpeciesFeeding: missing required fields for species ${data.speciesId}`);
    return false;
  }
  return true;
}

function validateSpeciesHabitat(data: SpeciesHabitatData): boolean {
  if (!data.speciesId || !data.habitatType || data.tempMin === undefined || data.tempMax === undefined || !data.minSpaceSize || !data.lightNeeds || !data.activityEnrichment || !data.costEstimate) {
    console.warn(`⚠️ Invalid SpeciesHabitat: missing required fields for species ${data.speciesId}`);
    return false;
  }
  const validCosts = ['faible', 'moyen', 'élevé'];
  if (!validCosts.includes(data.costEstimate)) {
    console.warn(`⚠️ Invalid costEstimate for species ${data.speciesId}: ${data.costEstimate}`);
    return false;
  }
  return true;
}

function validateSpeciesBehavior(data: SpeciesBehaviorData): boolean {
  if (!data.speciesId || !data.generalBehavior || !data.sociability || !data.difficultyLevel) {
    console.warn(`⚠️ Invalid SpeciesBehavior: missing required fields for species ${data.speciesId}`);
    return false;
  }
  const validSociability = ['solitaire', 'grégaire', 'semi-grégaire'];
  if (!validSociability.includes(data.sociability)) {
    console.warn(`⚠️ Invalid sociability for species ${data.speciesId}: ${data.sociability}`);
    return false;
  }
  const validDifficulty = ['débutant', 'intermédiaire', 'expert'];
  if (!validDifficulty.includes(data.difficultyLevel)) {
    console.warn(`⚠️ Invalid difficultyLevel for species ${data.speciesId}: ${data.difficultyLevel}`);
    return false;
  }
  return true;
}

export async function main() {
  console.log('🌱 Starting PROD seed (editorial data only)...');

  // ============================================
  // 0. SpeciesProfile + Related data
  // ============================================
  console.log('📋 Seeding SpeciesProfiles and related data...');

  const { SPECIES_DATABASE } = await import('./species-data');
  const { EXTENDED_SPECIES_DATABASE } = await import('./extended-species-data');
  const { BATCH2_SPECIES_DATABASE } = await import('./batch-2-species-data');

  const allSpecies = [...SPECIES_DATABASE, ...EXTENDED_SPECIES_DATABASE, ...BATCH2_SPECIES_DATABASE];
  let feedingCount = 0;
  let habitatCount = 0;
  let behaviorCount = 0;
  let profileCount = 0;

  for (const species of allSpecies) {
    // Validate with proper speciesId check
    const feedingData: SpeciesFeedingData = {
      speciesId: species.speciesId,
      dietType: species.feeding!.dietType as string,
      recommendedFoods: (species.feeding!.recommendedFoods as Array<{ name: string; frequency: string; notes?: string }>),
      foodsToAvoid: species.feeding!.foodsToAvoid as Array<{ name: string; reason: string }>,
      mealFrequency: species.feeding!.mealFrequency as string,
      specificNeeds: species.feeding!.specificNeeds as string | undefined,
    };
    const habitatData: SpeciesHabitatData = {
      speciesId: species.speciesId,
      habitatType: species.habitat!.habitatType as string,
      tempMin: species.habitat!.tempMin,
      tempMax: species.habitat!.tempMax,
      humidityMin: species.habitat!.humidityMin,
      humidityMax: species.habitat!.humidityMax,
      minSpaceSize: species.habitat!.minSpaceSize as string,
      lightNeeds: species.habitat!.lightNeeds as string,
      activityEnrichment: species.habitat!.activityEnrichment as string,
      hygieneNotes: species.habitat!.hygieneNotes as string | undefined,
      costEstimate: species.habitat!.costEstimate as string,
    };
    const behaviorData: SpeciesBehaviorData = {
      speciesId: species.speciesId,
      generalBehavior: species.behavior!.generalBehavior as string,
      sociability: species.behavior!.sociability as string,
      difficultyLevel: species.behavior!.difficultyLevel as string,
      compatibilityWithChildren: species.behavior!.compatibilityWithChildren as string | undefined,
      compatibilityWithOtherAnimals: species.behavior!.compatibilityWithOtherAnimals as string | undefined,
    };

    if (!validateSpeciesProfile(species)) continue;
    if (!validateSpeciesFeeding(feedingData)) continue;
    if (!validateSpeciesHabitat(habitatData)) continue;
    if (!validateSpeciesBehavior(behaviorData)) continue;

    // Upsert SpeciesProfile (idempotent, par speciesId)
    try {
      await (prisma as any).speciesProfile.upsert({
        where: { speciesId: species.speciesId },
        update: {
          commonNameFr: species.commonNameFr,
          scientificName: species.scientificName,
          category: species.category,
          subcategory: species.subcategory,
          domesticationType: species.domesticationType,
          description: species.description,
        },
        create: {
          speciesId: species.speciesId,
          commonNameFr: species.commonNameFr,
          scientificName: species.scientificName,
          category: species.category,
          subcategory: species.subcategory,
          domesticationType: species.domesticationType,
          description: species.description,
        },
      });
      profileCount++;

      // Upsert SpeciesFeeding (par (speciesId, locale))
      await (prisma as any).speciesFeeding.upsert({
        where: {
          speciesId_locale: {
            speciesId: species.speciesId,
            locale: 'fr',
          },
        },
        update: {
          dietType: feedingData.dietType,
          recommendedFoods: feedingData.recommendedFoods,
          foodsToAvoid: feedingData.foodsToAvoid,
          mealFrequency: feedingData.mealFrequency,
          specificNeeds: feedingData.specificNeeds,
        },
        create: {
          speciesId: species.speciesId,
          locale: 'fr',
          dietType: feedingData.dietType,
          recommendedFoods: feedingData.recommendedFoods,
          foodsToAvoid: feedingData.foodsToAvoid,
          mealFrequency: feedingData.mealFrequency,
          specificNeeds: feedingData.specificNeeds,
        },
      });
      feedingCount++;

      // Upsert SpeciesHabitat (par (speciesId, locale))
      await (prisma as any).speciesHabitat.upsert({
        where: {
          speciesId_locale: {
            speciesId: species.speciesId,
            locale: 'fr',
          },
        },
        update: habitatData,
        create: {
          speciesId: species.speciesId,
          locale: 'fr',
          habitatType: habitatData.habitatType,
          tempMin: habitatData.tempMin,
          tempMax: habitatData.tempMax,
          humidityMin: habitatData.humidityMin,
          humidityMax: habitatData.humidityMax,
          minSpaceSize: habitatData.minSpaceSize,
          lightNeeds: habitatData.lightNeeds,
          activityEnrichment: habitatData.activityEnrichment,
          hygieneNotes: habitatData.hygieneNotes,
          costEstimate: habitatData.costEstimate,
        },
      });
      habitatCount++;

      // Upsert SpeciesBehavior (par (speciesId, locale))
      await (prisma as any).speciesBehavior.upsert({
        where: {
          speciesId_locale: {
            speciesId: species.speciesId,
            locale: 'fr',
          },
        },
        update: behaviorData,
        create: {
          speciesId: species.speciesId,
          locale: 'fr',
          generalBehavior: behaviorData.generalBehavior,
          sociability: behaviorData.sociability,
          difficultyLevel: behaviorData.difficultyLevel,
          compatibilityWithChildren: behaviorData.compatibilityWithChildren,
          compatibilityWithOtherAnimals: behaviorData.compatibilityWithOtherAnimals,
        },
      });
      behaviorCount++;

      // SpeciesHealthContent (from species.health in file) — upsert par (speciesId, locale)
      const health = (species as { health?: { locale: string; diseases: unknown[]; sources: unknown[] } }).health;
      if (health) {
        await (prisma as any).speciesHealthContent.upsert({
          where: {
            speciesId_locale: { speciesId: species.speciesId, locale: health.locale || 'fr' },
          },
          update: { diseases: health.diseases, sources: health.sources },
          create: {
            speciesId: species.speciesId,
            locale: health.locale || 'fr',
            diseases: health.diseases,
            sources: health.sources,
          },
        });
      }

      // SpeciesLegislation (from species.legislation in file) — upsert par (speciesId, country)
      const legislationList = (species as { legislation?: Array<{ country: string; status: string; details: object; sources: string[] }> }).legislation;
      if (legislationList && Array.isArray(legislationList)) {
        for (const leg of legislationList) {
          await (prisma as any).speciesLegislation.upsert({
            where: {
              speciesId_country: { speciesId: species.speciesId, country: leg.country },
            },
            update: { status: leg.status, details: leg.details, sources: leg.sources },
            create: {
              speciesId: species.speciesId,
              country: leg.country,
              status: leg.status,
              details: leg.details,
              sources: leg.sources,
            },
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error seeding species ${species.speciesId} (${species.commonNameFr}):`, error);
    }
  }

  console.log(`✅ Seeded ${profileCount} species profiles`);
  console.log(`✅ Seeded ${feedingCount} feeding records`);
  console.log(`✅ Seeded ${habitatCount} habitat records`);
  console.log(`✅ Seeded ${behaviorCount} behavior records`);

  // ============================================
  // 0a-bis. SpeciesProfile — batch massif (pipeline sourcé GBIF + Wikipedia)
  // ============================================
  // MASSIVE_SPECIES_DATABASE (species-massive-data.ts) : profils générés par
  // scripts/enrich-species.ts — speciesId = nubKey GBIF résolue via l'API GBIF,
  // description = extract Wikipedia FR (sourceUrl = page source, traçabilité).
  // Profils uniquement : feeding/habitat/behavior ne sont pas encore sourcés
  // pour ces espèces (les champs absents restent absents, comme pour le reste
  // du seed). Les SpeciesRoutineTemplates sont générés plus bas, par catégorie,
  // pour TOUTES les espèces en base (y compris celles-ci).
  console.log('🌱 Seeding massive species profiles (source: GBIF + Wikipedia)...');

  const { MASSIVE_SPECIES_DATABASE } = await import('./species-massive-data');
  let massiveProfileCount = 0;
  for (const species of MASSIVE_SPECIES_DATABASE) {
    if (!validateSpeciesProfile(species)) continue;
    try {
      await (prisma as any).speciesProfile.upsert({
        where: { speciesId: species.speciesId },
        update: {
          commonNameFr: species.commonNameFr,
          scientificName: species.scientificName,
          category: species.category,
          subcategory: species.subcategory,
          domesticationType: species.domesticationType,
          description: species.description,
        },
        create: {
          speciesId: species.speciesId,
          commonNameFr: species.commonNameFr,
          scientificName: species.scientificName,
          category: species.category,
          subcategory: species.subcategory,
          domesticationType: species.domesticationType,
          description: species.description,
        },
      });
      massiveProfileCount++;
    } catch (error) {
      console.error(`❌ Error seeding massive species ${species.speciesId} (${species.commonNameFr}):`, error);
    }
  }
  console.log(`✅ Seeded ${massiveProfileCount} massive species profiles`);

  // ============================================
  // 0b. SpeciesRoutineTemplate (Module D) — générés par catégorie
  // ============================================
  // La catégorie est lue depuis SpeciesProfile (en base) : une espèce sans
  // profil n'a pas de modèles, une catégorie inconnue reçoit le défaut
  // (nourrissage quotidien). Upsert idempotent par (speciesId, type, order).
  console.log('🗓️ Seeding SpeciesRoutineTemplates (par catégorie)...');

  const { getRoutineTemplatesForCategory } = await import('./species-routine-templates');

  const speciesProfiles = await prisma.speciesProfile.findMany({
    select: { speciesId: true, category: true },
  });

  // Existant en base : on n'upsert que les modèles absents ou modifiés
  // (évite ~5 000 allers-retours inutiles à chaque relance du seed).
  const existingTemplates = await prisma.speciesRoutineTemplate.findMany();
  const existingByKey = new Map(existingTemplates.map((t) => [`${t.speciesId}|${t.type}|${t.order}`, t]));

  let routineTemplateCount = 0;
  for (const profile of speciesProfiles) {
    const templates = getRoutineTemplatesForCategory(profile.category);
    for (const tpl of templates) {
      routineTemplateCount++;
      const current = existingByKey.get(`${profile.speciesId}|${tpl.type}|${tpl.order}`);
      if (
        current &&
        current.active &&
        current.name === (tpl.name ?? null) &&
        current.frequency === tpl.frequency &&
        JSON.stringify(current.schedule) === JSON.stringify(tpl.schedule)
      ) {
        continue;
      }
      await prisma.speciesRoutineTemplate.upsert({
        where: {
          speciesId_type_order: {
            speciesId: profile.speciesId,
            type: tpl.type,
            order: tpl.order,
          },
        },
        update: {
          name: tpl.name,
          frequency: tpl.frequency,
          schedule: tpl.schedule,
          active: true,
        },
        create: {
          speciesId: profile.speciesId,
          type: tpl.type,
          name: tpl.name,
          frequency: tpl.frequency,
          schedule: tpl.schedule,
          order: tpl.order,
          active: true,
        },
      });
    }
  }
  console.log(`✅ Seeded ${routineTemplateCount} species routine templates (${speciesProfiles.length} espèces)`);

  // ============================================
  // 1. RecommendedEquipment (Prioritaire)
  // ============================================
  console.log('📦 Seeding RecommendedEquipment...');

  // General recommendations (speciesId: null)
  const generalEquipment = [
    {
      speciesId: null,
      category: 'thermostat',
      label: 'Thermostat digital',
      size: null,
      searchTerms: ['thermostat reptile', 'thermostat terrarium digital'],
      order: 0,
    },
    {
      speciesId: null,
      category: 'thermometre',
      label: 'Thermomètre hygromètre digital',
      size: null,
      searchTerms: ['thermomètre reptile', 'hygromètre terrarium'],
      order: 1,
    },
    {
      speciesId: null,
      category: 'pulverisateur',
      label: 'Pulvérisateur brumisateur',
      size: null,
      searchTerms: ['pulvérisateur terrarium', 'brumisateur reptile'],
      order: 2,
    },
    {
      speciesId: null,
      category: 'pince',
      label: 'Pince de nourrissage inox',
      size: null,
      searchTerms: ['pince nourrissage reptile', 'pince terrarium'],
      order: 3,
    },
    {
      speciesId: null,
      category: 'desinfectant',
      label: 'Désinfectant terrarium',
      size: null,
      searchTerms: ['désinfectant terrarium', 'nettoyant reptile'],
      order: 4,
    },
  ];

  // Boa constrictor equipment
  const boaEquipment = [
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'cage',
      label: 'Terrarium 150x60x60cm',
      size: 'large',
      searchTerms: ['terrarium boa', 'terrarium 150cm', 'terrarium grand serpent'],
      order: 0,
    },
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'chauffage',
      label: 'Tapis chauffant 45W',
      size: 'large',
      searchTerms: ['tapis chauffant reptile', 'tapis chauffant terrarium 45w'],
      order: 1,
    },
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'chauffage',
      label: 'Lampe céramique 100W',
      size: 'large',
      searchTerms: ['lampe céramique reptile', 'chauffage céramique 100w'],
      order: 2,
    },
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'substrat',
      label: 'Copeaux de coco',
      size: null,
      searchTerms: ['substrat coco reptile', 'copeaux coco terrarium'],
      order: 3,
    },
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'cachette',
      label: 'Cachette grande taille',
      size: 'large',
      searchTerms: ['cachette serpent', 'cachette terrarium grande'],
      order: 4,
    },
    {
      speciesId: SPECIES_IDS.BOA_CONSTRICTOR,
      category: 'gamelle',
      label: 'Gamelle eau grand format',
      size: 'large',
      searchTerms: ['gamelle serpent', 'gamelle eau terrarium grande'],
      order: 5,
    },
  ];

  // Gecko leopard equipment
  const geckoEquipment = [
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'cage',
      label: 'Terrarium 60x45x30cm',
      size: 'medium',
      searchTerms: ['terrarium gecko', 'terrarium 60cm', 'terrarium gecko leopard'],
      order: 0,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'chauffage',
      label: 'Tapis chauffant 14W',
      size: 'small',
      searchTerms: ['tapis chauffant gecko', 'tapis chauffant 14w'],
      order: 1,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'substrat',
      label: 'Sable excavator ou papier absorbant',
      size: null,
      searchTerms: ['substrat gecko leopard', 'sable excavator'],
      order: 2,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'cachette',
      label: 'Cachette humide (mue)',
      size: 'small',
      searchTerms: ['cachette humide gecko', 'boîte mue reptile'],
      order: 3,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'cachette',
      label: 'Cachette sèche zone froide',
      size: 'small',
      searchTerms: ['cachette gecko', 'cachette terrarium petite'],
      order: 4,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'gamelle',
      label: 'Gamelle eau petite',
      size: 'small',
      searchTerms: ['gamelle gecko', 'gamelle eau petite reptile'],
      order: 5,
    },
    {
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      category: 'alimentation',
      label: 'Calcium + D3',
      size: null,
      searchTerms: ['calcium gecko', 'supplément calcium reptile D3'],
      order: 6,
    },
  ];

  // Iguana equipment
  const iguanaEquipment = [
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'cage',
      label: 'Terrarium 200x100x150cm',
      size: 'large',
      searchTerms: ['terrarium iguane', 'terrarium grand arboricole'],
      order: 0,
    },
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'uvb',
      label: 'Lampe UVB 10.0 T5',
      size: 'large',
      searchTerms: ['lampe uvb 10.0', 'tube uvb reptile T5'],
      order: 1,
    },
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'chauffage',
      label: 'Spot chauffant 150W',
      size: 'large',
      searchTerms: ['spot chauffant reptile', 'lampe chauffante 150w'],
      order: 2,
    },
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'substrat',
      label: 'Écorces de coco',
      size: null,
      searchTerms: ['substrat écorce coco', 'substrat iguane'],
      order: 3,
    },
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'branche',
      label: 'Branches grimpoir',
      size: 'large',
      searchTerms: ['branches terrarium', 'grimpoir reptile'],
      order: 4,
    },
    {
      speciesId: SPECIES_IDS.IGUANA_IGUANA,
      category: 'gamelle',
      label: 'Gamelle eau grande',
      size: 'large',
      searchTerms: ['gamelle iguane', 'gamelle eau grande reptile'],
      order: 5,
    },
  ];

  // Tortue equipment
  const tortueEquipment = [
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'cage',
      label: 'Aquaterrarium 120x60x60cm',
      size: 'large',
      searchTerms: ['aquaterrarium tortue', 'bassin tortue aquatique'],
      order: 0,
    },
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'filtration',
      label: 'Filtre externe 1200 l/h',
      size: 'large',
      searchTerms: ['filtre tortue', 'filtre aquaterrarium'],
      order: 1,
    },
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'chauffage',
      label: 'Chauffage 300W submersible',
      size: 'large',
      searchTerms: ['chauffage aquaterrarium', 'thermostat aquatique'],
      order: 2,
    },
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'uvb',
      label: 'Lampe UVB 10.0 T8',
      size: 'large',
      searchTerms: ['lampe uvb tortue', 'tube uvb aquatique'],
      order: 3,
    },
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'substrat',
      label: 'Sable pour fond aquatique',
      size: null,
      searchTerms: ['sable tortue', 'substrat aquatique'],
      order: 4,
    },
    {
      speciesId: SPECIES_IDS.TORTUE,
      category: 'cachette',
      label: 'Roche ou plateforme flottante',
      size: 'large',
      searchTerms: ['plateforme tortue', 'roche aquaterrarium'],
      order: 5,
    },
  ];

  // Python royal equipment
  const pythonRoyalEquipment = [
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'cage',
      label: 'Terrarium 120x60x60cm',
      size: 'medium',
      searchTerms: ['terrarium python royal', 'terrarium serpent moyen'],
      order: 0,
    },
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'chauffage',
      label: 'Tapis chauffant 45W avec thermostat',
      size: 'medium',
      searchTerms: ['tapis chauffant python', 'thermostat serpent'],
      order: 1,
    },
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'cachette',
      label: 'Cachette tempérée',
      size: 'medium',
      searchTerms: ['cachette python', 'cachette terrarium moyen'],
      order: 2,
    },
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'substrat',
      label: 'Copeaux de coco ou aspen',
      size: null,
      searchTerms: ['substrat python', 'copeaux terrarium'],
      order: 3,
    },
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'gamelle',
      label: 'Gamelle eau terrarium',
      size: 'medium',
      searchTerms: ['gamelle serpent', 'gamelle terrarium'],
      order: 4,
    },
    {
      speciesId: SPECIES_IDS.PYTHON_ROYAL,
      category: 'pince',
      label: 'Pince de nourrissage',
      size: null,
      searchTerms: ['pince python', 'pince nourrissage'],
      order: 5,
    },
  ];

  const allEquipment = [
    ...generalEquipment,
    ...boaEquipment,
    ...geckoEquipment,
    ...iguanaEquipment,
    ...tortueEquipment,
    ...pythonRoyalEquipment,
  ];

  for (const eq of allEquipment) {
    await prisma.recommendedEquipment.upsert({
      where: {
        id: `${eq.speciesId || 'general'}-${eq.category}-${eq.order}`,
      },
      update: eq,
      create: {
        id: `${eq.speciesId || 'general'}-${eq.category}-${eq.order}`,
        ...eq,
      },
    });
  }

  console.log(`✅ Created ${allEquipment.length} equipment recommendations`);

  // ============================================
  // Magasins / liens d'affiliation (NAC FR/BE)
  // ============================================
  // Pas de deleteMany ici : upsert par nom → idempotent, ne détruit jamais
  // les magasins existants (même ceux ajoutés manuellement).
  console.log('🏪 Seeding AffiliateStores (upsert, idempotent)...');

  // Vrais magasins partenaires à ajouter ici (aucune URL factice en production).
  const affiliateStores: Prisma.AffiliateStoreCreateInput[] = [];

  for (const store of affiliateStores) {
    const existing = await prisma.affiliateStore.findFirst({ where: { name: store.name } });
    if (existing) {
      await prisma.affiliateStore.update({
        where: { id: existing.id },
        data: store,
      });
    } else {
      await prisma.affiliateStore.create({ data: store });
    }
  }

  console.log(`✅ Upserted ${affiliateStores.length} affiliate stores (magasins)`);

  // ============================================
  // Races (breeds-data.json) — W5-01
  // ============================================
  // createMany skipDuplicates par lots : idempotent, n'écrase aucune fiche existante.
  console.log('🐕 Seeding breeds (breeds-data.json, createMany skipDuplicates)...');
  const breeds = await importBreedsBulk(prisma);
  console.log(`✅ Breeds: ${breeds.valid}/${breeds.total} valides, ${breeds.profilesCreated} nouveaux profils`);
  if (breeds.errors.length) {
    for (const e of breeds.errors.slice(0, 20)) console.error('  ❌', e);
    throw new Error(`Import des races : ${breeds.errors.length} fiche(s) invalide(s)`);
  }

  // ============================================
  // Enrichissement éditorial (prisma/enrichment/out/*.json) — W5-02
  // ============================================
  // Ne crée que les sections manquantes, validées et sourcées (jamais d'écrasement).
  console.log('📚 Seeding enrichment (sections manquantes sourcées)...');
  const enrichment = await importEnrichment(prisma);
  console.log(`✅ Enrichment: ${enrichment.files} lots, ${enrichment.entries} fiches, ${enrichment.reviewed} datées (lastReviewedAt),`, enrichment.created);
  if (enrichment.skipped.length) {
    console.log(`  ⚠️  ${enrichment.skipped.length} section(s) ignorée(s) (invalides ou non sourcées)`);
  }

  console.log('\n🎉 PROD seed completed successfully!');
}

// Exécution directe : `npx prisma db seed` ou `npm run seed:prod`.
// (Quand seed-dev.ts importe main(), ce bloc est ignoré.)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed prod failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
