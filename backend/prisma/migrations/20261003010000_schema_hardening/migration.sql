-- W1-09 : durcissement du schéma (CHECK, clés étrangères, index trigram) + W5-04 : lastReviewedAt.
--
-- Cette migration ne doit JAMAIS échouer sur une base de production existante : chaque contrainte
-- est précédée d'un UPDATE / DELETE explicite qui normalise ou neutralise les lignes hors règle.
-- (Prisma ne sait pas représenter les CHECK : ils restent en SQL brut ; relations, index et
-- colonnes sont déclarés dans schema.prisma.)
--
-- Déjà en place, donc NON retouchés ici :
--  * CHECK "Medication_frequency_check" et "VetAppointment_status_check" (migration 20260809134420) ;
--  * unicité NotificationEvent : "NotificationEvent_userId_sourceKey_scheduledAt_key"
--    (migration 20261002110000, avec dédoublonnage préalable).

-- ============================================================================
-- 1. Extension trigram (index de recherche « contient »)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. CHECK sur les colonnes énumérées stockées en String
--    Valeurs déduites des DTO class-validator, des services et des données du seed.
-- ============================================================================

-- ---- Animal.sex : NULL | male | female | unknown (DTO : @IsIn(['male','female','unknown'])) ----
-- Hors liste : variantes reconnues (m, mâle, f, femelle, inconnu…) normalisées ; le reste passe à NULL
-- (« sexe non renseigné »), jamais à une valeur inventée.
UPDATE "Animal"
SET "sex" = CASE lower(btrim("sex"))
  WHEN 'male'    THEN 'male'
  WHEN 'm'       THEN 'male'
  WHEN 'mâle'    THEN 'male'
  WHEN 'female'  THEN 'female'
  WHEN 'f'       THEN 'female'
  WHEN 'femelle' THEN 'female'
  WHEN 'unknown' THEN 'unknown'
  WHEN 'inconnu' THEN 'unknown'
  ELSE NULL
END
WHERE "sex" IS NOT NULL AND "sex" NOT IN ('male', 'female', 'unknown');

ALTER TABLE "Animal" DROP CONSTRAINT IF EXISTS "Animal_sex_check";
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_sex_check"
  CHECK ("sex" IS NULL OR "sex" IN ('male', 'female', 'unknown'));

-- ---- AnimalHealthRecord.type : vaccine | surgery | specific_food | medical_history ----
-- Hors liste : variantes courantes normalisées ; le reste devient 'medical_history' (rubrique
-- générique du carnet ; le titre et les notes de la ligne sont conservés).
UPDATE "AnimalHealthRecord"
SET "type" = CASE lower(btrim("type"))
  WHEN 'vaccine'         THEN 'vaccine'
  WHEN 'vaccin'          THEN 'vaccine'
  WHEN 'vaccination'     THEN 'vaccine'
  WHEN 'surgery'         THEN 'surgery'
  WHEN 'chirurgie'       THEN 'surgery'
  WHEN 'operation'       THEN 'surgery'
  WHEN 'opération'       THEN 'surgery'
  WHEN 'specific_food'   THEN 'specific_food'
  WHEN 'food'            THEN 'specific_food'
  WHEN 'alimentation'    THEN 'specific_food'
  ELSE 'medical_history'
END
WHERE "type" NOT IN ('vaccine', 'surgery', 'specific_food', 'medical_history');

ALTER TABLE "AnimalHealthRecord" DROP CONSTRAINT IF EXISTS "AnimalHealthRecord_type_check";
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_type_check"
  CHECK ("type" IN ('vaccine', 'surgery', 'specific_food', 'medical_history'));

-- ---- SpeciesLegislation.status : allowed | prohibited | permit_required ----
-- Hors liste : variantes normalisées ; le reste devient 'permit_required' (position prudente :
-- « se renseigner auprès des autorités ») ET la fiche est marquée details.needsReview = true
-- pour relecture humaine.
UPDATE "SpeciesLegislation"
SET "details" = (
      CASE WHEN jsonb_typeof("details") = 'object' THEN "details" ELSE '{}'::jsonb END
    ) || '{"needsReview": true}'::jsonb,
    "status" = CASE lower(btrim("status"))
      WHEN 'allowed'         THEN 'allowed'
      WHEN 'autorise'        THEN 'allowed'
      WHEN 'autorisé'        THEN 'allowed'
      WHEN 'prohibited'      THEN 'prohibited'
      WHEN 'interdit'        THEN 'prohibited'
      WHEN 'permit_required' THEN 'permit_required'
      ELSE 'permit_required'
    END
WHERE "status" NOT IN ('allowed', 'prohibited', 'permit_required');

ALTER TABLE "SpeciesLegislation" DROP CONSTRAINT IF EXISTS "SpeciesLegislation_status_check";
ALTER TABLE "SpeciesLegislation" ADD CONSTRAINT "SpeciesLegislation_status_check"
  CHECK ("status" IN ('allowed', 'prohibited', 'permit_required'));

-- ---- SpeciesProfile.domesticationType : domestique | semi-domestique | NAC ----
-- Hors liste : casse normalisée ; le reste devient 'NAC' (valeur la plus neutre).
UPDATE "SpeciesProfile"
SET "domesticationType" = CASE lower(btrim("domesticationType"))
  WHEN 'domestique'      THEN 'domestique'
  WHEN 'semi-domestique' THEN 'semi-domestique'
  ELSE 'NAC'
END
WHERE "domesticationType" NOT IN ('domestique', 'semi-domestique', 'NAC');

ALTER TABLE "SpeciesProfile" DROP CONSTRAINT IF EXISTS "SpeciesProfile_domesticationType_check";
ALTER TABLE "SpeciesProfile" ADD CONSTRAINT "SpeciesProfile_domesticationType_check"
  CHECK ("domesticationType" IN ('domestique', 'semi-domestique', 'NAC'));

-- ---- SpeciesProfile.category : mammifère | reptile | amphibien | oiseau | poisson | insecte | arachnide ----
-- Hors liste : casse / accent normalisés. Aucune catégorie « neutre » n'existe : une valeur
-- inconnue n'est PAS réécrite au hasard. La contrainte est donc posée NOT VALID (appliquée à toute
-- nouvelle écriture), puis validée seulement si toutes les lignes existantes la respectent ;
-- sinon un WARNING est émis et la migration continue.
UPDATE "SpeciesProfile"
SET "category" = CASE lower(btrim("category"))
  WHEN 'mammifère' THEN 'mammifère'
  WHEN 'mammifere' THEN 'mammifère'
  WHEN 'reptile'   THEN 'reptile'
  WHEN 'amphibien' THEN 'amphibien'
  WHEN 'oiseau'    THEN 'oiseau'
  WHEN 'poisson'   THEN 'poisson'
  WHEN 'insecte'   THEN 'insecte'
  WHEN 'arachnide' THEN 'arachnide'
  ELSE "category"
END
WHERE "category" NOT IN ('mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte', 'arachnide');

ALTER TABLE "SpeciesProfile" DROP CONSTRAINT IF EXISTS "SpeciesProfile_category_check";
ALTER TABLE "SpeciesProfile" ADD CONSTRAINT "SpeciesProfile_category_check"
  CHECK ("category" IN ('mammifère', 'reptile', 'amphibien', 'oiseau', 'poisson', 'insecte', 'arachnide')) NOT VALID;
DO $$
BEGIN
  ALTER TABLE "SpeciesProfile" VALIDATE CONSTRAINT "SpeciesProfile_category_check";
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'SpeciesProfile_category_check laissée NOT VALID : des fiches ont une catégorie hors liste (à corriger à la main).';
END
$$;

-- ---- SpeciesHabitat.habitatType : cage | terrarium | aquarium | enclos | libre | aquaterrarium | volière ----
-- Hors liste : casse / accent normalisés ; le reste devient 'enclos' (type générique).
UPDATE "SpeciesHabitat"
SET "habitatType" = CASE lower(btrim("habitatType"))
  WHEN 'cage'          THEN 'cage'
  WHEN 'terrarium'     THEN 'terrarium'
  WHEN 'aquarium'      THEN 'aquarium'
  WHEN 'libre'         THEN 'libre'
  WHEN 'aquaterrarium' THEN 'aquaterrarium'
  WHEN 'volière'       THEN 'volière'
  WHEN 'voliere'       THEN 'volière'
  ELSE 'enclos'
END
WHERE "habitatType" NOT IN ('cage', 'terrarium', 'aquarium', 'enclos', 'libre', 'aquaterrarium', 'volière');

ALTER TABLE "SpeciesHabitat" DROP CONSTRAINT IF EXISTS "SpeciesHabitat_habitatType_check";
ALTER TABLE "SpeciesHabitat" ADD CONSTRAINT "SpeciesHabitat_habitatType_check"
  CHECK ("habitatType" IN ('cage', 'terrarium', 'aquarium', 'enclos', 'libre', 'aquaterrarium', 'volière'));

-- ---- SpeciesHabitat.costEstimate : faible | moyen | élevé ----
-- Hors liste : variantes normalisées ; le reste devient 'moyen' (valeur médiane).
UPDATE "SpeciesHabitat"
SET "costEstimate" = CASE lower(btrim("costEstimate"))
  WHEN 'faible' THEN 'faible'
  WHEN 'moyen'  THEN 'moyen'
  WHEN 'élevé'  THEN 'élevé'
  WHEN 'eleve'  THEN 'élevé'
  ELSE 'moyen'
END
WHERE "costEstimate" NOT IN ('faible', 'moyen', 'élevé');

ALTER TABLE "SpeciesHabitat" DROP CONSTRAINT IF EXISTS "SpeciesHabitat_costEstimate_check";
ALTER TABLE "SpeciesHabitat" ADD CONSTRAINT "SpeciesHabitat_costEstimate_check"
  CHECK ("costEstimate" IN ('faible', 'moyen', 'élevé'));

-- ---- SpeciesBehavior.sociability : solitaire | grégaire | semi-grégaire | semi-solitaire ----
-- Hors liste : variantes normalisées ; le reste devient 'semi-grégaire' (valeur médiane).
UPDATE "SpeciesBehavior"
SET "sociability" = CASE lower(btrim("sociability"))
  WHEN 'solitaire'      THEN 'solitaire'
  WHEN 'grégaire'       THEN 'grégaire'
  WHEN 'gregaire'       THEN 'grégaire'
  WHEN 'semi-solitaire' THEN 'semi-solitaire'
  WHEN 'semi-gregaire'  THEN 'semi-grégaire'
  ELSE 'semi-grégaire'
END
WHERE "sociability" NOT IN ('solitaire', 'grégaire', 'semi-grégaire', 'semi-solitaire');

ALTER TABLE "SpeciesBehavior" DROP CONSTRAINT IF EXISTS "SpeciesBehavior_sociability_check";
ALTER TABLE "SpeciesBehavior" ADD CONSTRAINT "SpeciesBehavior_sociability_check"
  CHECK ("sociability" IN ('solitaire', 'grégaire', 'semi-grégaire', 'semi-solitaire'));

-- ---- SpeciesBehavior.difficultyLevel : débutant | intermédiaire | expert ----
-- Hors liste : variantes normalisées ; le reste devient 'intermédiaire' (valeur médiane).
UPDATE "SpeciesBehavior"
SET "difficultyLevel" = CASE lower(btrim("difficultyLevel"))
  WHEN 'débutant'      THEN 'débutant'
  WHEN 'debutant'      THEN 'débutant'
  WHEN 'intermédiaire' THEN 'intermédiaire'
  WHEN 'intermediaire' THEN 'intermédiaire'
  WHEN 'expert'        THEN 'expert'
  ELSE 'intermédiaire'
END
WHERE "difficultyLevel" NOT IN ('débutant', 'intermédiaire', 'expert');

ALTER TABLE "SpeciesBehavior" DROP CONSTRAINT IF EXISTS "SpeciesBehavior_difficultyLevel_check";
ALTER TABLE "SpeciesBehavior" ADD CONSTRAINT "SpeciesBehavior_difficultyLevel_check"
  CHECK ("difficultyLevel" IN ('débutant', 'intermédiaire', 'expert'));

-- ---- RecommendedEquipment.size : NULL | small | medium | large ----
-- Hors liste : variantes normalisées ; le reste passe à NULL (taille non précisée).
UPDATE "RecommendedEquipment"
SET "size" = CASE lower(btrim("size"))
  WHEN 'small'  THEN 'small'
  WHEN 'medium' THEN 'medium'
  WHEN 'large'  THEN 'large'
  ELSE NULL
END
WHERE "size" IS NOT NULL AND "size" NOT IN ('small', 'medium', 'large');

ALTER TABLE "RecommendedEquipment" DROP CONSTRAINT IF EXISTS "RecommendedEquipment_size_check";
ALTER TABLE "RecommendedEquipment" ADD CONSTRAINT "RecommendedEquipment_size_check"
  CHECK ("size" IS NULL OR "size" IN ('small', 'medium', 'large'));

-- ---- PaymentEvent.outcome (journal des webhooks RevenueCat) ----
-- Valeurs : cf. RevenueCatWebhookService (applied, ignored_*) + 'duplicate'.
-- Hors liste : 'ignored_type' (événement sans effet sur les droits).
UPDATE "PaymentEvent"
SET "outcome" = 'ignored_type'
WHERE "outcome" NOT IN (
  'applied', 'duplicate', 'ignored_stale', 'ignored_unknown_user',
  'ignored_entitlement', 'ignored_store', 'ignored_type', 'ignored_invalid'
);

ALTER TABLE "PaymentEvent" DROP CONSTRAINT IF EXISTS "PaymentEvent_outcome_check";
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_outcome_check"
  CHECK ("outcome" IN (
    'applied', 'duplicate', 'ignored_stale', 'ignored_unknown_user',
    'ignored_entitlement', 'ignored_store', 'ignored_type', 'ignored_invalid'
  ));

-- Colonnes volontairement SANS CHECK : SpeciesFeeding.dietType / mealFrequency (vocabulaire libre
-- « herbivore, carnivore, … etc. », composés « granivore-frugivore », fréquences variées dans les
-- données éditoriales), SpeciesLegislation.country (code ISO ouvert ; l'unicité (speciesId, country)
-- rend risquée une normalisation en place), RecommendedEquipment.category (liste ouverte).

-- ============================================================================
-- 3. Clés étrangères Species*.speciesId -> SpeciesProfile.speciesId (ON DELETE CASCADE)
--    Le seed et les imports (seed-prod, breeds-bulk, import-breeds, import-enrichment,
--    import-fr-be-databases, complete-existing) créent toujours la fiche AVANT ses sections.
-- ============================================================================

-- Orphelins : sections dont la fiche n'existe pas (inatteignables par l'API) -> supprimées,
-- sinon l'ajout de la clé étrangère échouerait.
DELETE FROM "SpeciesFeeding" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesHabitat" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesBehavior" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesHealthContent" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesLegislation" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesReproduction" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");
DELETE FROM "SpeciesRoutineTemplate" t
WHERE NOT EXISTS (SELECT 1 FROM "SpeciesProfile" p WHERE p."speciesId" = t."speciesId");

-- AddForeignKey
ALTER TABLE "SpeciesRoutineTemplate" ADD CONSTRAINT "SpeciesRoutineTemplate_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesFeeding" ADD CONSTRAINT "SpeciesFeeding_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesHabitat" ADD CONSTRAINT "SpeciesHabitat_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesBehavior" ADD CONSTRAINT "SpeciesBehavior_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesHealthContent" ADD CONSTRAINT "SpeciesHealthContent_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesLegislation" ADD CONSTRAINT "SpeciesLegislation_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesReproduction" ADD CONSTRAINT "SpeciesReproduction_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 4. Index
-- ============================================================================

-- Recherche « contient » insensible à la casse (ILIKE '%x%') sur les fiches espèces.
CREATE INDEX "SpeciesProfile_commonNameFr_trgm_idx" ON "SpeciesProfile" USING GIN ("commonNameFr" gin_trgm_ops);
CREATE INDEX "SpeciesProfile_scientificName_trgm_idx" ON "SpeciesProfile" USING GIN ("scientificName" gin_trgm_ops);

-- Index btree redondant : l'index GIN "AffiliateStore_categories_gin_idx" couvre les requêtes `has` / `hasSome`.
DROP INDEX IF EXISTS "AffiliateStore_categories_idx";

-- ============================================================================
-- 5. W5-04 : date de dernière vérification éditoriale de la fiche (NULL = jamais vérifiée)
-- ============================================================================
ALTER TABLE "SpeciesProfile" ADD COLUMN "lastReviewedAt" TIMESTAMPTZ(3);
