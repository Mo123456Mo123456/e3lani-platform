import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async forYou(cursor?: string, take = 10) {
    const items = await this.prisma.ad.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: {
          select: {
            id: true,
            displayName: true,
            brandProfile: { select: { nameAr: true, logoUrl: true, isVerified: true, slug: true } },
          },
        },
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async latest(cursor?: string, take = 10) {
    const items = await this.prisma.ad.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { publishedAt: 'desc' },
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: {
          select: {
            id: true,
            displayName: true,
            brandProfile: { select: { nameAr: true, logoUrl: true, isVerified: true } },
          },
        },
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }
}
