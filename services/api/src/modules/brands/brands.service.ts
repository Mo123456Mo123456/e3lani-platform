import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBySlug(slug: string) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            accountType: true,
            bio: true,
            city: true,
            ads: {
              where: { status: 'ACTIVE', deletedAt: null },
              orderBy: { publishedAt: 'desc' },
              take: 50,
              include: {
                currentRevision: { include: { category: true, city: true } },
                media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
            profilePosts: {
              where: { status: 'ACTIVE', deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: {
                media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!brand) throw new NotFoundException('BRAND_NOT_FOUND');

    const adIds = brand.user.ads.map((ad) => ad.id);
    const viewAgg = await this.prisma.analyticsEvent.count({
      where: {
        OR: [
          ...(adIds.length
            ? [{ adId: { in: adIds }, name: { in: ['ad.impression', 'ad.view'] } }]
            : []),
          { name: 'brand.view' },
        ],
      },
    });

    await this.prisma.analyticsEvent.create({
      data: { name: 'brand.view', payload: { slug, brandId: brand.id } },
    });

    return {
      ...brand,
      tabs: ['ads', 'posts'] as const,
      viewCount: viewAgg,
      ads: await Promise.all(
        brand.user.ads.map(async (ad) => ({
          ...ad,
          media: await decorateAdMedia(ad.media),
        })),
      ),
      posts: brand.user.profilePosts,
    };
  }
}
