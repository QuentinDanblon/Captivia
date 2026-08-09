-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "vaccinationId" TEXT;

-- CreateTable
CREATE TABLE "AnimalMeasurement" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AnimalMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "nextDueDate" TIMESTAMPTZ(3),
    "batchNumber" TEXT,
    "vetName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalMeasurement_animalId_idx" ON "AnimalMeasurement"("animalId");

-- CreateIndex
CREATE INDEX "AnimalMeasurement_animalId_measuredAt_idx" ON "AnimalMeasurement"("animalId", "measuredAt");

-- CreateIndex
CREATE INDEX "Vaccination_animalId_idx" ON "Vaccination"("animalId");

-- CreateIndex
CREATE INDEX "NotificationEvent_vaccinationId_idx" ON "NotificationEvent"("vaccinationId");

-- AddForeignKey
ALTER TABLE "AnimalMeasurement" ADD CONSTRAINT "AnimalMeasurement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_vaccinationId_fkey" FOREIGN KEY ("vaccinationId") REFERENCES "Vaccination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Module C : CHECK constraints (Prisma ne supporte pas les CHECK — SQL manuel)
ALTER TABLE "AnimalMeasurement" ADD CONSTRAINT "AnimalMeasurement_weightKg_check" CHECK ("weightKg" IS NULL OR "weightKg" >= 0);
ALTER TABLE "AnimalMeasurement" ADD CONSTRAINT "AnimalMeasurement_heightCm_check" CHECK ("heightCm" IS NULL OR "heightCm" >= 0);
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_name_length" CHECK (char_length("name") <= 100);
