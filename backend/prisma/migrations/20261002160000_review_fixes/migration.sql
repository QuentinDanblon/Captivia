-- Revue de sécurité : version de jeton recopiée sur chaque refresh token (défense en profondeur
-- contre la survie d'une session à logout-all / changement ou reset du mot de passe).
-- Colonne nullable (additive, compatible N-1) : NULL = jeton émis avant cette migration.

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "tokenVersion" INTEGER;

-- Les jetons encore actifs reprennent la version courante de leur compte : ils restent valides.
UPDATE "RefreshToken" AS rt
SET "tokenVersion" = u."tokenVersion"
FROM "User" AS u
WHERE rt."userId" = u."id" AND rt."revokedAt" IS NULL;
