-- W0-06 : partage public (QR) en opt-in, révocable.
-- W0-07 : clé d'idempotence des événements de rappel (anti-doublon / anti-DoS).

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicShowHealth" BOOLEAN NOT NULL DEFAULT false;

-- Les animaux qui ont déjà un lien public (QR potentiellement imprimés) restent accessibles,
-- mais sans données de santé tant que le propriétaire ne l'a pas choisi.
UPDATE "Animal" SET "publicEnabled" = true WHERE "publicSlug" IS NOT NULL;

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "sourceKey" TEXT;

-- Backfill de la clé d'idempotence à partir de la source de l'événement.
UPDATE "NotificationEvent"
SET "sourceKey" = COALESCE(
  'routine:' || "routineId",
  'medication:' || "medicationId",
  'appointment:' || "appointmentId",
  'vaccination:' || "vaccinationId",
  'pref:' || "type"
);

-- Dédoublonnage AVANT la création de l'index unique : on garde en priorité
-- l'événement déjà traité (done, puis skipped), puis le plus ancien.
DELETE FROM "NotificationEvent"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "userId", "sourceKey", "scheduledAt"
             ORDER BY (CASE "status" WHEN 'done' THEN 0 WHEN 'skipped' THEN 1 ELSE 2 END),
                      "createdAt",
                      "id"
           ) AS rn
    FROM "NotificationEvent"
  ) ranked
  WHERE ranked.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_userId_sourceKey_scheduledAt_key" ON "NotificationEvent"("userId", "sourceKey", "scheduledAt");
