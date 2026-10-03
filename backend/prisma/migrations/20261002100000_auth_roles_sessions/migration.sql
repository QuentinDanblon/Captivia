-- W0-01 / W1-01 / W2-03 / W0-04 — rôles, emails normalisés, version de session,
-- consentement CGU, tokens de reset hachés.
--
-- NB : la promotion en OPERATOR des comptes listés dans l'ancienne variable
-- OPERATOR_EMAILS n'est PAS faisable en SQL (la variable vit dans
-- l'environnement de l'application). Après cette migration, AUCUN compte n'est
-- opérateur : promouvoir explicitement chaque opérateur avec
--   npm run operator:set -- <email>
-- (voir backend/scripts/set-operator.ts).

-- ---------------------------------------------------------------------------
-- 1. Emails : détection des collisions de casse / d'espaces AVANT normalisation.
--    En cas de doublon, la migration échoue proprement (rien n'est modifié :
--    Prisma exécute le fichier dans une transaction).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  collisions integer;
BEGIN
  SELECT count(*) INTO collisions
  FROM (
    SELECT lower(btrim(email))
    FROM "User"
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) AS dup;

  IF collisions > 0 THEN
    RAISE EXCEPTION 'Migration 20261002100000_auth_roles_sessions : % adresse(s) email en collision une fois normalisées (trim + minuscules). Fusionnez ou renommez ces comptes manuellement, puis relancez la migration. Pour les lister : SELECT lower(btrim(email)) AS email_normalise, array_agg(id) AS ids FROM "User" GROUP BY 1 HAVING count(*) > 1;', collisions
      USING ERRCODE = 'unique_violation';
  END IF;
END $$;

UPDATE "User"
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

-- Garde-fou en base : tout email inséré doit déjà être normalisé. Combiné à
-- l'index unique existant "User_email_key", cela garantit l'unicité
-- insensible à la casse.
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check" CHECK (email = lower(btrim(email)));

-- ---------------------------------------------------------------------------
-- 2. Rôle applicatif (remplace OPERATOR_EMAILS), version de session, CGU.
-- ---------------------------------------------------------------------------
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'OPERATOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "termsAcceptedAt" TIMESTAMPTZ(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. Tokens de reset : on ne stocke plus que sha256(token) (hex). Les tokens
--    en cours (durée de vie 1 h) sont convertis en place et restent valides.
-- ---------------------------------------------------------------------------
-- DropIndex
DROP INDEX "PasswordResetToken_token_key";

ALTER TABLE "PasswordResetToken" RENAME COLUMN "token" TO "tokenHash";

UPDATE "PasswordResetToken"
SET "tokenHash" = encode(sha256(convert_to("tokenHash", 'UTF8')), 'hex');

-- Purge des tokens expirés
DELETE FROM "PasswordResetToken" WHERE "expiresAt" < now();

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
