import { AccountType, prisma, Role } from "../src/index";

const regions = [
  { code: "riyadh-region", nameAr: "منطقة الرياض", nameEn: "Riyadh Region" },
  { code: "makkah-region", nameAr: "منطقة مكة المكرمة", nameEn: "Makkah Region" },
  { code: "eastern-region", nameAr: "المنطقة الشرقية", nameEn: "Eastern Region" },
  { code: "madinah-region", nameAr: "منطقة المدينة المنورة", nameEn: "Madinah Region" },
  { code: "qassim-region", nameAr: "منطقة القصيم", nameEn: "Qassim Region" },
  { code: "asir-region", nameAr: "منطقة عسير", nameEn: "Asir Region" },
] as const;

const cities = [
  ["riyadh", "الرياض", "Riyadh", "riyadh-region"],
  ["jeddah", "جدة", "Jeddah", "makkah-region"],
  ["makkah", "مكة المكرمة", "Makkah", "makkah-region"],
  ["dammam", "الدمام", "Dammam", "eastern-region"],
  ["khobar", "الخبر", "Khobar", "eastern-region"],
  ["madinah", "المدينة المنورة", "Madinah", "madinah-region"],
  ["buraydah", "بريدة", "Buraydah", "qassim-region"],
  ["abha", "أبها", "Abha", "asir-region"],
] as const;

const categories = [
  ["cars", "السيارات", "Cars", "directions_car"],
  ["real-estate", "العقارات", "Real estate", "home_work"],
  ["electronics", "الإلكترونيات", "Electronics", "devices"],
  ["furniture", "الأثاث", "Furniture", "chair"],
  ["fashion", "الأزياء", "Fashion", "checkroom"],
  ["services", "الخدمات", "Services", "handyman"],
  ["jobs", "الوظائف", "Jobs", "work"],
  ["equipment", "المعدات", "Equipment", "construction"],
  ["allowed-animals", "الحيوانات المسموح بها", "Allowed animals", "pets"],
  ["games", "الألعاب", "Games", "sports_esports"],
  ["rentals", "التأجير", "Rentals", "key"],
  ["home-products", "المنتجات المنزلية", "Home products", "kitchen"],
  ["productive-families", "الأسر المنتجة", "Productive families", "bakery_dining"],
  ["tickets", "التذاكر", "Tickets", "confirmation_number"],
  ["health-beauty", "الصحة والجمال", "Health & beauty", "spa"],
  ["education", "التعليم", "Education", "school"],
  ["travel", "السفر", "Travel", "flight"],
  ["restaurants", "المطاعم", "Restaurants", "restaurant"],
  ["brands", "البراندات", "Brands", "verified"],
  ["exchange-donation", "التبادل والتبرع", "Exchange & donation", "volunteer_activism"],
  ["other", "أخرى", "Other", "category"],
] as const;

const subcategories: Record<string, [string, string, string][]> = {
  cars: [
    ["cars-new", "سيارات جديدة", "New cars"],
    ["cars-used", "سيارات مستعملة", "Used cars"],
    ["car-parts", "قطع غيار", "Car parts"],
  ],
  "real-estate": [
    ["apartments", "شقق", "Apartments"],
    ["villas", "فلل", "Villas"],
    ["lands", "أراضٍ", "Land"],
  ],
  electronics: [
    ["phones", "جوالات", "Phones"],
    ["computers", "حواسيب", "Computers"],
    ["cameras", "كاميرات", "Cameras"],
  ],
  services: [
    ["maintenance", "صيانة", "Maintenance"],
    ["design", "تصميم", "Design"],
    ["transport", "نقل", "Transport"],
  ],
};

const pricingRules = [
  ["standard_ad", "إعلان عادي", "Standard ad", 5900, 30],
  ["republish", "إعادة نشر ورفع للأحدث", "Republish and bump", 500, null],
  ["extend_15", "تمديد 15 يومًا", "Extend 15 days", 500, 15],
  ["highlight_3", "إبراز 3 أيام", "Highlight 3 days", 1000, 3],
  ["highlight_7", "إبراز 7 أيام", "Highlight 7 days", 2000, 7],
  ["top_category", "الظهور أعلى القسم", "Top of category", 1500, null],
  ["extra_city", "استهداف مدينة إضافية", "Additional city", 500, null],
  ["ticker_logo", "إضافة شعار للشريط العلوي", "Top ticker logo", 5000, null],
] as const;

async function seed() {
  const regionIds = new Map<string, string>();
  for (const [sortOrder, region] of regions.entries()) {
    const row = await prisma.region.upsert({
      where: { code: region.code },
      update: { ...region, sortOrder, active: true },
      create: { ...region, sortOrder },
    });
    regionIds.set(region.code, row.id);
  }

  for (const [sortOrder, [code, nameAr, nameEn, regionCode]] of cities.entries()) {
    await prisma.city.upsert({
      where: { code },
      update: { nameAr, nameEn, regionId: regionIds.get(regionCode)!, sortOrder, active: true },
      create: { code, nameAr, nameEn, regionId: regionIds.get(regionCode)!, sortOrder },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const [sortOrder, [slug, nameAr, nameEn, icon]] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug },
      update: { nameAr, nameEn, icon, sortOrder, active: true },
      create: { slug, nameAr, nameEn, icon, sortOrder },
    });
    categoryIds.set(slug, row.id);
  }

  for (const [parentSlug, children] of Object.entries(subcategories)) {
    for (const [sortOrder, [slug, nameAr, nameEn]] of children.entries()) {
      await prisma.category.upsert({
        where: { slug },
        update: { nameAr, nameEn, parentId: categoryIds.get(parentSlug)!, sortOrder, active: true },
        create: { slug, nameAr, nameEn, parentId: categoryIds.get(parentSlug)!, sortOrder },
      });
    }
  }

  const pricing = await prisma.pricingVersion.upsert({
    where: { version: 1 },
    update: { active: true },
    create: { version: 1, active: true, effectiveFrom: new Date() },
  });
  await prisma.pricingVersion.updateMany({
    where: { id: { not: pricing.id } },
    data: { active: false },
  });
  for (const [code, nameAr, nameEn, priceHalalas, durationDays] of pricingRules) {
    await prisma.pricingRule.upsert({
      where: { pricingVersionId_code: { pricingVersionId: pricing.id, code } },
      update: { nameAr, nameEn, priceHalalas, durationDays, active: true },
      create: {
        pricingVersionId: pricing.id,
        code,
        nameAr,
        nameEn,
        priceHalalas,
        durationDays,
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "platform.mode" },
    update: {},
    create: {
      key: "platform.mode",
      value: "FREE_LAUNCH",
      public: true,
      description: "Controls profile-only, free launch, or paid advertising.",
    },
  });
  await prisma.appSetting.upsert({
    where: { key: "payments.enabled" },
    update: {},
    create: {
      key: "payments.enabled",
      value: false,
      public: true,
      description: "A real provider and verified webhook are required before enabling.",
    },
  });
  await prisma.appSetting.upsert({
    where: { key: "ads.defaultDurationDays" },
    update: {},
    create: { key: "ads.defaultDurationDays", value: 30, public: true },
  });
  await prisma.appSetting.upsert({
    where: { key: "links.allowedDomains" },
    update: {},
    create: {
      key: "links.allowedDomains",
      value: [],
      public: false,
      description: "Approved HTTPS domains for EXTERNAL_URL contacts.",
    },
  });

  if (process.env.SEED_SANDBOX === "true") {
    const city = await prisma.city.findUniqueOrThrow({ where: { code: "riyadh" } });
    const admin = await prisma.user.upsert({
      where: { phone: "+966500000001" },
      update: { status: "ACTIVE" },
      create: {
        phone: "+966500000001",
        email: "admin@e3lani.local",
        phoneVerifiedAt: new Date(),
        acceptedPrivacyAt: new Date(),
        acceptedTermsAt: new Date(),
        profile: {
          create: {
            name: "مدير إعلاني",
            slug: "sandbox-admin",
            accountType: AccountType.COMPANY,
            cityId: city.id,
          },
        },
      },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: admin.id, role: Role.SUPER_ADMIN } },
      update: {},
      create: { userId: admin.id, role: Role.SUPER_ADMIN },
    });
  }
}

seed()
  .then(() => console.info("E3lani seed completed"))
  .finally(() => prisma.$disconnect());
