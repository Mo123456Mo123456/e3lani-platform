import mysql from "mysql2/promise";

const regions = [
  ["riyadh", "منطقة الرياض", "Riyadh Region", 1, 1],
  ["makkah", "منطقة مكة المكرمة", "Makkah Region", 1, 2],
  ["eastern", "المنطقة الشرقية", "Eastern Province", 1, 3],
  ["madinah", "منطقة المدينة المنورة", "Madinah Region", 1, 4],
  ["qassim", "منطقة القصيم", "Al-Qassim Region", 1, 5],
  ["asir", "منطقة عسير", "Asir Region", 1, 6],
];

const cities = [
  ["riyadh", "riyadh", "الرياض", "Riyadh", 24713600, 46675200, 1, 1],
  ["makkah", "jeddah", "جدة", "Jeddah", 21543200, 39272600, 1, 2],
  ["makkah", "makkah", "مكة المكرمة", "Makkah", 21389800, 39857500, 1, 3],
  ["eastern", "dammam", "الدمام", "Dammam", 26392200, 50088900, 1, 4],
  ["eastern", "khobar", "الخبر", "Al Khobar", 25284000, 50209000, 1, 5],
  ["madinah", "madinah", "المدينة المنورة", "Madinah", 24686000, 39615000, 1, 6],
  ["qassim", "buraydah", "بريدة", "Buraydah", 26326000, 43975000, 1, 7],
  ["asir", "abha", "أبها", "Abha", 18216000, 42505000, 1, 8],
];

const categories = [
  ["real-estate", "العقارات", "Real Estate", "apartment", "strict", 1, 1],
  ["cars", "السيارات", "Cars", "directions-car", "standard", 1, 2],
  ["electronics", "الإلكترونيات", "Electronics", "devices", "standard", 1, 3],
  ["furniture", "الأثاث", "Furniture", "chair", "standard", 1, 4],
  ["services", "الخدمات", "Services", "handyman", "strict", 1, 5],
  ["brands", "البراندات", "Brands", "sell", "standard", 1, 6],
  ["restaurants", "مطاعم ومقاهي", "Restaurants & Cafes", "restaurant", "strict", 1, 7],
  ["fashion", "أزياء وجمال", "Fashion & Beauty", "checkroom", "standard", 1, 8],
  ["equipment", "معدات وأدوات", "Equipment & Tools", "construction", "standard", 1, 9],
  ["home", "مستلزمات منزلية", "Home Essentials", "home", "standard", 1, 10],
];

const pricingRules = [
  ["highlight_3", "إبراز 3 أيام", "3-day highlight", 1500, 3, 1],
  ["highlight_7", "إبراز 7 أيام", "7-day highlight", 2900, 7, 1],
  ["top_category", "أعلى القسم", "Top of category", 2400, 7, 1],
  ["city_targeting", "استهداف مدينة", "City targeting", 1200, 7, 1],
  ["extension_15", "تمديد 15 يومًا", "15-day extension", 2900, 15, 1],
];

const promotions = [
  ["highlight_3", "highlight", "إبراز 3 أيام", "3-day highlight", 1],
  ["highlight_7", "highlight", "إبراز 7 أيام", "7-day highlight", 1],
  ["top_category", "top_category", "أعلى القسم", "Top of category", 1],
  ["city_targeting", "city_targeting", "استهداف مدينة", "City targeting", 1],
];

const settings = [
  ["platform.identity", { country: "SA", currency: "SAR", locales: ["ar", "en"], defaultLocale: "ar" }, 1],
  ["ads.policy", { freePostEnabled: true, paidDistributionEnabled: true, paidDistributionRequiresReview: true, defaultActiveDays: 30, maxImages: 10, maxVideos: 1, republishCooldownHours: 72 }, 1],
  ["media.policy", { imageMaxBytes: 5242880, videoMaxBytes: 52428800, allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"], allowedVideoMimeTypes: ["video/mp4"], requirePrimaryImage: true }, 1],
  ["contact.policy", { allowedTypes: ["store", "product", "whatsapp", "phone"], verifyPhoneBeforePublish: true }, 1],
  ["payment.policy", { currency: "SAR", paymentProviders: ["sandbox"], refundWindowHours: 24 }, 1],
  ["privacy.policyVersions", { terms: "2026-07", privacy: "2026-07", content: "2026-07", refund: "2026-07" }, 1],
  ["moderation.rules", { manualReviewFor: ["strict_category", "paid_distribution", "reported_content"], autoRejectEnabled: false, maxOpenReportsBeforePause: 3 }, 0],
  ["security.policy", { sessionMaxAgeDays: 30, rateLimits: { readPerMinute: 120, writePerMinute: 30 }, maxFailedPaymentsPerHour: 5 }, 0],
  ["notifications.policy", { reviewUpdates: true, paymentUpdates: true, expiryReminders: true, marketingDefault: false }, 0],
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is unavailable");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const inserted = { regions: 0, cities: 0, categories: 0, pricingVersions: 0, pricingRules: 0, promotions: 0, settings: 0 };

async function insertIgnore(query, values, key) {
  const [result] = await connection.execute(query, values);
  inserted[key] += result.affectedRows;
}

try {
  await connection.beginTransaction();

  for (const region of regions) {
    await insertIgnore(
      "INSERT IGNORE INTO regions (code, nameAr, nameEn, isActive, sortOrder) VALUES (?, ?, ?, ?, ?)",
      region,
      "regions",
    );
  }

  const [regionRows] = await connection.query("SELECT id, code FROM regions");
  const regionIds = new Map(regionRows.map((row) => [row.code, row.id]));

  for (const [regionCode, code, nameAr, nameEn, latitudeE6, longitudeE6, isActive, sortOrder] of cities) {
    const regionId = regionIds.get(regionCode);
    if (!regionId) throw new Error(`Missing seeded region: ${regionCode}`);
    await insertIgnore(
      "INSERT IGNORE INTO cities (regionId, code, nameAr, nameEn, latitudeE6, longitudeE6, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [regionId, code, nameAr, nameEn, latitudeE6, longitudeE6, isActive, sortOrder],
      "cities",
    );
  }

  for (const category of categories) {
    await insertIgnore(
      "INSERT IGNORE INTO categories (parentId, slug, nameAr, nameEn, icon, reviewPolicy, isActive, sortOrder) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)",
      category,
      "categories",
    );
  }

  await insertIgnore(
    "INSERT IGNORE INTO pricing_versions (version, currency, basePriceHalalas, vatBasisPoints, isActive, effectiveFrom) VALUES (1, 'SAR', 5900, 1500, 1, CURRENT_TIMESTAMP)",
    [],
    "pricingVersions",
  );

  const [pricingVersionRows] = await connection.query("SELECT id FROM pricing_versions WHERE version = 1 LIMIT 1");
  const pricingVersionId = pricingVersionRows[0]?.id;
  if (!pricingVersionId) throw new Error("Missing pricing version 1");

  const [pricingRuleRows] = await connection.query(
    "SELECT code FROM pricing_rules WHERE pricingVersionId = ?",
    [pricingVersionId],
  );
  const existingPricingRuleCodes = new Set(pricingRuleRows.map((row) => row.code));

  for (const rule of pricingRules) {
    if (existingPricingRuleCodes.has(rule[0])) continue;
    await insertIgnore(
      "INSERT IGNORE INTO pricing_rules (pricingVersionId, code, labelAr, labelEn, priceHalalas, durationDays, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [pricingVersionId, ...rule],
      "pricingRules",
    );
    existingPricingRuleCodes.add(rule[0]);
  }

  for (const promotion of promotions) {
    await insertIgnore(
      "INSERT IGNORE INTO promotions (code, type, labelAr, labelEn, isActive) VALUES (?, ?, ?, ?, ?)",
      promotion,
      "promotions",
    );
  }

  for (const [settingKey, value, isPublic] of settings) {
    await insertIgnore(
      "INSERT IGNORE INTO app_settings (settingKey, value, isPublic, updatedBy) VALUES (?, ?, ?, NULL)",
      [settingKey, JSON.stringify(value), isPublic],
      "settings",
    );
  }

  await connection.commit();
  console.log(JSON.stringify({ ok: true, inserted }, null, 2));
  connection.destroy();
  process.exit(0);
} catch (error) {
  await connection.rollback();
  connection.destroy();
  console.error(error);
  process.exit(1);
}
