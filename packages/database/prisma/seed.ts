import { AccountType, PrismaClient, StaffRole } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  ["cars", "السيارات", "Cars"],
  ["real-estate", "العقارات", "Real estate"],
  ["electronics", "الإلكترونيات", "Electronics"],
  ["furniture", "الأثاث", "Furniture"],
  ["fashion", "الأزياء", "Fashion"],
  ["services", "الخدمات", "Services"],
  ["jobs", "الوظائف", "Jobs"],
  ["equipment", "المعدات", "Equipment"],
  ["allowed-animals", "الحيوانات المسموح بها", "Allowed animals"],
  ["games", "الألعاب", "Games"],
  ["rentals", "التأجير", "Rentals"],
  ["home-products", "المنتجات المنزلية", "Home products"],
  ["productive-families", "الأسر المنتجة", "Productive families"],
  ["tickets", "التذاكر", "Tickets"],
  ["health-beauty", "الصحة والجمال", "Health and beauty"],
  ["education", "التعليم", "Education"],
  ["travel", "السفر", "Travel"],
  ["restaurants", "المطاعم", "Restaurants"],
  ["brands", "البراندات", "Brands"],
  ["exchange-donation", "التبادل والتبرع", "Exchange and donation"],
  ["other", "أخرى", "Other"]
] as const;

const prices = [
  ["AD_30_DAYS", "إعلان عادي - 30 يومًا", "Standard ad - 30 days", 5900],
  ["REPUBLISH", "إعادة نشر ورفع للأحدث", "Republish and bump", 500],
  ["EXTEND_15_DAYS", "تمديد 15 يومًا", "Extend 15 days", 500],
  ["FEATURE_3_DAYS", "إبراز 3 أيام", "Feature for 3 days", 1000],
  ["FEATURE_7_DAYS", "إبراز 7 أيام", "Feature for 7 days", 2000],
  ["TOP_CATEGORY", "الظهور أعلى القسم", "Top of category", 1500],
  ["EXTRA_CITY", "استهداف مدينة إضافية", "Additional city", 500],
  ["TOP_STRIP_LOGO", "إضافة شعار للشريط العلوي", "Top strip logo", 5000]
] as const;

async function main() {
  const region = await prisma.region.upsert({
    where: { slug: "riyadh-region" },
    update: { active: true },
    create: { slug: "riyadh-region", nameAr: "منطقة الرياض", nameEn: "Riyadh Region" }
  });

  for (const [slug, nameAr, nameEn] of [
    ["riyadh", "الرياض", "Riyadh"],
    ["diriyah", "الدرعية", "Diriyah"],
    ["alkharj", "الخرج", "Al Kharj"]
  ] as const) {
    await prisma.city.upsert({
      where: { slug },
      update: { nameAr, nameEn, regionId: region.id, active: true },
      create: { slug, nameAr, nameEn, regionId: region.id }
    });
  }

  for (const [sortOrder, [slug, nameAr, nameEn]] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { nameAr, nameEn, sortOrder, active: true },
      create: { slug, nameAr, nameEn, sortOrder }
    });
    await prisma.category.upsert({
      where: { slug: `${slug}-general` },
      update: { parentId: category.id, active: true },
      create: {
        parentId: category.id,
        slug: `${slug}-general`,
        nameAr: "عام",
        nameEn: "General"
      }
    });
  }

  for (const [code, nameAr, nameEn, amountHalalas] of prices) {
    await prisma.price.upsert({
      where: { code },
      update: { nameAr, nameEn },
      create: { code, nameAr, nameEn, amountHalalas }
    });
  }

  await prisma.platformSetting.upsert({
    where: { key: "publishing" },
    update: {},
    create: {
      key: "publishing",
      value: {
        mode: "FREE_LAUNCH",
        paymentsEnabled: false,
        automaticModeration: true,
        adDurationDays: 30
      }
    }
  });

  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "+966500000001";
  const adminName = process.env.SEED_ADMIN_NAME ?? "مدير إعلاني";
  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { staffRole: StaffRole.SUPER_ADMIN, status: "ACTIVE" },
    create: {
      phone: adminPhone,
      name: adminName,
      accountType: AccountType.INDIVIDUAL,
      staffRole: StaffRole.SUPER_ADMIN,
      profileCompletedAt: new Date(),
      acceptedTermsAt: new Date()
    }
  });
}

main()
  .then(() => console.info("E3lani seed completed"))
  .finally(() => prisma.$disconnect());
