-- W6-07 — Push natif (FCM pour Android, APNs relayé par FCM pour iOS).
--
-- Migration purement additive (nouvelle table) : compatible N-1, l'ancien code l'ignore.
-- Un jeton FCM identifie une installation de l'app ; il est unique et appartient au dernier compte
-- qui l'a enregistré. Supprimé avec le compte (cascade, purge des invités comprise), à la
-- déconnexion, sur réponse UNREGISTERED / jeton invalide de FCM et après 270 jours sans
-- réenregistrement (job de maintenance).

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "localRemindersUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeviceToken_platform_check" CHECK ("platform" IN ('android', 'ios')),
    CONSTRAINT "DeviceToken_token_length_check" CHECK (char_length("token") BETWEEN 1 AND 4096)
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex (purge des jetons inactifs)
CREATE INDEX "DeviceToken_lastSeenAt_idx" ON "DeviceToken"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
