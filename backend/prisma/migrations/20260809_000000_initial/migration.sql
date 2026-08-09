-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'bronze',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMPTZ(3),
    "sex" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "publicSlug" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalHealthRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AnimalHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "doneAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "types" JSONB NOT NULL,
    "typeSchedules" JSONB,
    "schedule" JSONB NOT NULL,
    "snooze" INTEGER NOT NULL DEFAULT 15,
    "deliveryChannel" TEXT NOT NULL DEFAULT 'push',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "routineId" TEXT,
    "animalId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesProfile" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "commonNameFr" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "domesticationType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesFeeding" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "dietType" TEXT NOT NULL,
    "recommendedFoods" JSONB NOT NULL,
    "foodsToAvoid" JSONB NOT NULL,
    "mealFrequency" TEXT NOT NULL,
    "specificNeeds" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesFeeding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesHabitat" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "habitatType" TEXT NOT NULL,
    "tempMin" DOUBLE PRECISION NOT NULL,
    "tempMax" DOUBLE PRECISION NOT NULL,
    "humidityMin" DOUBLE PRECISION,
    "humidityMax" DOUBLE PRECISION,
    "minSpaceSize" TEXT NOT NULL,
    "lightNeeds" TEXT NOT NULL,
    "activityEnrichment" TEXT NOT NULL,
    "hygieneNotes" TEXT,
    "costEstimate" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesHabitat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesBehavior" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "generalBehavior" TEXT NOT NULL,
    "sociability" TEXT NOT NULL,
    "difficultyLevel" TEXT NOT NULL,
    "compatibilityWithChildren" TEXT,
    "compatibilityWithOtherAnimals" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesBehavior_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesHealthContent" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "diseases" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesHealthContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesLegislation" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "sources" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeciesLegislation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedEquipment" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "size" TEXT,
    "searchTerms" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecommendedEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "categories" TEXT[],
    "types" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AffiliateStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_publicSlug_key" ON "Animal"("publicSlug");

-- CreateIndex
CREATE INDEX "Animal_userId_idx" ON "Animal"("userId");

-- CreateIndex
CREATE INDEX "Animal_speciesId_idx" ON "Animal"("speciesId");

-- CreateIndex
CREATE INDEX "AnimalHealthRecord_animalId_idx" ON "AnimalHealthRecord"("animalId");

-- CreateIndex
CREATE INDEX "AnimalHealthRecord_animalId_type_idx" ON "AnimalHealthRecord"("animalId", "type");

-- CreateIndex
CREATE INDEX "Routine_animalId_idx" ON "Routine"("animalId");

-- CreateIndex
CREATE INDEX "Routine_active_idx" ON "Routine"("active");

-- CreateIndex
CREATE INDEX "Routine_animalId_active_idx" ON "Routine"("animalId", "active");

-- CreateIndex
CREATE INDEX "ActionLog_animalId_idx" ON "ActionLog"("animalId");

-- CreateIndex
CREATE INDEX "ActionLog_doneAt_idx" ON "ActionLog"("doneAt");

-- CreateIndex
CREATE INDEX "ActionLog_animalId_doneAt_idx" ON "ActionLog"("animalId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_endpoint_idx" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationEvent_userId_idx" ON "NotificationEvent"("userId");

-- CreateIndex
CREATE INDEX "NotificationEvent_scheduledAt_idx" ON "NotificationEvent"("scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_userId_scheduledAt_idx" ON "NotificationEvent"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_routineId_idx" ON "NotificationEvent"("routineId");

-- CreateIndex
CREATE INDEX "NotificationEvent_userId_status_scheduledAt_idx" ON "NotificationEvent"("userId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesProfile_speciesId_key" ON "SpeciesProfile"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesProfile_category_idx" ON "SpeciesProfile"("category");

-- CreateIndex
CREATE INDEX "SpeciesProfile_domesticationType_idx" ON "SpeciesProfile"("domesticationType");

-- CreateIndex
CREATE INDEX "SpeciesFeeding_speciesId_idx" ON "SpeciesFeeding"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesFeeding_dietType_idx" ON "SpeciesFeeding"("dietType");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesFeeding_speciesId_locale_key" ON "SpeciesFeeding"("speciesId", "locale");

-- CreateIndex
CREATE INDEX "SpeciesHabitat_speciesId_idx" ON "SpeciesHabitat"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesHabitat_habitatType_idx" ON "SpeciesHabitat"("habitatType");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesHabitat_speciesId_locale_key" ON "SpeciesHabitat"("speciesId", "locale");

-- CreateIndex
CREATE INDEX "SpeciesBehavior_speciesId_idx" ON "SpeciesBehavior"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesBehavior_difficultyLevel_idx" ON "SpeciesBehavior"("difficultyLevel");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesBehavior_speciesId_locale_key" ON "SpeciesBehavior"("speciesId", "locale");

-- CreateIndex
CREATE INDEX "SpeciesHealthContent_speciesId_idx" ON "SpeciesHealthContent"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesHealthContent_speciesId_locale_key" ON "SpeciesHealthContent"("speciesId", "locale");

-- CreateIndex
CREATE INDEX "SpeciesLegislation_speciesId_idx" ON "SpeciesLegislation"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesLegislation_country_idx" ON "SpeciesLegislation"("country");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesLegislation_speciesId_country_key" ON "SpeciesLegislation"("speciesId", "country");

-- CreateIndex
CREATE INDEX "RecommendedEquipment_speciesId_idx" ON "RecommendedEquipment"("speciesId");

-- CreateIndex
CREATE INDEX "RecommendedEquipment_category_idx" ON "RecommendedEquipment"("category");

-- CreateIndex
CREATE INDEX "AffiliateStore_categories_idx" ON "AffiliateStore"("categories");

-- CreateIndex
CREATE INDEX "AffiliateStore_categories_gin_idx" ON "AffiliateStore" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "AffiliateStore_types_gin_idx" ON "AffiliateStore" USING GIN ("types");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesProfile"("speciesId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================
-- Améliorations structurelles (audit 03-database.md)
-- R6/R12 : CHECK constraints (Prisma ne supporte pas les CHECK — SQL manuel)
-- ============================================
ALTER TABLE "User" ADD CONSTRAINT "User_grade_check" CHECK ("grade" IN ('bronze','silver','gold','platinum','diamond'));
ALTER TABLE "User" ADD CONSTRAINT "User_points_check" CHECK ("points" >= 0);
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_status_check" CHECK ("status" IN ('pending','done','skipped'));
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_deliveryChannel_check" CHECK ("deliveryChannel" IN ('push','email','both'));
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_frequency_check" CHECK ("frequency" IN ('daily','weekly','monthly','once','hourly','custom','every_2_days','every_3_days'));
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_type_check" CHECK ("type" IN ('nourrissage','entretien','uvb','controle'));
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_type_check" CHECK (char_length("type") > 0);
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_name_length_check" CHECK (char_length("name") <= 100);
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_notes_length_check" CHECK ("notes" IS NULL OR char_length("notes") <= 2000);
ALTER TABLE "SpeciesProfile" ADD CONSTRAINT "SpeciesProfile_description_length_check" CHECK ("description" IS NULL OR char_length("description") <= 500);
