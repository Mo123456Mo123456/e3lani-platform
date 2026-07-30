CREATE TYPE "InteractionType" AS ENUM (
  'IMPRESSION', 'VIEW', 'WATCH_DURATION', 'SAVE', 'UNSAVE',
  'CLICK_WHATSAPP', 'CLICK_STORE', 'CLICK_CALL', 'CLICK_EXTERNAL',
  'SHARE', 'SKIP', 'DISMISS'
);

CREATE TYPE "ImpressionSource" AS ENUM ('ORGANIC', 'PAID', 'SMART_RECOMMENDATION');

CREATE TABLE "UserInteraction" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "sessionId" TEXT,
  "adId" UUID NOT NULL,
  "type" "InteractionType" NOT NULL,
  "value" DOUBLE PRECISION,
  "source" "ImpressionSource",
  "feedTab" TEXT,
  "platform" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdEngagementStats" (
  "adId" UUID NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "uniqueReachApprox" INTEGER NOT NULL DEFAULT 0,
  "views" INTEGER NOT NULL DEFAULT 0,
  "saves" INTEGER NOT NULL DEFAULT 0,
  "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
  "storeClicks" INTEGER NOT NULL DEFAULT 0,
  "callClicks" INTEGER NOT NULL DEFAULT 0,
  "externalClicks" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "skips" INTEGER NOT NULL DEFAULT 0,
  "videoWatchSumSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "videoWatchCount" INTEGER NOT NULL DEFAULT 0,
  "videoCompletions" INTEGER NOT NULL DEFAULT 0,
  "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdEngagementStats_pkey" PRIMARY KEY ("adId")
);

CREATE INDEX "UserInteraction_userId_createdAt_idx" ON "UserInteraction"("userId", "createdAt");
CREATE INDEX "UserInteraction_adId_type_createdAt_idx" ON "UserInteraction"("adId", "type", "createdAt");
CREATE INDEX "UserInteraction_userId_adId_type_idx" ON "UserInteraction"("userId", "adId", "type");
CREATE INDEX "UserInteraction_sessionId_createdAt_idx" ON "UserInteraction"("sessionId", "createdAt");
CREATE INDEX "UserInteraction_feedTab_createdAt_idx" ON "UserInteraction"("feedTab", "createdAt");
CREATE INDEX "UserInteraction_source_createdAt_idx" ON "UserInteraction"("source", "createdAt");
CREATE INDEX "AdEngagementStats_popularityScore_idx" ON "AdEngagementStats"("popularityScore");
CREATE INDEX "AdEngagementStats_updatedAt_idx" ON "AdEngagementStats"("updatedAt");
CREATE INDEX "Ad_status_isSponsored_isFeatured_publishedAt_idx" ON "Ad"("status", "isSponsored", "isFeatured", "publishedAt");

ALTER TABLE "UserInteraction" ADD CONSTRAINT "UserInteraction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserInteraction" ADD CONSTRAINT "UserInteraction_adId_fkey"
  FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdEngagementStats" ADD CONSTRAINT "AdEngagementStats_adId_fkey"
  FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
