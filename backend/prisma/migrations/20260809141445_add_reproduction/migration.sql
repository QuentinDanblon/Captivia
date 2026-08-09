-- CreateTable
CREATE TABLE "BreedingRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "partnerName" TEXT,
    "offspringCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BreedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesReproduction" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "season" TEXT,
    "gestationDays" INTEGER,
    "incubationDays" INTEGER,
    "litterSizeMin" INTEGER,
    "litterSizeMax" INTEGER,
    "sexualMaturityMonths" INTEGER,
    "breedingDifficulty" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesReproduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingRecord_animalId_idx" ON "BreedingRecord"("animalId");

-- CreateIndex
CREATE INDEX "BreedingRecord_animalId_date_idx" ON "BreedingRecord"("animalId", "date");

-- CreateIndex
CREATE INDEX "SpeciesReproduction_speciesId_idx" ON "SpeciesReproduction"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesReproduction_speciesId_locale_key" ON "SpeciesReproduction"("speciesId", "locale");

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Module B : CHECK constraints (Prisma ne supporte pas les CHECK — SQL manuel)
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_eventType_check" CHECK ("eventType" IN ('heat', 'mating', 'pregnancy', 'birth', 'weaning'));
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_offspringCount_check" CHECK ("offspringCount" IS NULL OR "offspringCount" >= 0);
ALTER TABLE "SpeciesReproduction" ADD CONSTRAINT "SpeciesReproduction_breedingDifficulty_check" CHECK ("breedingDifficulty" IS NULL OR "breedingDifficulty" IN ('facile', 'modere', 'avance'));
