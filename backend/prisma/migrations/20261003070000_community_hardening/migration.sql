-- Communauté : durcissement après revue de sécurité.
--
-- Migration purement additive (colonnes nullables ou avec défaut, nouvelles tables, index) :
-- compatible N-1, l'ancien code ignore ces colonnes et tables.
-- - "User"."communitySuspendedUntil" : la suspension de publication est portée par le compte
--   (quitter la communauté puis réactiver le profil ne la lève plus). Reprise des suspensions
--   en cours depuis "CommunityProfile"."suspendedUntil" (conservée comme copie d'affichage).
-- - "CommunityReport"."decisionId" / "notifiedAt" : décision notifiée à l'auteur du signalement
--   (DSA art. 16(5)), relancée par le job de maintenance.
-- - "CommunityModerationAction"."notificationPending" : notification de l'auteur du contenu à
--   relancer (envoi en échec).
-- - "CommunityHandleHold" : pseudos libérés réservés 60 jours à leur ancien titulaire.
-- - "CommunityUploadAttempt" : tentatives de téléversement (limite par compte, échecs compris).

-- AlterTable
ALTER TABLE "CommunityModerationAction" ADD COLUMN     "notificationPending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommunityReport" ADD COLUMN     "decisionId" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "communitySuspendedUntil" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "CommunityHandleHold" (
    "id" TEXT NOT NULL,
    "handleKey" TEXT NOT NULL,
    "userId" TEXT,
    "releasedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityHandleHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityUploadAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityUploadAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityHandleHold_handleKey_key" ON "CommunityHandleHold"("handleKey");

-- CreateIndex
CREATE INDEX "CommunityHandleHold_userId_idx" ON "CommunityHandleHold"("userId");

-- CreateIndex
CREATE INDEX "CommunityHandleHold_expiresAt_idx" ON "CommunityHandleHold"("expiresAt");

-- CreateIndex
CREATE INDEX "CommunityUploadAttempt_userId_createdAt_idx" ON "CommunityUploadAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityUploadAttempt_createdAt_idx" ON "CommunityUploadAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_notificationPending_createdAt_idx" ON "CommunityModerationAction"("notificationPending", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_decisionId_idx" ON "CommunityReport"("decisionId");

-- CreateIndex
CREATE INDEX "CommunityReport_reporterId_createdAt_idx" ON "CommunityReport"("reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CommunityModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityHandleHold" ADD CONSTRAINT "CommunityHandleHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityUploadAttempt" ADD CONSTRAINT "CommunityUploadAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des suspensions en cours (copie du profil vers le compte).
UPDATE "User" u
SET "communitySuspendedUntil" = p."suspendedUntil"
FROM "CommunityProfile" p
WHERE p."userId" = u."id" AND p."suspendedUntil" IS NOT NULL;

-- CHECK (miroir de handle.ts) : clé de pseudo en minuscules, réservation bornée dans le temps.
ALTER TABLE "CommunityHandleHold" ADD CONSTRAINT "CommunityHandleHold_handleKey_check"
  CHECK ("handleKey" ~ '^[a-z0-9_.]{3,30}$' AND "expiresAt" > "releasedAt");
