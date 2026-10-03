-- W6-07 — Durcissement du push natif (revue de sécurité).
--
-- Migration additive (colonne nullable) + contrainte resserrée : compatible N-1 (l'ancien code
-- ignore la colonne ; son DTO refuse déjà tout jeton qui n'a pas la forme d'un jeton FCM).
--
-- 1. "localRemindersAsOf" : instant serveur de l'état des soins que l'appareil a programmés en
--    notifications locales (`generatedAt` de l'Agenda). Un rappel n'est réputé couvert localement
--    que si sa source (routine, médicament) n'a pas été modifiée depuis. NULL : aucune couverture.
ALTER TABLE "DeviceToken" ADD COLUMN "localRemindersAsOf" TIMESTAMPTZ(3);

-- 2. Longueur maximale d'un jeton : 512 caractères (FCM : ~160 aujourd'hui). Un jeton plus long ne
--    peut pas être un jeton FCM valide : il est supprimé avant de poser la contrainte.
DELETE FROM "DeviceToken" WHERE char_length("token") > 512;
ALTER TABLE "DeviceToken" DROP CONSTRAINT "DeviceToken_token_length_check";
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_token_length_check" CHECK (char_length("token") BETWEEN 1 AND 512);
