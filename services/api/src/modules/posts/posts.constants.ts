import type { Prisma } from '@e3lani/database';

export const POST_INCLUDE = {
  media: { include: { media: true }, orderBy: { order: 'asc' } },
  user: {
    select: {
      id: true, name: true, accountType: true, isVerified: true, cityId: true,
      avatarMedia: true,
      city: { select: { id: true, nameAr: true, nameEn: true } },
      business: {
        select: {
          displayName: true, bio: true, storeUrl: true, websiteUrl: true, whatsapp: true,
          contactPhone: true, socials: true, verifiedAt: true, logoMedia: true, coverMedia: true,
        },
      },
    },
  },
} satisfies Prisma.PostInclude;
