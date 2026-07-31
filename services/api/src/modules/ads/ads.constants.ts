import type { Prisma } from '@e3lani/database';

/** الحقول المطلوبة لعرض الإعلان في الموجز وصفحة التفاصيل. */
export const AD_INCLUDE = {
  city: { select: { id: true, nameAr: true, nameEn: true, lat: true, lng: true } },
  category: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
  subcategory: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
  media: { include: { media: true }, orderBy: { order: 'asc' } },
  extraCities: { select: { cityId: true } },
  user: {
    select: {
      id: true, name: true, accountType: true, isVerified: true, cityId: true,
      avatarMedia: true,
      city: { select: { id: true, nameAr: true, nameEn: true } },
      business: {
        select: {
          displayName: true, bio: true, storeUrl: true, websiteUrl: true, whatsapp: true,
          contactPhone: true, socials: true, verifiedAt: true,
          logoMedia: true, coverMedia: true,
        },
      },
    },
  },
} satisfies Prisma.AdInclude;
