-- AlterTable
ALTER TABLE "SpeciesBehavior" ADD COLUMN     "sources" JSONB;

-- AlterTable
ALTER TABLE "SpeciesFeeding" ADD COLUMN     "sources" JSONB;

-- AlterTable
ALTER TABLE "SpeciesHabitat" ADD COLUMN     "sources" JSONB;

-- AlterTable
ALTER TABLE "SpeciesProfile" ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "SpeciesReproduction" ADD COLUMN     "sources" JSONB;
