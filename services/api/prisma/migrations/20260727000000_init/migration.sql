-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('VISITOR', 'USER', 'ADVERTISER', 'BRAND', 'ENTERPRISE', 'AD_MODERATOR', 'SUPPORT', 'CAMPAIGN_MANAGER', 'FINANCE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED_AWAITING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'REJECTED', 'EXPIRED', 'REMOVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('NOT_SUBMITTED', 'QUEUED', 'AUTO_APPROVED', 'NEEDS_HUMAN', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PENDING_PAYMENT', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "countryCode" TEXT NOT NULL DEFAULT 'SA',
    "cityId" UUID,
    "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[],
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "kind" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "countryCode" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geohash" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "countryCode" TEXT,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "bio" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "websiteUrl" TEXT,
    "whatsapp" TEXT,
    "phone" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" UUID,
    "approvedRevisionId" UUID,
    "activeRevisionId" UUID,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRevision" (
    "id" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "countryCode" TEXT NOT NULL,
    "cityId" UUID NOT NULL,
    "contactMethods" JSONB NOT NULL,
    "mediaSnapshot" JSONB,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "moderationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMedia" (
    "id" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "MediaKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "storageKey" TEXT NOT NULL,
    "posterKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReview" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "reviewerId" UUID,
    "status" "ModerationStatus" NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationFinding" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdStatusHistory" (
    "id" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "fromStatus" "AdStatus",
    "toStatus" "AdStatus" NOT NULL,
    "reason" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAd" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingVersion" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingItem" (
    "id" UUID NOT NULL,
    "pricingVersionId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "durationDays" INTEGER,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,

    CONSTRAINT "PricingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "pricingVersionId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "currency" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderConfig" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "countries" TEXT[],
    "currencies" TEXT[],
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "adId" UUID,
    "userId" UUID,
    "sessionId" TEXT,
    "platform" TEXT,
    "locale" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVerification_userId_key" ON "UserVerification"("userId");

-- CreateIndex
CREATE INDEX "City_countryCode_idx" ON "City"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "City_countryCode_slug_key" ON "City"("countryCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_slug_key" ON "BrandProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_currentRevisionId_key" ON "Ad"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Ad_ownerId_status_idx" ON "Ad"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Ad_status_publishedAt_idx" ON "Ad"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AdRevision_categoryId_cityId_idx" ON "AdRevision"("categoryId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "AdRevision_adId_version_key" ON "AdRevision"("adId", "version");

-- CreateIndex
CREATE INDEX "AdMedia_adId_idx" ON "AdMedia"("adId");

-- CreateIndex
CREATE INDEX "AdStatusHistory_adId_createdAt_idx" ON "AdStatusHistory"("adId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAd_userId_adId_key" ON "SavedAd"("userId", "adId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PricingVersion_code_key" ON "PricingVersion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PricingItem_pricingVersionId_sku_countryCode_key" ON "PricingItem"("pricingVersionId", "sku", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_adId_revisionId_idx" ON "Order"("adId", "revisionId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_provider_providerReference_key" ON "PaymentTransaction"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderConfig_name_key" ON "PaymentProviderConfig"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_adId_name_idx" ON "AnalyticsEvent"("adId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_locale_version_key" ON "LegalDocument"("slug", "locale", "version");

-- CreateIndex
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "AdRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRevision" ADD CONSTRAINT "AdRevision_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRevision" ADD CONSTRAINT "AdRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRevision" ADD CONSTRAINT "AdRevision_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMedia" ADD CONSTRAINT "AdMedia_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMedia" ADD CONSTRAINT "AdMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AdRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFinding" ADD CONSTRAINT "ModerationFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ModerationReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdStatusHistory" ADD CONSTRAINT "AdStatusHistory_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAd" ADD CONSTRAINT "SavedAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAd" ADD CONSTRAINT "SavedAd_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingItem" ADD CONSTRAINT "PricingItem_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

