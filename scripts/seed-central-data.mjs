import mysql from "mysql2/promise";

const regions = [
  ["riyadh", "منطقة الرياض", "Riyadh Region", 1, 1],
  ["makkah", "منطقة مكة المكرمة", "Makkah Region", 1, 2],
  ["eastern", "المنطقة الشرقية", "Eastern Province", 1, 3],
  ["madinah", "منطقة المدينة المنورة", "Madinah Region", 1, 4],
  ["qassim", "منطقة القصيم", "Al-Qassim Region", 1, 5],
  ["asir", "منطقة عسير", "Asir Region", 1, 6],
  ["uae", "الإمارات", "United Arab Emirates", 1, 7],
  ["egypt", "مصر", "Egypt", 1, 8],
  ["international", "دولي", "International", 1, 9],
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
  ["uae", "dubai", "دبي", "Dubai", 25114800, 55296400, 1, 9],
  ["uae", "abu_dhabi", "أبوظبي", "Abu Dhabi", 24388400, 54434400, 1, 10],
  ["egypt", "cairo", "القاهرة", "Cairo", 30044300, 31235700, 1, 11],
  ["egypt", "alexandria", "الإسكندرية", "Alexandria", 31199700, 29918500, 1, 12],
  ["international", "other", "مدينة أخرى", "Other city", null, null, 1, 99],
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
  ["ads.policy", { freePostEnabled: true, paidDistributionEnabled: false, paidDistributionRequiresReview: false, defaultActiveDays: 30, maxImages: 10, maxVideos: 1, republishCooldownHours: 72 }, 1],
  ["media.policy", { imageMaxBytes: 5242880, videoMaxBytes: 52428800, allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"], allowedVideoMimeTypes: ["video/mp4"], requirePrimaryImage: true }, 1],
  ["contact.policy", { allowedTypes: ["store", "product", "whatsapp", "phone"], verifyPhoneBeforePublish: true }, 1],
  ["payment.policy", { currency: "SAR", enabled: false, paymentRequired: false, paymentProviders: ["sandbox"], refundWindowHours: 24 }, 1],
  ["launch.policy", {
    globalFreeMode: true,
    globalPaidMode: false,
    discountMode: false,
    countryPricing: true,
    categoryPricing: true,
    firstAdFree: true,
    freeAdsPerUser: null,
    couponSystem: true,
    paymentRequired: false,
    paymentsEnabled: false,
    taxEnabled: false,
    featuredAdsEnabled: true,
    topBannerEnabled: true,
    allCountriesVisibility: true,
    instantPublishing: true,
    aiModeration: true,
    manualPreApproval: false,
    postPublishReports: true,
    defaultFeedMarket: "ALL",
    pricingMode: "free",
    bannerMessageAr: "النشر مجاني حاليًا بمناسبة إطلاق إعلاني.",
    bannerMessageEn: "Publishing is free right now for the E3lani launch.",
  }, 1],
  ["privacy.policyVersions", { terms: "2026-07", privacy: "2026-07", content: "2026-07", refund: "2026-07" }, 1],
  ["moderation.rules", { manualReviewFor: ["reported_content", "ai_needs_review"], autoRejectEnabled: true, maxOpenReportsBeforePause: 3 }, 0],
  ["security.policy", { sessionMaxAgeDays: 30, rateLimits: { readPerMinute: 120, writePerMinute: 30 }, maxFailedPaymentsPerHour: 5 }, 0],
  ["notifications.policy", { reviewUpdates: true, paymentUpdates: true, expiryReminders: true, marketingDefault: false }, 0],
];

const worldCountries = [
  ["SA", "السعودية", "Saudi Arabia", "🇸🇦", "+966", "SAR", "ar", "Asia/Riyadh", '["sandbox"]', 1, 1],
  ["AE", "الإمارات", "United Arab Emirates", "🇦🇪", "+971", "AED", "ar", "Asia/Dubai", '["sandbox"]', 1, 2],
  ["EG", "مصر", "Egypt", "🇪🇬", "+20", "EGP", "ar", "Africa/Cairo", '["sandbox"]', 1, 3],
  ["KW", "الكويت", "Kuwait", "🇰🇼", "+965", "KWD", "ar", "Asia/Kuwait", '["sandbox"]', 1, 4],
  ["QA", "قطر", "Qatar", "🇶🇦", "+974", "QAR", "ar", "Asia/Qatar", '["sandbox"]', 1, 5],
  ["BH", "البحرين", "Bahrain", "🇧🇭", "+973", "BHD", "ar", "Asia/Bahrain", '["sandbox"]', 1, 6],
  ["OM", "عُمان", "Oman", "🇴🇲", "+968", "OMR", "ar", "Asia/Muscat", '["sandbox"]', 1, 7],
  ["JO", "الأردن", "Jordan", "🇯🇴", "+962", "JOD", "ar", "Asia/Amman", '["sandbox"]', 1, 8],
  ["US", "الولايات المتحدة", "United States", "🇺🇸", "+1", "USD", "en", "America/New_York", '["sandbox"]', 1, 9],
  ["GB", "المملكة المتحدة", "United Kingdom", "🇬🇧", "+44", "GBP", "en", "Europe/London", '["sandbox"]', 1, 10],
  ["AF", "أفغانستان", "Afghanistan", "🇦🇫", "+93", "AFN", "en", "Asia/Kabul", '["sandbox"]', 1, 11],
  ["AL", "ألبانيا", "Albania", "🇦🇱", "+355", "ALL", "en", "Europe/Tirane", '["sandbox"]', 1, 12],
  ["DZ", "الجزائر", "Algeria", "🇩🇿", "+213", "DZD", "ar", "Africa/Algiers", '["sandbox"]', 1, 13],
  ["AR", "الأرجنتين", "Argentina", "🇦🇷", "+54", "ARS", "en", "America/Argentina/Buenos_Aires", '["sandbox"]', 1, 14],
  ["AU", "أستراليا", "Australia", "🇦🇺", "+61", "AUD", "en", "Australia/Sydney", '["sandbox"]', 1, 15],
  ["AT", "النمسا", "Austria", "🇦🇹", "+43", "EUR", "en", "Europe/Vienna", '["sandbox"]', 1, 16],
  ["BD", "بنغلاديش", "Bangladesh", "🇧🇩", "+880", "BDT", "en", "Asia/Dhaka", '["sandbox"]', 1, 17],
  ["BE", "بلجيكا", "Belgium", "🇧🇪", "+32", "EUR", "en", "Europe/Brussels", '["sandbox"]', 1, 18],
  ["BR", "البرازيل", "Brazil", "🇧🇷", "+55", "BRL", "en", "America/Sao_Paulo", '["sandbox"]', 1, 19],
  ["CA", "كندا", "Canada", "🇨🇦", "+1", "CAD", "en", "America/Toronto", '["sandbox"]', 1, 20],
  ["CN", "الصين", "China", "🇨🇳", "+86", "CNY", "en", "Asia/Shanghai", '["sandbox"]', 1, 21],
  ["CO", "كولومبيا", "Colombia", "🇨🇴", "+57", "COP", "en", "America/Bogota", '["sandbox"]', 1, 22],
  ["DK", "الدنمارك", "Denmark", "🇩🇰", "+45", "DKK", "en", "Europe/Copenhagen", '["sandbox"]', 1, 23],
  ["ET", "إثيوبيا", "Ethiopia", "🇪🇹", "+251", "ETB", "en", "Africa/Addis_Ababa", '["sandbox"]', 1, 24],
  ["FI", "فنلندا", "Finland", "🇫🇮", "+358", "EUR", "en", "Europe/Helsinki", '["sandbox"]', 1, 25],
  ["FR", "فرنسا", "France", "🇫🇷", "+33", "EUR", "en", "Europe/Paris", '["sandbox"]', 1, 26],
  ["DE", "ألمانيا", "Germany", "🇩🇪", "+49", "EUR", "en", "Europe/Berlin", '["sandbox"]', 1, 27],
  ["GH", "غانا", "Ghana", "🇬🇭", "+233", "GHS", "en", "Africa/Accra", '["sandbox"]', 1, 28],
  ["GR", "اليونان", "Greece", "🇬🇷", "+30", "EUR", "en", "Europe/Athens", '["sandbox"]', 1, 29],
  ["IN", "الهند", "India", "🇮🇳", "+91", "INR", "en", "Asia/Kolkata", '["sandbox"]', 1, 30],
  ["ID", "إندونيسيا", "Indonesia", "🇮🇩", "+62", "IDR", "en", "Asia/Jakarta", '["sandbox"]', 1, 31],
  ["IQ", "العراق", "Iraq", "🇮🇶", "+964", "IQD", "ar", "Asia/Baghdad", '["sandbox"]', 1, 32],
  ["IE", "أيرلندا", "Ireland", "🇮🇪", "+353", "EUR", "en", "Europe/Dublin", '["sandbox"]', 1, 33],
  ["IT", "إيطاليا", "Italy", "🇮🇹", "+39", "EUR", "en", "Europe/Rome", '["sandbox"]', 1, 34],
  ["JP", "اليابان", "Japan", "🇯🇵", "+81", "JPY", "en", "Asia/Tokyo", '["sandbox"]', 1, 35],
  ["KE", "كينيا", "Kenya", "🇰🇪", "+254", "KES", "en", "Africa/Nairobi", '["sandbox"]', 1, 36],
  ["LB", "لبنان", "Lebanon", "🇱🇧", "+961", "LBP", "ar", "Asia/Beirut", '["sandbox"]', 1, 37],
  ["LY", "ليبيا", "Libya", "🇱🇾", "+218", "LYD", "ar", "Africa/Tripoli", '["sandbox"]', 1, 38],
  ["MY", "ماليزيا", "Malaysia", "🇲🇾", "+60", "MYR", "en", "Asia/Kuala_Lumpur", '["sandbox"]', 1, 39],
  ["MA", "المغرب", "Morocco", "🇲🇦", "+212", "MAD", "ar", "Africa/Casablanca", '["sandbox"]', 1, 40],
  ["MX", "المكسيك", "Mexico", "🇲🇽", "+52", "MXN", "en", "America/Mexico_City", '["sandbox"]', 1, 41],
  ["NL", "هولندا", "Netherlands", "🇳🇱", "+31", "EUR", "en", "Europe/Amsterdam", '["sandbox"]', 1, 42],
  ["NZ", "نيوزيلندا", "New Zealand", "🇳🇿", "+64", "NZD", "en", "Pacific/Auckland", '["sandbox"]', 1, 43],
  ["NG", "نيجيريا", "Nigeria", "🇳🇬", "+234", "NGN", "en", "Africa/Lagos", '["sandbox"]', 1, 44],
  ["NO", "النرويج", "Norway", "🇳🇴", "+47", "NOK", "en", "Europe/Oslo", '["sandbox"]', 1, 45],
  ["PK", "باكستان", "Pakistan", "🇵🇰", "+92", "PKR", "en", "Asia/Karachi", '["sandbox"]', 1, 46],
  ["PS", "فلسطين", "Palestine", "🇵🇸", "+970", "ILS", "ar", "Asia/Gaza", '["sandbox"]', 1, 47],
  ["PH", "الفلبين", "Philippines", "🇵🇭", "+63", "PHP", "en", "Asia/Manila", '["sandbox"]', 1, 48],
  ["PL", "بولندا", "Poland", "🇵🇱", "+48", "PLN", "en", "Europe/Warsaw", '["sandbox"]', 1, 49],
  ["PT", "البرتغال", "Portugal", "🇵🇹", "+351", "EUR", "en", "Europe/Lisbon", '["sandbox"]', 1, 50],
  ["RU", "روسيا", "Russia", "🇷🇺", "+7", "RUB", "en", "Europe/Moscow", '["sandbox"]', 1, 51],
  ["SG", "سنغافورة", "Singapore", "🇸🇬", "+65", "SGD", "en", "Asia/Singapore", '["sandbox"]', 1, 52],
  ["ZA", "جنوب أفريقيا", "South Africa", "🇿🇦", "+27", "ZAR", "en", "Africa/Johannesburg", '["sandbox"]', 1, 53],
  ["KR", "كوريا الجنوبية", "South Korea", "🇰🇷", "+82", "KRW", "en", "Asia/Seoul", '["sandbox"]', 1, 54],
  ["ES", "إسبانيا", "Spain", "🇪🇸", "+34", "EUR", "en", "Europe/Madrid", '["sandbox"]', 1, 55],
  ["SD", "السودان", "Sudan", "🇸🇩", "+249", "SDG", "ar", "Africa/Khartoum", '["sandbox"]', 1, 56],
  ["SE", "السويد", "Sweden", "🇸🇪", "+46", "SEK", "en", "Europe/Stockholm", '["sandbox"]', 1, 57],
  ["CH", "سويسرا", "Switzerland", "🇨🇭", "+41", "CHF", "en", "Europe/Zurich", '["sandbox"]', 1, 58],
  ["SY", "سوريا", "Syria", "🇸🇾", "+963", "SYP", "ar", "Asia/Damascus", '["sandbox"]', 1, 59],
  ["TZ", "تنزانيا", "Tanzania", "🇹🇿", "+255", "TZS", "en", "Africa/Dar_es_Salaam", '["sandbox"]', 1, 60],
  ["TH", "تايلاند", "Thailand", "🇹🇭", "+66", "THB", "en", "Asia/Bangkok", '["sandbox"]', 1, 61],
  ["TN", "تونس", "Tunisia", "🇹🇳", "+216", "TND", "ar", "Africa/Tunis", '["sandbox"]', 1, 62],
  ["TR", "تركيا", "Turkey", "🇹🇷", "+90", "TRY", "en", "Europe/Istanbul", '["sandbox"]', 1, 63],
  ["UA", "أوكرانيا", "Ukraine", "🇺🇦", "+380", "UAH", "en", "Europe/Kyiv", '["sandbox"]', 1, 64],
  ["YE", "اليمن", "Yemen", "🇾🇪", "+967", "YER", "ar", "Asia/Aden", '["sandbox"]', 1, 65],
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is unavailable");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const inserted = { regions: 0, cities: 0, categories: 0, pricingVersions: 0, pricingRules: 0, promotions: 0, settings: 0, countries: 0, scopedPricingRules: 0 };

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

  // Upsert launch.policy so relaunching the seed refreshes open-global defaults.
  await connection.execute(
    "UPDATE app_settings SET value = ?, isPublic = 1 WHERE settingKey = ?",
    [JSON.stringify(settings.find((row) => row[0] === "launch.policy")[1]), "launch.policy"],
  );

  try {
    for (const country of worldCountries) {
      await insertIgnore(
        "INSERT IGNORE INTO countries (code, nameAr, nameEn, flagEmoji, dialCode, currency, defaultLocale, timezone, paymentProviders, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)",
        country,
        "countries",
      );
    }

    await insertIgnore(
      "INSERT IGNORE INTO scoped_pricing_rules (publicId, name, scopeType, countryId, categoryId, accountType, adType, basePrice, discountPrice, currency, taxRate, startsAt, endsAt, isActive, priority, createdBy) VALUES ('global-free-launch', 'Global Free Launch', 'global', NULL, NULL, NULL, NULL, 0, NULL, 'SAR', 0, NULL, NULL, 1, 1000, NULL)",
      [],
      "scopedPricingRules",
    );
  } catch (error) {
    // Tables may not exist until migration 0005 is applied.
    console.warn("countries/scoped_pricing_rules seed skipped:", error.message);
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
