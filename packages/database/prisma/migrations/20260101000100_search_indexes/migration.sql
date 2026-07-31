-- فهارس البحث النصي السريع على الإعلانات (بحث جزئي بالعربية والإنجليزية)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ads_title_trgm_idx" ON "ads" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ads_description_trgm_idx" ON "ads" USING GIN ("description" gin_trgm_ops);

-- فهرس مركّب يخدم الموجز الرئيسي (الإعلانات النشطة مرتبة بآخر رفع)
CREATE INDEX IF NOT EXISTS "ads_active_feed_idx"
  ON "ads" ("status", "lastBumpedAt" DESC NULLS LAST, "publishedAt" DESC);
