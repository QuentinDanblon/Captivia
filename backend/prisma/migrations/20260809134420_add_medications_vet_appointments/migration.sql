-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "medicationId" TEXT;

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "unit" TEXT,
    "frequency" TEXT NOT NULL,
    "intervalHours" INTEGER,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "endDate" TIMESTAMPTZ(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VetAppointment" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "vetName" TEXT NOT NULL,
    "reason" TEXT,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reminderDays" INTEGER[] DEFAULT ARRAY[7, 1]::INTEGER[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VetAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Medication_animalId_idx" ON "Medication"("animalId");

-- CreateIndex
CREATE INDEX "Medication_animalId_active_idx" ON "Medication"("animalId", "active");

-- CreateIndex
CREATE INDEX "VetAppointment_animalId_idx" ON "VetAppointment"("animalId");

-- CreateIndex
CREATE INDEX "VetAppointment_animalId_status_idx" ON "VetAppointment"("animalId", "status");

-- CreateIndex
CREATE INDEX "NotificationEvent_medicationId_idx" ON "NotificationEvent"("medicationId");

-- CreateIndex
CREATE INDEX "NotificationEvent_appointmentId_idx" ON "NotificationEvent"("appointmentId");

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "VetAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Module A : CHECK constraints (Prisma ne supporte pas les CHECK — SQL manuel)
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_frequency_check" CHECK ("frequency" IN ('daily','every_x_hours','weekly'));
ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_status_check" CHECK ("status" IN ('scheduled','done','cancelled'));
