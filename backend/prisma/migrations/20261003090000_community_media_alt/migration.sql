-- Communauté : texte alternatif par image.
--
-- Migration purement additive (colonne nullable, CHECK sur les valeurs non nulles) : compatible
-- N-1, l'ancien code ignore la colonne. Les images existantes gardent alt = NULL.
-- Borne de 300 caractères alignée sur MEDIA_ALT_MAX_LENGTH (community.constants.ts).

-- AlterTable
ALTER TABLE "CommunityMedia" ADD COLUMN     "alt" TEXT;

-- CHECK : texte alternatif ≤ 300 caractères.
ALTER TABLE "CommunityMedia" ADD CONSTRAINT "CommunityMedia_alt_check"
  CHECK ("alt" IS NULL OR char_length("alt") <= 300);
