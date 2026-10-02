-- W6-08 : achats intégrés (App Store / Google Play via RevenueCat).
-- User.isPremium reste l activation manuelle opérateur (rétrocompatible).

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('APPLE', 'GOOGLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'IN_GRACE_PERIOD', 'CANCELLED', 'EXPIRED', 'BILLING_ISSUE', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SubscriptionSource" NOT NULL,
    "productId" TEXT NOT NULL,
    "entitlement" TEXT NOT NULL DEFAULT 'premium',
    "status" "SubscriptionStatus" NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(3),
    "willRenew" BOOLEAN NOT NULL DEFAULT false,
    "environment" "SubscriptionEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "lastEventId" TEXT,
    "lastEventAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'applied',
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_status_currentPeriodEnd_idx" ON "Subscription"("userId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_source_originalTransactionId_key" ON "Subscription"("source", "originalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_userId_idx" ON "PaymentEvent"("userId");

-- CreateIndex
CREATE INDEX "PaymentEvent_receivedAt_idx" ON "PaymentEvent"("receivedAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
