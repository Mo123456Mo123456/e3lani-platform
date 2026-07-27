import { Injectable } from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import type { FeedSearchInput } from '@e3lani/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  private async page(args: {
    cursor?: string;
    take: number;
    orderBy: object | object[];
    where?: Prisma.AdWhereInput;
  }) {
    const items = await this.prisma.ad.findMany({
      where: { status: 'ACTIVE', deletedAt: null, ...(args.where ?? {}) },
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
      items: await Promise.all(
        page.map(async (ad) => ({ ...ad, media: await decorateAdMedia(ad.media) })),
      ),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  forYou(cursor?: string, take = 10) {
    return this.page({
      cursor,
      take: this.normalizeTake(take),
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  latest(cursor?: string, take = 10) {
    return this.page({
      cursor,
      take: this.normalizeTake(take),
      orderBy: { publishedAt: 'desc' },
    });
  }

  nearby(cursor?: string, take = 10, cityId?: string) {
    return this.page({
      cursor,
      take: this.normalizeTake(take),
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
      where: cityId ? { currentRevision: { is: { cityId } } } : undefined,
    });
  }

  search(filters: FeedSearchInput) {
    const revisionWhere: Prisma.AdRevisionWhereInput = {};
    if (filters.q) {
      revisionWhere.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (filters.cityId) revisionWhere.cityId = filters.cityId;
    if (filters.categoryId) revisionWhere.categoryId = filters.categoryId;

    const where: Prisma.AdWhereInput = {};
    if (Object.keys(revisionWhere).length > 0) {
      where.currentRevision = { is: revisionWhere };
    }
    if (filters.kind) {
      where.media = {
        some: { kind: filters.kind === 'image' ? MediaKind.IMAGE : MediaKind.VIDEO },
      };
    }
    if (filters.verified !== undefined) {
      where.owner = { brandProfile: { is: { isVerified: filters.verified } } };
    }
    if (filters.featured !== undefined) {
      where.isFeatured = filters.featured;
    }

    return this.page({
      cursor: filters.cursor,
      take: this.normalizeTake(filters.take ?? 10),
      orderBy: this.orderBy(filters.sort),
      where,
    });
  }

  private orderBy(sort: FeedSearchInput['sort']): object | object[] {
    if (sort === 'featured') {
      return [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];
    }
    if (sort === 'views') {
      // View ranking is not denormalized yet; keep a stable latest fallback.
      return [{ publishedAt: 'desc' }, { id: 'desc' }];
    }
    return [{ publishedAt: 'desc' }, { id: 'desc' }];
  }

  private normalizeTake(take: number) {
    return Math.min(Math.max(Math.trunc(take), 1), 50);
  }
}
