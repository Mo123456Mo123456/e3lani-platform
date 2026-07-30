import { AccountType, PrismaClient, StaffRole } from "@prisma/client";

const prisma = new PrismaClient();

const categorySeeds = [
  ["cars", "السيارات", "Cars", ["new-cars", "used-cars", "parts"]],
  ["real-estate", "العقارات", "Real estate", ["sale", "rent", "land"]],
  ["electronics", "الإلكترونيات", "Electronics", ["phones", "computers", "appliances"]],
  ["furniture", "الأثاث", "Furniture", ["home", "office"]],
  ["fashion", "الأزياء", "Fashion", ["men", "women", "kids"]],
  ["services", "الخدمات", "Services", ["business", "maintenance"]],
  ["jobs", "الوظائف", "Jobs", ["full-time", "part-time"]],
  ["equipment", "المعدات", "Equipment", ["heavy", "tools"]],
  ["permitted-animals", "الحيوانات المسموح بها", "Permitted animals", ["pets", "livestock"]],
  ["games", "الألعاب", "Games", ["video-games", "toys"]],
  ["rentals", "التأجير", "Rentals", ["vehicles", "equipment-rental"]],
  ["home-products", "المنتجات المنزلية", "Home products", ["kitchen", "decor"]],
  ["productive-families", "الأسر المنتجة", "Productive families", ["food", "crafts"]],
  ["tickets", "التذاكر", "Tickets", ["events", "travel-tickets"]],
  ["health-beauty", "الصحة والجمال", "Health & beauty", ["beauty", "fitness"]],
  ["education", "التعليم", "Education", ["courses", "tutors"]],
  ["travel", "السفر", "Travel", ["stays", "trips"]],
  ["restaurants", "المطاعم", "Restaurants", ["restaurants-list", "catering"]],
  ["brands", "البراندات", "Brands", ["local-brands", "international-brands"]],
  ["exchange-donation", "التبادل والتبرع", "Exchange & donation", ["exchange", "donation"]],
  ["other", "أخرى", "Other", ["miscellaneous"]],
] as const;

const subcategoryNames: Record<string, [string, string]> = {
  "new-cars": ["سيارات جديدة", "New cars"],
  "used-cars": ["سيارات مستعملة", "Used cars"],
  parts: ["قطع غيار", "Parts"],
  sale: ["للبيع", "For sale"],
  rent: ["للإيجار", "For rent"],
  land: ["أراضٍ", "Land"],
  phones: ["جوالات", "Phones"],
  computers: ["حواسيب", "Computers"],
  appliances: ["أجهزة", "Appliances"],
  home: ["منزلي", "Home"],
  office: ["مكتبي", "Office"],
  men: ["رجالي", "Men"],
  women: ["نسائي", "Women"],
  kids: ["أطفال", "Kids"],
};

async function seedCatalog() {
  const regions = [
    ["riyadh-region", "منطقة الرياض", "Riyadh Region", ["riyadh", "diriyah"]],
    ["makkah-region", "منطقة مكة المكرمة", "Makkah Region", ["jeddah", "makkah"]],
    ["eastern-region", "المنطقة الشرقية", "Eastern Region", ["dammam", "khobar"]],
    ["madinah-region", "منطقة المدينة المنورة", "Madinah Region", ["madinah"]],
  ] as const;

  for (const [slug, nameAr, nameEn, cities] of regions) {
    const region = await prisma.region.upsert({
      where: { slug },
      update: { nameAr, nameEn },
      create: { slug, nameAr, nameEn },
    });
    for (const citySlug of cities) {
      const cityNames: Record<string, [string, string]> = {
        riyadh: ["الرياض", "Riyadh"],
        diriyah: ["الدرعية", "Diriyah"],
        jeddah: ["جدة", "Jeddah"],
        makkah: ["مكة المكرمة", "Makkah"],
        dammam: ["الدمام", "Dammam"],
        khobar: ["الخبر", "Khobar"],
        madinah: ["المدينة المنورة", "Madinah"],
      };
      const [cityAr, cityEn] = cityNames[citySlug]!;
      await prisma.city.upsert({
        where: { slug: citySlug },
        update: { nameAr: cityAr, nameEn: cityEn, regionId: region.id, active: true },
        create: { slug: citySlug, nameAr: cityAr, nameEn: cityEn, regionId: region.id },
      });
    }
  }

  for (const [slug, nameAr, nameEn, children] of categorySeeds) {
    const parent = await prisma.category.upsert({
      where: { slug },
      update: { nameAr, nameEn, active: true },
      create: { slug, nameAr, nameEn },
    });
    for (const childSlug of children) {
      const [childAr, childEn] = subcategoryNames[childSlug] ?? [
        childSlug.replaceAll("-", " "),
        childSlug.replaceAll("-", " "),
      ];
      await prisma.category.upsert({
        where: { slug: childSlug },
        update: { parentId: parent.id, nameAr: childAr, nameEn: childEn, active: true },
        create: { slug: childSlug, parentId: parent.id, nameAr: childAr, nameEn: childEn },
      });
    }
  }
}

async function seedPricingAndSettings() {
  const prices = [
    ["STANDARD_AD", "إعلان عادي", "Standard ad", 5900, 30],
    ["REPUBLISH", "إعادة نشر ورفع للأحدث", "Republish and bump", 500, null],
    ["EXTEND_15_DAYS", "تمديد 15 يومًا", "Extend 15 days", 500, 15],
    ["HIGHLIGHT_3_DAYS", "إبراز 3 أيام", "Highlight 3 days", 1000, 3],
    ["HIGHLIGHT_7_DAYS", "إبراز 7 أيام", "Highlight 7 days", 2000, 7],
    ["TOP_CATEGORY", "الظهور أعلى القسم", "Top of category", 1500, null],
    ["EXTRA_CITY", "استهداف مدينة إضافية", "Extra city targeting", 500, null],
    ["TOP_STRIP_LOGO", "إضافة شعار للشريط العلوي", "Top strip logo", 5000, null],
  ] as const;

  for (const [code, nameAr, nameEn, priceHalalas, durationDays] of prices) {
    await prisma.pricingItem.upsert({
      where: { code },
      update: { nameAr, nameEn, priceHalalas, durationDays, enabled: true },
      create: { code, nameAr, nameEn, priceHalalas, durationDays, enabled: true },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "platform.mode" },
    update: { value: "FREE_LAUNCH" },
    create: {
      key: "platform.mode",
      value: "FREE_LAUNCH",
      description: "FREE_LAUNCH publishes valid advertisements directly without payment.",
    },
  });
  await prisma.appSetting.upsert({
    where: { key: "payments.enabled" },
    update: { value: false },
    create: { key: "payments.enabled", value: false },
  });
}

async function seedSandboxAdmin() {
  if (process.env.NODE_ENV === "production") return;
  const phone = process.env.SEED_SANDBOX_ADMIN_PHONE;
  if (!phone) return;
  await prisma.user.upsert({
    where: { phone },
    update: { staffRole: StaffRole.SUPER_ADMIN, status: "ACTIVE" },
    create: {
      phone,
      name: process.env.SEED_SANDBOX_ADMIN_NAME ?? "Sandbox Admin",
      accountType: AccountType.COMPANY,
      staffRole: StaffRole.SUPER_ADMIN,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });
}

async function main() {
  await seedCatalog();
  await seedPricingAndSettings();
  await seedSandboxAdmin();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
