-- Communauté (volet social, phase 1 — backend).
--
-- Migration purement additive (nouvelles tables et types, aucune donnée existante modifiée) :
-- compatible N-1, l'ancien code ignore ces tables. Le volet reste désactivé tant que
-- COMMUNITY_ENABLED n'est pas à "true" (toutes les routes /community/* répondent 404).
--
-- Séparation stricte : aucune table communautaire ne référence le carnet de santé. Seule
-- "CommunityPost"."animalId" pointe vers "Animal" (nom + espèce affichés, choix explicite de
-- l'auteur, SET NULL si l'animal est supprimé).
--
-- Les CHECK (non représentables dans schema.prisma) sont ajoutés en fin de fichier.

-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('PHOTO', 'QUESTION');

-- CreateEnum
CREATE TYPE "CommunitySpeciesCategory" AS ENUM ('MAMMAL', 'BIRD', 'REPTILE', 'FISH', 'AMPHIBIAN', 'ARACHNID', 'INSECT', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityContentStatus" AS ENUM ('VISIBLE', 'HIDDEN_AUTO', 'HIDDEN_MODERATOR');

-- CreateEnum
CREATE TYPE "CommunityReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'ANIMAL_WELFARE', 'ILLEGAL_TRADE', 'DANGEROUS_ADVICE', 'NUDITY', 'PERSONAL_DATA', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CommunityModerationTarget" AS ENUM ('POST', 'COMMENT', 'USER');

-- CreateEnum
CREATE TYPE "CommunityModerationActionType" AS ENUM ('AUTO_HIDE', 'HIDE', 'RESTORE', 'DELETE', 'DISMISS', 'SUSPEND', 'UNSUSPEND');

-- CreateEnum
CREATE TYPE "CommunityAppealStatus" AS ENUM ('NONE', 'PENDING', 'UPHELD', 'REVERSED');

-- CreateTable
CREATE TABLE "CommunityProfile" (
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "handleKey" TEXT NOT NULL,
    "avatarMediaId" TEXT,
    "rulesVersion" TEXT NOT NULL,
    "rulesAcceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "ageConfirmedAt" TIMESTAMPTZ(3) NOT NULL,
    "suspendedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CommunityMedia" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "postId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "CommunityPostType" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "speciesCategory" "CommunitySpeciesCategory",
    "animalId" TEXT,
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'VISIBLE',
    "hiddenAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "helpfulCommentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'VISIBLE',
    "hiddenAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReaction" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "reason" "CommunityReason" NOT NULL,
    "details" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "CommunityModerationAction" (
    "id" TEXT NOT NULL,
    "action" "CommunityModerationActionType" NOT NULL,
    "targetType" "CommunityModerationTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "subjectId" TEXT,
    "operatorId" TEXT,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "reason" "CommunityReason",
    "statement" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "suspendedUntil" TIMESTAMPTZ(3),
    "notifiedAt" TIMESTAMPTZ(3),
    "appealStatus" "CommunityAppealStatus" NOT NULL DEFAULT 'NONE',
    "appealText" TEXT,
    "appealedAt" TIMESTAMPTZ(3),
    "appealResolvedAt" TIMESTAMPTZ(3),
    "appealStatement" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_handleKey_key" ON "CommunityProfile"("handleKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfile_avatarMediaId_key" ON "CommunityProfile"("avatarMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMedia_key_key" ON "CommunityMedia"("key");

-- CreateIndex
CREATE INDEX "CommunityMedia_ownerId_createdAt_idx" ON "CommunityMedia"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityMedia_postId_position_idx" ON "CommunityMedia"("postId", "position");

-- CreateIndex
CREATE INDEX "CommunityMedia_createdAt_idx" ON "CommunityMedia"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPost_helpfulCommentId_key" ON "CommunityPost"("helpfulCommentId");

-- CreateIndex
CREATE INDEX "CommunityPost_status_createdAt_id_idx" ON "CommunityPost"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CommunityPost_speciesCategory_status_createdAt_idx" ON "CommunityPost"("speciesCategory", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_createdAt_idx" ON "CommunityPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_animalId_idx" ON "CommunityPost"("animalId");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_createdAt_idx" ON "CommunityComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityComment_authorId_createdAt_idx" ON "CommunityComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityComment_parentId_idx" ON "CommunityComment"("parentId");

-- CreateIndex
CREATE INDEX "CommunityReaction_userId_idx" ON "CommunityReaction"("userId");

-- CreateIndex
CREATE INDEX "CommunityReport_status_createdAt_idx" ON "CommunityReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_postId_status_idx" ON "CommunityReport"("postId", "status");

-- CreateIndex
CREATE INDEX "CommunityReport_commentId_status_idx" ON "CommunityReport"("commentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReport_reporterId_postId_key" ON "CommunityReport"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReport_reporterId_commentId_key" ON "CommunityReport"("reporterId", "commentId");

-- CreateIndex
CREATE INDEX "CommunityBlock_blockedId_idx" ON "CommunityBlock"("blockedId");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_subjectId_createdAt_idx" ON "CommunityModerationAction"("subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_targetType_targetId_idx" ON "CommunityModerationAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_appealStatus_appealedAt_idx" ON "CommunityModerationAction"("appealStatus", "appealedAt");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_createdAt_idx" ON "CommunityModerationAction"("createdAt");

-- AddForeignKey
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "CommunityMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMedia" ADD CONSTRAINT "CommunityMedia_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMedia" ADD CONSTRAINT "CommunityMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_helpfulCommentId_fkey" FOREIGN KEY ("helpfulCommentId") REFERENCES "CommunityComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityBlock" ADD CONSTRAINT "CommunityBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityBlock" ADD CONSTRAINT "CommunityBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationAction" ADD CONSTRAINT "CommunityModerationAction_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationAction" ADD CONSTRAINT "CommunityModerationAction_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- CHECK : longueurs bornées et formats (miroir des DTO et de community.constants.ts)
-- ============================================================================

-- Pseudo : 3 à 30 caractères [A-Za-z0-9_.] ; la clé d'unicité est le pseudo en minuscules.
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_handle_check"
  CHECK ("handle" ~ '^[A-Za-z0-9_.]{3,30}$' AND "handleKey" = lower("handle"));
ALTER TABLE "CommunityProfile" ADD CONSTRAINT "CommunityProfile_rulesVersion_check"
  CHECK (char_length("rulesVersion") BETWEEN 1 AND 32);

-- Publication : texte ≤ 2 000 caractères ; une question a toujours un texte.
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_body_check"
  CHECK (char_length("body") <= 2000 AND ("type" <> 'QUESTION' OR char_length(btrim("body")) >= 1));

-- Commentaire : 1 à 1 000 caractères.
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_body_check"
  CHECK (char_length("body") BETWEEN 1 AND 1000);

-- Média : 4 images au plus par publication (positions 0 à 3), dimensions et taille positives.
ALTER TABLE "CommunityMedia" ADD CONSTRAINT "CommunityMedia_values_check"
  CHECK ("position" BETWEEN 0 AND 3 AND "width" > 0 AND "height" > 0 AND "bytes" > 0
         AND char_length("key") BETWEEN 1 AND 200);

-- Signalement : exactement un contenu visé ; précisions ≤ 500 caractères.
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_target_check"
  CHECK (num_nonnulls("postId", "commentId") = 1);
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_details_check"
  CHECK ("details" IS NULL OR char_length("details") <= 500);

-- Blocage : on ne se bloque pas soi-même.
ALTER TABLE "CommunityBlock" ADD CONSTRAINT "CommunityBlock_self_check"
  CHECK ("blockerId" <> "blockedId");

-- Journal de modération : exposé des motifs et recours bornés.
ALTER TABLE "CommunityModerationAction" ADD CONSTRAINT "CommunityModerationAction_text_check"
  CHECK (char_length("statement") BETWEEN 1 AND 2000
         AND ("appealText" IS NULL OR char_length("appealText") <= 2000)
         AND ("appealStatement" IS NULL OR char_length("appealStatement") <= 2000));
