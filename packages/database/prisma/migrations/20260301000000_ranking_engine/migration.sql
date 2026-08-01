-- محرّك الترتيب الداخلي: درجات الإعلانات وتقارب المستخدمين مع الأقسام

-- CreateTable
CREATE TABLE "ad_scores" (
    "adId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_scores_pkey" PRIMARY KEY ("adId")
);

-- CreateTable
CREATE TABLE "user_category_affinities" (
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_category_affinities_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateIndex
CREATE INDEX "ad_scores_quality_idx" ON "ad_scores"("quality");

-- CreateIndex
CREATE INDEX "user_category_affinities_userId_score_idx" ON "user_category_affinities"("userId", "score");

-- AddForeignKey
ALTER TABLE "ad_scores" ADD CONSTRAINT "ad_scores_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_category_affinities" ADD CONSTRAINT "user_category_affinities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_category_affinities" ADD CONSTRAINT "user_category_affinities_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
