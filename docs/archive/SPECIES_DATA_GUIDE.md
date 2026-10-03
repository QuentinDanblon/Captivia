// SPECIES DATA STRUCTURE & GENERATION GUIDE
// ==========================================

/**
 * CURRENT STATUS:
 * - Initial batch (species-data.ts): ~50 species
 * - Extended batch (extended-species-data.ts): ~30 species
 * - TOTAL SEEDED: ~80 species
 * - TARGET: 1000 species
 * - REMAINING: ~920 species to add
 * 
 * The framework is now in place to systematically add the remaining 920 species.
 * All data conforms to the Prisma schema defined in schema.prisma
 */

/**
 * DATA STRUCTURE REFERENCE
 * Each species requires:
 * 
 * 1. BASIC IDENTIFICATION (SpeciesProfile):
 *    - speciesId (Int): GBIF key identifier
 *    - commonNameFr (String): French name
 *    - scientificName (String): Scientific binomial name
 *    - category (String): One of [mammifère, reptile, amphibien, oiseau, poisson, insecte, arachnide]
 *    - subcategory (String, optional): Taxonomic grouping (e.g., "Félidé", "Serpent constricteur")
 *    - domesticationType (String): One of [domestique, semi-domestique, NAC]
 *    - description (String, optional): Short description max 500 chars
 * 
 * 2. FEEDING DATA (SpeciesFeeding):
 *    - dietType (String): herbivore, carnivore, omnivore, insectivore, graivor, frugivore
 *    - recommendedFoods (Array<{name, frequency, notes}>): Common foods
 *    - foodsToAvoid (Array<{name, reason}>): Toxic/harmful foods
 *    - mealFrequency (String): daily, continuous, every_5_7_days, every_7_10_days, weekly, biweekly, monthly
 *    - specificNeeds (String, optional): Special nutritional requirements
 * 
 * 3. HABITAT DATA (SpeciesHabitat):
 *    - habitatType (String): cage, terrarium, aquarium, enclos, libre, aquaterrarium
 *    - tempMin/tempMax (Float): Temperature range in Celsius
 *    - humidityMin/humidityMax (Float, optional): % relative humidity
 *    - minSpaceSize (String): Minimum space description
 *    - lightNeeds (String): Light requirements
 *    - activityEnrichment (String): Activity level and enrichment needs
 *    - hygieneNotes (String, optional): Cleaning and hygiene requirements
 *    - costEstimate (String): faible, moyen, élevé
 * 
 * 4. BEHAVIOR DATA (SpeciesBehavior):
 *    - generalBehavior (String): General description of behavior
 *    - sociability (String): solitaire, grégaire, semi-grégaire
 *    - difficultyLevel (String): débutant, intermédiaire, expert
 *    - compatibilityWithChildren (String, optional): Child compatibility
 *    - compatibilityWithOtherAnimals (String, optional): Cohabitation info
 */

/**
 * IMPLEMENTATION STEPS TO REACH 1000 SPECIES:
 * 
 * OPTION A: Manual Progressive Addition
 * - Add species in batches of 100 across new files
 * - Files: batch-2-species-data.ts, batch-3-species-data.ts, etc.
 * - Update seed.ts to import and process each batch
 * - Quality control: Every 100 species reviewed for accuracy
 * 
 * OPTION B: Semi-Automated Generation
 * - Create species-generator.ts with templates for each category
 * - Generate variants with real GBIF keys and varying parameters
 * - Validate before insertion into database
 * 
 * OPTION C: Import from External Source
 * - Use CSV/JSON bulk import from veterinary databases
 * - Map to Prisma schema
 * - Validate and seed
 * 
 * OPTION D: Hybrid Approach (RECOMMENDED)
 * - Cover critical popular species manually (500)
 * - Use templates for common variants (500)
 * - Result: 1000 well-balanced species
 *
 * IMPORT BASES FR/BE (fichiers TXT):
 * - Fichiers attendus dans le répertoire ANIMAL_DB_DIR (défaut: /Users/amaurybaptist/Desktop/OnBrain):
 *   BD_animaux_MAMMIFERES_FR_BE.txt, BD_animaux_OISEAUX_FR_BE.txt, BD_animaux_POISSONS_FR_BE.txt,
 *   BD_animaux_REPTILES_AMPHIBIENS_FR_BE.txt, BD_animaux_ARACHNIDES_FR_BE.txt,
 *   BD_animaux_INSECTES_INVERT_FR_BE.txt, BD_animaux_AUTRES_INVERT_FR_BE.txt
 * - Lancer l'import: npm run import:fr-be (depuis backend/)
 * - Ou: ANIMAL_DB_DIR=/autre/chemin npm run import:fr-be
 * - Les espèces sont résolues via l'API GBIF puis upsertées dans SpeciesProfile + SpeciesHealthContent (fr).
 */

/**
 * VALIDATION RULES IMPLEMENTED:
 * - validateSpeciesProfile: Ensures required fields, valid category/domesticationType
 * - validateSpeciesFeeding: Checks diet type, arrays properly formed
 * - validateSpeciesHabitat: Verifies temperature ranges, cost estimate valid
 * - validateSpeciesBehavior: Validates sociability, difficulty, child compatibility
 * 
 * All validators log warnings for invalid entries and skip them.
 */

/**
 * DATABASE CONSTRAINTS:
 * - speciesId: UNIQUE (no duplicates)
 * - speciesId_locale: UNIQUE per SpeciesFeeding/Habitat/Behavior
 *   (allows multi-language future expansion)
 * - All JSON fields stored as JSONB in PostgreSQL for flexibility
 * 
 * Relationships: SpeciesProfile is the hub connecting to:
 *   - SpeciesFeeding (locale-aware)
 *   - SpeciesHabitat (locale-aware)
 *   - SpeciesBehavior (locale-aware)
 *   - SpeciesHealthContent (existing, locale-aware)
 *   - SpeciesLegislation (existing, country-aware)
 *   - RecommendedEquipment (existing, species-specific)
 */

/**
 * NEXT STEPS FOR 1000 SPECIES:
 * 
 * 1. ADD MORE SPECIES DATA FILES:
 *    - Create batch-2.ts through batch-10.ts progressively
 *    - Each file targets ~100 species in a category or region
 *    - Examples: 
 *      * batch-2: Small mammals (hamsters, gerbils, rabbits, etc.)
 *      * batch-3: More reptiles (more snakes, turtles, etc.)
 *      * batch-4: Additional fish species
 *      * batch-5: More birds
 *      * batch-6: More insects/arachnids
 *      * etc.
 * 
 * 2. UPDATE seed.ts:
 *    - Add imports for each new batch file
 *    - Combine all batches into single allSpecies array
 *    - Running seed will process all species
 * 
 * 3. QUALITY ASSURANCE:
 *    - Verify GBIF keys are valid (for API compatibility)
 *    - Ensure no duplicate species IDs
 *    - Check temperature ranges for biological accuracy
 *    - Review food lists for correctness
 *    - Validate French names against taxonomy databases
 * 
 * 4. TESTING:
 *    - Run: npm run seed
 *    - Verify counts in database
 *    - Spot-check via API endpoints
 *    - Test search functionality with new data
 * 
 * 5. OPTIMIZATION:
 *    - Once at 1000+, consider indexing by category/difficulty
 *    - Pre-compute search metrics
 *    - Cache popular species queries
 */

/**
 * KNOWN GAPS TO FILL:
 * More dog/cat breeds (subspecies/varieties)
 * More fish species (Oscar, Discus, Tetra variants)
 * More reptile species (various pythons, geckos, bearded dragons, etc.)
 * More bird species (cockatiels, lovebirds, budgies, finches)
 * More insect species (beetles, stick insects, crickets)
 * Farm animals (cattle, pigs, sheep, goats variants)
 * Exotic mammals (lemurs, sugar gliders, hedgehogs, etc.)
 * Amphibian variants
 */

export const STRUCTURE_GUIDE = {
  status: 'FRAMEWORK COMPLETE - DATA PROGRESSIVE',
  speciesSeeded: 80,
  targetSpecies: 1000,
  remainingSpecies: 920,
  lastUpdated: new Date().toISOString(),
  nextPhase: 'Add batch-2-species-data.ts (100 species)',
};
