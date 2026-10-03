-- Mode invité (« Essayer sans compte ») et D-16.
-- Un invité est un vrai "User" (isGuest = true) sans e-mail ni mot de passe ; POST /auth/upgrade le
-- convertit en compte sur la MÊME ligne (données conservées). Migration additive, compatible N-1 :
-- l'ancien code n'écrit jamais d'e-mail NULL et ignore les nouvelles colonnes.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Seul un invité peut n'avoir ni e-mail ni mot de passe ; un compte a toujours les deux.
-- ("User_email_normalized_check" reste valable : NULL satisfait la contrainte ; l'index unique sur
-- "email" accepte plusieurs NULL.)
ALTER TABLE "User"
  ADD CONSTRAINT "User_guest_credentials_check"
  CHECK ("isGuest" OR ("email" IS NOT NULL AND "passwordHash" IS NOT NULL));

-- CreateIndex (purge des invités inactifs)
CREATE INDEX "User_isGuest_lastActiveAt_idx" ON "User"("isGuest", "lastActiveAt");
