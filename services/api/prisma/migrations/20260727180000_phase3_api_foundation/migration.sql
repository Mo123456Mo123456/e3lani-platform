-- CreateEnum
CREATE TYPE "AdCoverage" AS ENUM ('CITY', 'NATIONWIDE');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'CLOSED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- AlterTable Ad
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "coverage" "AdCoverage" NOT NULL DEFAULT 'CITY';
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Ad_status_expiresAt_idx" ON "Ad"("status", "expiresAt");

-- AlterTable Report
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "resolution" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "resolvedById" UUID;
CREATE INDEX IF NOT EXISTS "Report_adId_status_idx" ON "Report"("adId", "status");
CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateTable Appeal
CREATE TABLE IF NOT EXISTS "Appeal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "reportId" UUID,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Appeal_userId_status_idx" ON "Appeal"("userId", "status");
CREATE INDEX IF NOT EXISTS "Appeal_adId_status_idx" ON "Appeal"("adId", "status");

ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable Campaign
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "budgetTotal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "targeting" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_ownerId_status_idx" ON "Campaign"("ownerId", "status");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CampaignAd" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignAd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignAd_campaignId_adId_key" ON "CampaignAd"("campaignId", "adId");
ALTER TABLE "CampaignAd" ADD CONSTRAINT "CampaignAd_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignAd" ADD CONSTRAINT "CampaignAd_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
