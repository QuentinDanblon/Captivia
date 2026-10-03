-- W3-02 : scheduler de rappels — fuseau horaire utilisateur + marqueur anti-doublon d'envoi.

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "notifiedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';
