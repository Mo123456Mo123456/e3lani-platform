-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'STORE', 'BRAND', 'COMPANY');

-- CreateEnum
CREATE TYPE "TickerLogoStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'EXPIRED', 'STOPPED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);

-- AlterTable BrandProfile
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "storeUrl" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "twitterUrl" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "snapchatUrl" TEXT;

-- CreateTable ProfilePost
CREATE TABLE IF NOT EXISTS "ProfilePost" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "cityId" UUID,
    "contactMethods" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfilePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProfilePostMedia
CREATE TABLE IF NOT EXISTS "ProfilePostMedia" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "MediaKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfilePostMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable SavedPost
CREATE TABLE IF NOT EXISTS "SavedPost" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable TickerLogo
CREATE TABLE IF NOT EXISTS "TickerLogo" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "status" "TickerLogoStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TickerLogo_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ProfilePost_ownerId_createdAt_idx" ON "ProfilePost"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfilePost_status_createdAt_idx" ON "ProfilePost"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfilePostMedia_postId_idx" ON "ProfilePostMedia"("postId");
CREATE UNIQUE INDEX IF NOT EXISTS "SavedPost_userId_postId_key" ON "SavedPost"("userId", "postId");
CREATE INDEX IF NOT EXISTS "TickerLogo_status_sortOrder_idx" ON "TickerLogo"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "TickerLogo_status_startsAt_endsAt_idx" ON "TickerLogo"("status", "startsAt", "endsAt");

-- FKs
ALTER TABLE "ProfilePost" DROP CONSTRAINT IF EXISTS "ProfilePost_ownerId_fkey";
ALTER TABLE "ProfilePost" ADD CONSTRAINT "ProfilePost_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfilePostMedia" DROP CONSTRAINT IF EXISTS "ProfilePostMedia_postId_fkey";
ALTER TABLE "ProfilePostMedia" ADD CONSTRAINT "ProfilePostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ProfilePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfilePostMedia" DROP CONSTRAINT IF EXISTS "ProfilePostMedia_assetId_fkey";
ALTER TABLE "ProfilePostMedia" ADD CONSTRAINT "ProfilePostMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedPost" DROP CONSTRAINT IF EXISTS "SavedPost_userId_fkey";
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedPost" DROP CONSTRAINT IF EXISTS "SavedPost_postId_fkey";
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ProfilePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TickerLogo" DROP CONSTRAINT IF EXISTS "TickerLogo_ownerId_fkey";
ALTER TABLE "TickerLogo" ADD CONSTRAINT "TickerLogo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
