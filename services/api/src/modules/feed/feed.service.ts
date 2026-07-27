import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  private async page(args: {
    cursor?: string;
    take: number;
    orderBy: object | object[];
  }) {
    const items = await this.prisma.ad.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: args.take + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      orderBy: args.orderBy as never,
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: {
          select: {
            id: true,
            displayName: true,
            brandProfile: {
              select: { nameAr: true, nameEn: true, logoUrl: true, isVerified: true, slug: true },
            },
          },
        },
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    const hasMore = items.length > args.take;
    const page = hasMore ? items.slice(0, args.take) : items;
    return {
      items: page.map((ad) => ({ ...ad, media: decorateAdMedia(ad.media) })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  forYou(cursor?: string, take = 10) {
    return this.page({
      cursor,
      take,
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  latest(cursor?: string, take = 10) {
    return this.page({
      cursor,
      take,
      orderBy: { publishedAt: 'desc' },
    });
  }
}
