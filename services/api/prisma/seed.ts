import { PrismaClient } from '@prisma/client';
import { DEFAULT_SA_PRICING } from '@e3lani/types';

const prisma = new PrismaClient();

const CATEGORIES: Array<{ slug: string; nameAr: string; nameEn: string; iconKey: string; sortOrder: number }> = [
  { slug: 'cars', nameAr: 'السيارات', nameEn: 'Cars', iconKey: 'car', sortOrder: 1 },
  { slug: 'real-estate', nameAr: 'العقارات', nameEn: 'Real Estate', iconKey: 'home', sortOrder: 2 },
  { slug: 'electronics', nameAr: 'الإلكترونيات', nameEn: 'Electronics', iconKey: 'cpu', sortOrder: 3 },
  { slug: 'furniture', nameAr: 'الأثاث', nameEn: 'Furniture', iconKey: 'sofa', sortOrder: 4 },
  { slug: 'fashion', nameAr: 'الأزياء', nameEn: 'Fashion', iconKey: 'shirt', sortOrder: 5 },
  { slug: 'services', nameAr: 'الخدمات', nameEn: 'Services', iconKey: 'wrench', sortOrder: 6 },
  { slug: 'jobs', nameAr: 'الوظائف', nameEn: 'Jobs', iconKey: 'briefcase', sortOrder: 7 },
  { slug: 'equipment', nameAr: 'المعدات', nameEn: 'Equipment', iconKey: 'tool', sortOrder: 8 },
  { slug: 'pets', nameAr: 'حيوانات مسموحة', nameEn: 'Allowed pets', iconKey: 'paw', sortOrder: 9 },
  { slug: 'games', nameAr: 'الألعاب', nameEn: 'Games', iconKey: 'gamepad', sortOrder: 10 },
  { slug: 'rentals', nameAr: 'تأجير', nameEn: 'Rentals', iconKey: 'key', sortOrder: 11 },
  { slug: 'home', nameAr: 'منتجات منزلية', nameEn: 'Home supplies', iconKey: 'box', sortOrder: 12 },
  { slug: 'home-business', nameAr: 'أسر منتجة', nameEn: 'Home businesses', iconKey: 'store', sortOrder: 13 },
  { slug: 'tickets', nameAr: 'تذاكر', nameEn: 'Tickets', iconKey: 'ticket', sortOrder: 14 },
  { slug: 'health-beauty', nameAr: 'صحة وجمال', nameEn: 'Health & Beauty', iconKey: 'sparkles', sortOrder: 15 },
  { slug: 'education', nameAr: 'تعليم', nameEn: 'Education', iconKey: 'book', sortOrder: 16 },
  { slug: 'travel', nameAr: 'سفر', nameEn: 'Travel', iconKey: 'plane', sortOrder: 17 },
  { slug: 'restaurants', nameAr: 'مطاعم وكافيهات', nameEn: 'Restaurants & Cafes', iconKey: 'utensils', sortOrder: 18 },
  { slug: 'brands', nameAr: 'البراندات', nameEn: 'Brands', iconKey: 'badge', sortOrder: 19 },
  { slug: 'exchange-donate', nameAr: 'تبادل / تبرع', nameEn: 'Exchange / Donate', iconKey: 'handshake', sortOrder: 20 },
  { slug: 'other', nameAr: 'أخرى', nameEn: 'Other', iconKey: 'more', sortOrder: 21 },
];

const SA_CITIES = [
  { slug: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', latitude: 24.7136, longitude: 46.6753 },
  { slug: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', latitude: 21.4858, longitude: 39.1925 },
  { slug: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', latitude: 26.4207, longitude: 50.0888 },
  { slug: 'makkah', nameAr: 'مكة', nameEn: 'Makkah', latitude: 21.3891, longitude: 39.8579 },
  { slug: 'madinah', nameAr: 'المدينة', nameEn: 'Madinah', latitude: 24.5247, longitude: 39.5692 },
];

async function main() {
  await prisma.country.upsert({
    where: { code: 'SA' },
    create: {
      code: 'SA',
      nameAr: 'السعودية',
      nameEn: 'Saudi Arabia',
      currency: 'SAR',
      sortOrder: 1,
    },
    update: {},
  });

  for (const city of SA_CITIES) {
    await prisma.city.upsert({
      where: { countryCode_slug: { countryCode: 'SA', slug: city.slug } },
      create: { countryCode: 'SA', ...city },
      update: { nameAr: city.nameAr, nameEn: city.nameEn },
    });
  }

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, countryCode: 'SA' },
      update: {
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        iconKey: category.iconKey,
        sortOrder: category.sortOrder,
      },
    });
  }

  const pricing = await prisma.pricingVersion.upsert({
    where: { code: 'sa-default-2026-07' },
    create: { code: 'sa-default-2026-07', isActive: true },
    update: { isActive: true },
  });

  for (const [sku, item] of Object.entries(DEFAULT_SA_PRICING)) {
    await prisma.pricingItem.upsert({
      where: {
        pricingVersionId_sku_countryCode: {
          pricingVersionId: pricing.id,
          sku,
          countryCode: 'SA',
        },
      },
      create: {
        pricingVersionId: pricing.id,
        sku,
        countryCode: 'SA',
        currency: item.currency,
        amount: item.amount,
        durationDays: item.durationDays,
        labelAr: item.labelAr,
        labelEn: item.labelEn,
      },
      update: {
        amount: item.amount,
        labelAr: item.labelAr,
        labelEn: item.labelEn,
        durationDays: item.durationDays,
      },
    });
  }

  // Sandbox provider enabled for local/testing. Real providers stay disabled (fail-closed).
  const providers = [
    {
      name: 'sandbox',
      countries: ['SA', '*'],
      currencies: ['SAR', 'AED', 'USD'],
      channels: ['hosted_checkout'],
      priority: 1,
      enabled: true,
    },
    {
      name: 'moyasar',
      countries: ['SA'],
      currencies: ['SAR'],
      channels: ['hosted_checkout'],
      priority: 10,
      enabled: false,
    },
    {
      name: 'myfatoorah',
      countries: ['SA', 'AE', 'KW', 'BH', 'QA', 'OM'],
      currencies: ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR'],
      channels: ['hosted_checkout'],
      priority: 20,
      enabled: false,
    },
  ];

  for (const provider of providers) {
    await prisma.paymentProviderConfig.upsert({
      where: { name: provider.name },
      create: {
        name: provider.name,
        countries: provider.countries,
        currencies: provider.currencies,
        channels: provider.channels,
        priority: provider.priority,
        enabled: provider.enabled,
        mode: 'sandbox',
      },
      update: {
        countries: provider.countries,
        currencies: provider.currencies,
        enabled: provider.enabled,
        priority: provider.priority,
      },
    });
  }

  console.log(
    'Seed completed: SA geo, 21 categories, pricing 19 SAR, sandbox payment provider enabled',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
