-- CreateTable
CREATE TABLE "SpeciesRoutineTemplate" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "frequency" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesRoutineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeciesRoutineTemplate_speciesId_idx" ON "SpeciesRoutineTemplate"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesRoutineTemplate_speciesId_type_order_key" ON "SpeciesRoutineTemplate"("speciesId", "type", "order");

-- Module D : CHECK constraints (Prisma ne supporte pas les CHECK — SQL manuel)
ALTER TABLE "SpeciesRoutineTemplate" ADD CONSTRAINT "SpeciesRoutineTemplate_type_check" CHECK ("type" IN ('nourrissage', 'entretien', 'uvb', 'controle'));
ALTER TABLE "SpeciesRoutineTemplate" ADD CONSTRAINT "SpeciesRoutineTemplate_frequency_check" CHECK ("frequency" IN ('daily', 'every_2_days', 'every_3_days', 'weekly', 'monthly', 'once', 'hourly', 'custom'));
