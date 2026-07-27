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
            ads: {
              where: { status: 'ACTIVE', deletedAt: null },
              orderBy: { publishedAt: 'desc' },
              take: 50,
              include: {
                currentRevision: { include: { category: true, city: true } },
                media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!brand) throw new NotFoundException('BRAND_NOT_FOUND');
    return {
      ...brand,
      ads: await Promise.all(
        brand.user.ads.map(async (ad) => ({
          ...ad,
          media: await decorateAdMedia(ad.media),
        })),
      ),
    };
  }
}
