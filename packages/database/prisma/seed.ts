/**
 * بذر قاعدة البيانات لمنصة «إعلاني».
 *
 *  - البيانات المرجعية (المناطق، المدن، الأقسام، الأسعار، الإعدادات) تُبذر دائمًا.
 *  - البيانات التجريبية تُبذر فقط عندما SEED_DEMO_DATA=true و NODE_ENV != production،
 *    حتى لا تصل أي بيانات ثابتة إلى الإنتاج.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  CATEGORIES, CITIES, DEFAULT_PRICING, DEFAULT_SETTINGS, REGIONS,
} from '@e3lani/config';
import { PrismaClient } from '@prisma/client';

for (const candidate of ['../../../.env', '../../.env', '../.env', '.env']) {
  const path = resolve(__dirname, candidate);
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const seedDemo = process.env.SEED_DEMO_DATA === 'true' && !isProduction;

/* ------------------------------- helpers -------------------------------- */

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
});

const PALETTE = ['#FFC400', '#111111', '#0A7EA4', '#12A150', '#E5484D', '#7C4DFF', '#F5A524'];

async function makePlaceholder(width: number, height: number, index: number): Promise<Buffer> {
  const a = PALETTE[index % PALETTE.length];
  const b = PALETTE[(index + 3) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 5}" fill="#FFFFFF" opacity="0.85"/>
    <rect x="${width * 0.1}" y="${height * 0.78}" width="${width * 0.35}" height="${height * 0.04}" rx="8" fill="#FFFFFF" opacity="0.6"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

let uploadsWorking = true;

async function uploadDemoAsset(key: string, body: Buffer, contentType: string): Promise<boolean> {
  if (!uploadsWorking) return false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? 'e3lani-media',
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return true;
  } catch (error) {
    uploadsWorking = false;
    console.warn(
      `⚠️  تعذّر رفع الوسائط التجريبية إلى التخزين (${(error as Error).message}). ` +
        'سيستمر البذر وستُنشأ السجلات بدون ملفات فعلية.',
    );
    return false;
  }
}

/* ------------------------------ reference ------------------------------- */

async function seedCatalog() {
  console.log('▶ بذر المناطق والمدن…');
  const regionIds = new Map<string, string>();
  for (const region of REGIONS) {
    const row = await prisma.region.upsert({
      where: { slug: region.slug },
      update: { nameAr: region.nameAr, nameEn: region.nameEn },
      create: region,
    });
    regionIds.set(region.slug, row.id);
  }

  let cityOrder = 0;
  for (const city of CITIES) {
    const regionId = regionIds.get(city.regionSlug);
    if (!regionId) continue;
    await prisma.city.upsert({
      where: { slug: city.slug },
      update: {
        nameAr: city.nameAr, nameEn: city.nameEn, regionId,
        lat: city.lat, lng: city.lng, isPopular: Boolean(city.isPopular),
      },
      create: {
        slug: city.slug, nameAr: city.nameAr, nameEn: city.nameEn, regionId,
        lat: city.lat, lng: city.lng, isPopular: Boolean(city.isPopular), sortOrder: cityOrder++,
      },
    });
  }

  console.log('▶ بذر الأقسام والأقسام الفرعية…');
  let parentOrder = 0;
  for (const category of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { nameAr: category.nameAr, nameEn: category.nameEn, icon: category.icon },
      create: {
        slug: category.slug, nameAr: category.nameAr, nameEn: category.nameEn,
        icon: category.icon, sortOrder: parentOrder++,
      },
    });
    let childOrder = 0;
    for (const child of category.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { nameAr: child.nameAr, nameEn: child.nameEn, parentId: parent.id },
        create: {
          slug: child.slug, nameAr: child.nameAr, nameEn: child.nameEn,
          parentId: parent.id, sortOrder: childOrder++,
        },
      });
    }
  }
}

async function seedPricing() {
  console.log('▶ بذر قائمة الأسعار (قابلة للتعديل من لوحة الإدارة)…');
  for (const item of DEFAULT_PRICING) {
    const existing = await prisma.pricingItem.findUnique({ where: { key: item.key } });
    if (existing) continue; // لا نستبدل أسعارًا عدّلها المسؤولون
    await prisma.pricingItem.create({
      data: {
        key: item.key, nameAr: item.nameAr, nameEn: item.nameEn,
        descriptionAr: item.descriptionAr, amountHalalas: item.amountHalalas,
        durationDays: item.durationDays, sortOrder: item.sortOrder,
      },
    });
  }
}

async function seedSettings() {
  console.log('▶ بذر إعدادات التشغيل…');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.appSetting.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.appSetting.create({ data: { key, value: value as any } });
  }
}

async function seedSuperAdmin() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    console.warn('⚠️  تخطّي إنشاء حساب الإدارة: SEED_SUPER_ADMIN_EMAIL/PASSWORD غير مضبوطين.');
    return;
  }
  if (isProduction && password.length < 12) {
    throw new Error('كلمة مرور حساب الإدارة قصيرة جدًا للإنتاج (١٢ حرفًا على الأقل).');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: { email, name: 'مدير النظام', passwordHash, role: 'SUPER_ADMIN' },
  });
  console.log(`▶ حساب الإدارة جاهز: ${email}`);
}

/* -------------------------------- demo ---------------------------------- */

interface DemoUserSpec {
  phone: string;
  name: string;
  accountType: 'INDIVIDUAL' | 'STORE' | 'BRAND' | 'COMPANY';
  citySlug: string;
  email?: string;
  bio?: string;
  storeUrl?: string;
  verified?: boolean;
}

const DEMO_USERS: DemoUserSpec[] = [
  { phone: '966500000001', name: 'سعود العتيبي', accountType: 'INDIVIDUAL', citySlug: 'riyadh' },
  {
    phone: '966500000002', name: 'متجر نجد للأثاث', accountType: 'STORE', citySlug: 'riyadh',
    email: 'store@example.sa', bio: 'أثاث منزلي ومجالس عربية بجودة عالية وتوصيل داخل الرياض.',
    storeUrl: 'https://najd-furniture.salla.sa', verified: true,
  },
  {
    phone: '966500000003', name: 'براند رمال', accountType: 'BRAND', citySlug: 'jeddah',
    email: 'brand@example.sa', bio: 'براند سعودي للعطور والبخور المستوحى من الصحراء.',
    storeUrl: 'https://rimal.zid.sa', verified: true,
  },
  {
    phone: '966500000004', name: 'شركة الخليج للمعدات', accountType: 'COMPANY', citySlug: 'dammam',
    email: 'company@example.sa', bio: 'تأجير وبيع المعدات الثقيلة في المنطقة الشرقية.',
  },
];

const DEMO_ADS = [
  { title: 'مجلس عربي فاخر ٨ قطع', categorySlug: 'furniture', subSlug: 'fu-living', citySlug: 'riyadh', price: 4500, owner: 1, contactMethod: 'WHATSAPP' as const, contactValue: '966500000002', highlighted: true },
  { title: 'عطر رمال الشرقي ١٠٠ مل', categorySlug: 'productive-families', subSlug: 'pf-perfumes', citySlug: 'jeddah', price: 320, owner: 2, contactMethod: 'STORE_LINK' as const, contactValue: 'https://rimal.zid.sa', highlighted: true },
  { title: 'كامري ٢٠٢٢ فل كامل', categorySlug: 'cars', subSlug: 'cars-used', citySlug: 'riyadh', price: 96000, owner: 0, contactMethod: 'PHONE' as const, contactValue: '966500000001' },
  { title: 'شقة ٣ غرف حي الياسمين', categorySlug: 'real-estate', subSlug: 're-apartments', citySlug: 'riyadh', price: 850000, owner: 0, contactMethod: 'WHATSAPP' as const, contactValue: '966500000001' },
  { title: 'رافعة شوكية للإيجار اليومي', categorySlug: 'equipment', subSlug: 'eq-heavy', citySlug: 'dammam', price: null, owner: 3, contactMethod: 'PHONE' as const, contactValue: '966500000004' },
  { title: 'آيفون ١٥ برو ماكس ٢٥٦ جيجا', categorySlug: 'electronics', subSlug: 'el-phones', citySlug: 'jeddah', price: 4100, owner: 0, contactMethod: 'WHATSAPP' as const, contactValue: '966500000001' },
  { title: 'دورة تصوير احترافي بالجوال', categorySlug: 'education', subSlug: 'ed-courses', citySlug: 'riyadh', price: 600, owner: 2, contactMethod: 'EXTERNAL_LINK' as const, contactValue: 'https://linktr.ee/rimal-course' },
  { title: 'خدمة نقل عفش داخل الدمام', categorySlug: 'services', subSlug: 'sv-moving', citySlug: 'dammam', price: null, owner: 3, contactMethod: 'PHONE' as const, contactValue: '966500000004' },
];

async function createDemoMedia(
  ownerId: string,
  purpose: 'AD' | 'POST' | 'AVATAR' | 'LOGO' | 'COVER' | 'TICKER_LOGO',
  index: number,
  width: number,
  height: number,
) {
  const buffer = await makePlaceholder(width, height, index);
  const key = `demo/${purpose.toLowerCase()}/${ownerId}-${index}-${width}x${height}.jpg`;
  await uploadDemoAsset(key, buffer, 'image/jpeg');
  return prisma.mediaAsset.create({
    data: {
      ownerId,
      type: 'IMAGE',
      status: 'READY',
      purpose,
      originalKey: key,
      playbackKey: key,
      thumbnailKey: key,
      mimeType: 'image/jpeg',
      sizeBytes: buffer.byteLength,
      width,
      height,
      processedAt: new Date(),
      variants: [{ name: 'large', key, width, height }],
    },
  });
}

async function seedDemoData() {
  console.log('▶ بذر البيانات التجريبية (وضع التطوير فقط)…');
  const cities = await prisma.city.findMany();
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const categories = await prisma.category.findMany();
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  const users: { id: string }[] = [];
  let mediaIndex = 0;

  for (const spec of DEMO_USERS) {
    const city = cityBySlug.get(spec.citySlug)!;
    const user = await prisma.user.upsert({
      where: { phone: spec.phone },
      update: {},
      create: {
        phone: spec.phone,
        name: spec.name,
        email: spec.email,
        accountType: spec.accountType,
        cityId: city.id,
        profileCompleted: true,
        isVerified: Boolean(spec.verified),
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });
    users.push(user);

    if (!user.avatarMediaId) {
      const avatar = await createDemoMedia(user.id, 'AVATAR', mediaIndex++, 512, 512);
      await prisma.user.update({ where: { id: user.id }, data: { avatarMediaId: avatar.id } });
    }

    if (spec.accountType !== 'INDIVIDUAL') {
      const existing = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
      if (!existing) {
        const logo = await createDemoMedia(user.id, 'LOGO', mediaIndex++, 600, 600);
        const cover = await createDemoMedia(user.id, 'COVER', mediaIndex++, 1600, 600);
        await prisma.businessProfile.create({
          data: {
            userId: user.id,
            displayName: spec.name,
            bio: spec.bio,
            storeUrl: spec.storeUrl,
            whatsapp: spec.phone,
            contactPhone: spec.phone,
            logoMediaId: logo.id,
            coverMediaId: cover.id,
            verifiedAt: spec.verified ? new Date() : null,
            socials: spec.verified ? { instagram: 'https://instagram.com/e3lani' } : undefined,
          },
        });
      }
    }
  }

  const existingAds = await prisma.ad.count();
  if (existingAds === 0) {
    const now = Date.now();
    for (const [index, spec] of DEMO_ADS.entries()) {
      const owner = users[spec.owner]!;
      const city = cityBySlug.get(spec.citySlug)!;
      const category = categoryBySlug.get(spec.categorySlug)!;
      const subcategory = categoryBySlug.get(spec.subSlug);
      const publishedAt = new Date(now - index * 3600_000);
      const ad = await prisma.ad.create({
        data: {
          userId: owner.id,
          title: spec.title,
          description: 'إعلان تجريبي لبيئة التطوير — يمكن حذفه بأمان من لوحة الإدارة.',
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          cityId: city.id,
          reachScope: index % 3 === 0 ? 'KINGDOM' : 'CITY',
          price: spec.price ?? null,
          status: 'ACTIVE',
          contactMethod: spec.contactMethod,
          contactValue: spec.contactValue,
          publishedAt,
          lastBumpedAt: publishedAt,
          expiresAt: new Date(now + 30 * 86_400_000),
          highlightUntil: spec.highlighted ? new Date(now + 3 * 86_400_000) : null,
          viewsCount: 40 + index * 17,
          impressionsCount: 120 + index * 53,
        },
      });
      const imageCount = (index % 3) + 1;
      for (let i = 0; i < imageCount; i += 1) {
        const media = await createDemoMedia(owner.id, 'AD', mediaIndex++, 1080, 1350);
        await prisma.adMedia.create({ data: { adId: ad.id, mediaId: media.id, order: i } });
      }
    }
  }

  const existingPosts = await prisma.post.count();
  if (existingPosts === 0) {
    for (const [index, owner] of users.slice(1).entries()) {
      const post = await prisma.post.create({
        data: {
          userId: owner.id,
          caption: 'منشور مجاني يظهر داخل صفحة الحساب فقط ولا يظهر في موجز الإعلانات.',
          viewsCount: 12 + index * 5,
        },
      });
      const media = await createDemoMedia(owner.id, 'POST', mediaIndex++, 1080, 1080);
      await prisma.postMedia.create({ data: { postId: post.id, mediaId: media.id, order: 0 } });
    }
  }

  const existingTicker = await prisma.tickerRequest.count();
  if (existingTicker === 0) {
    for (const [index, owner] of users.slice(1).entries()) {
      const logo = await createDemoMedia(owner.id, 'TICKER_LOGO', mediaIndex++, 320, 160);
      await prisma.tickerRequest.create({
        data: {
          userId: owner.id,
          businessName: DEMO_USERS[index + 1]!.name,
          logoMediaId: logo.id,
          status: 'ACTIVE',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 86_400_000),
          sortWeight: index,
          reviewNote: 'اعتماد تجريبي',
        },
      });
    }
  }
}

/* -------------------------------- main ---------------------------------- */

async function main() {
  console.log('=== بذر قاعدة بيانات «إعلاني» ===');
  await seedCatalog();
  await seedPricing();
  await seedSettings();
  await seedSuperAdmin();
  if (seedDemo) {
    await seedDemoData();
  } else {
    console.log('▶ تخطّي البيانات التجريبية (SEED_DEMO_DATA غير مفعّل أو بيئة إنتاج).');
  }
  console.log('✅ اكتمل البذر بنجاح.');
}

main()
  .catch((error) => {
    console.error('❌ فشل البذر:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
