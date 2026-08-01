-- ============================================================================
--  تأريخ الأسعار بإصدارات + تاريخ تعديلات الإعلان + سجلات الخصوصية
--  + الفواتير والاستردادات ومحاولات الدفع
--  الترحيل يحافظ على الأسعار الحالية ولا يحذف فهارس البحث المضافة سابقًا.
-- ============================================================================
-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('EXPORT', 'DELETE');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ad_revisions" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "editorUserId" TEXT,
    "editorAdminId" TEXT,
    "reason" TEXT,
    "changedFields" TEXT[],
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_versions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amountHalalas" INTEGER NOT NULL,
    "durationDays" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountHalalas" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "requestedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotalHalalas" INTEGER NOT NULL,
    "vatHalalas" INTEGER NOT NULL,
    "totalHalalas" INTEGER NOT NULL,
    "vatRateBps" INTEGER NOT NULL DEFAULT 1500,
    "buyerName" TEXT,
    "buyerPhone" TEXT NOT NULL,
    "buyerVatNumber" TEXT,
    "sellerName" TEXT NOT NULL,
    "sellerVatNumber" TEXT,
    "lines" JSONB NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "resultKey" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_data_requests_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "pricingVersionId" TEXT;

-- MigrateData
-- ترحيل الأسعار الحالية إلى أول إصدار لكل خدمة قبل حذف الأعمدة القديمة،
-- حتى لا يضيع أي سعر معمول به.
INSERT INTO "pricing_versions" ("id", "itemId", "amountHalalas", "durationDays", "effectiveFrom", "effectiveTo", "note", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text)::uuid::text,
  "id",
  "amountHalalas",
  "durationDays",
  "createdAt",
  NULL,
  'الإصدار الأول — مُرحّل من التسعير السابق',
  "createdAt"
FROM "pricing_items";

-- DropOldPricingColumns
ALTER TABLE "pricing_items" DROP COLUMN "amountHalalas",
DROP COLUMN "durationDays";

-- CreateIndex
CREATE INDEX "ad_revisions_adId_createdAt_idx" ON "ad_revisions"("adId", "createdAt");

-- CreateIndex
CREATE INDEX "pricing_versions_itemId_effectiveFrom_idx" ON "pricing_versions"("itemId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "pricing_versions_effectiveFrom_effectiveTo_idx" ON "pricing_versions"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "payment_attempts_paymentId_createdAt_idx" ON "payment_attempts"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paymentId_key" ON "invoices"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_issuedAt_idx" ON "invoices"("issuedAt");

-- CreateIndex
CREATE INDEX "consent_records_userId_type_createdAt_idx" ON "consent_records"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "user_data_requests_status_createdAt_idx" ON "user_data_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "user_data_requests_userId_idx" ON "user_data_requests"("userId");

-- AddForeignKey
ALTER TABLE "ad_revisions" ADD CONSTRAINT "ad_revisions_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_revisions" ADD CONSTRAINT "ad_revisions_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_revisions" ADD CONSTRAINT "ad_revisions_editorAdminId_fkey" FOREIGN KEY ("editorAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_versions" ADD CONSTRAINT "pricing_versions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "pricing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_versions" ADD CONSTRAINT "pricing_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "pricing_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_requests" ADD CONSTRAINT "user_data_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_requests" ADD CONSTRAINT "user_data_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
