import { Injectable } from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import type { FeedSearchInput } from '@e3lani/validation';
import type { ImpressionSource } from '@e3lani/recommendations';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAdMedia } from '../../common/media-urls';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendations: RecommendationsService,
  ) {}

  private async page(args: {
    cursor?: string;
    take: number;
    orderBy: object | object[];
    where?: Prisma.AdWhereInput;
    sourceDefault?: ImpressionSource;
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
        page.map(async (ad) => ({
          ...ad,
          media: await decorateAdMedia(ad.media),
          recommendation: {
            source: args.sourceDefault ?? (ad.isSponsored ? 'PAID' : 'ORGANIC'),
            score: null as number | null,
          },
        })),
      ),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  /**
   * For You — hybrid smart recommendations (content + collaborative + popularity
   * + location + recency + capped business rules). Falls back to popularity/latest
   * ordering if the adapter fails.
   */
  async forYou(params: {
    cursor?: string;
    take?: number;
    userId?: string;
    cityId?: string;
  }) {
    const take = this.normalizeTake(params.take ?? 10);
    try {
      const ranked = await this.recommendations.forYouRanked({
        userId: params.userId,
        cityId: params.cityId,
        cursor: params.cursor,
        take,
      });

      if (ranked.ranked.length === 0) {
        return this.page({
          cursor: params.cursor,
          take,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          sourceDefault: 'ORGANIC',
        });
      }

      const ids = ranked.ranked.map((row) => row.adId);
      const scoreById = new Map(ranked.ranked.map((row) => [row.adId, row]));
      const ads = await this.prisma.ad.findMany({
        where: { id: { in: ids }, status: 'ACTIVE', deletedAt: null },
        include: {
          currentRevision: { include: { category: true, city: true } },
          owner: {
            select: {
              id: true,
              displayName: true,
              brandProfile: {
                select: {
                  nameAr: true,
                  nameEn: true,
                  logoUrl: true,
                  isVerified: true,
                  slug: true,
                },
              },
            },
          },
          media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
        },
      });
      const byId = new Map(ads.map((ad) => [ad.id, ad]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

      return {
        items: await Promise.all(
          ordered.map(async (ad) => {
            const meta = scoreById.get(ad!.id);
            return {
              ...ad!,
              media: await decorateAdMedia(ad!.media),
              recommendation: {
                source: meta?.source ?? 'SMART_RECOMMENDATION',
                score: meta?.score ?? null,
                breakdown: meta?.breakdown ?? null,
                adapter: ranked.adapter,
                coldStart: ranked.coldStart,
              },
            };
          }),
        ),
        nextCursor: ordered.length ? ordered[ordered.length - 1]!.id : null,
        hasMore: ranked.ranked.length >= take,
        meta: {
          adapter: ranked.adapter,
          coldStart: ranked.coldStart,
          mode: 'smart_recommendation',
        },
      };
    } catch {
      return this.page({
        cursor: params.cursor,
        take,
        orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
        sourceDefault: 'ORGANIC',
      });
    }
  }

  latest(cursor?: string, take = 10) {
    return this.page({
      cursor,
      take: this.normalizeTake(take),
      orderBy: { publishedAt: 'desc' },
      sourceDefault: 'ORGANIC',
    });
  }

  nearby(cursor?: string, take = 10, cityId?: string) {
    return this.page({
      cursor,
      take: this.normalizeTake(take),
      orderBy: [{ isSponsored: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
      where: cityId ? { currentRevision: { is: { cityId } } } : undefined,
      sourceDefault: 'ORGANIC',
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
      sourceDefault: 'ORGANIC',
    });
  }

  private orderBy(sort: FeedSearchInput['sort']): object | object[] {
    if (sort === 'featured') {
      return [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];
    }
    if (sort === 'views') {
      return [{ publishedAt: 'desc' }, { id: 'desc' }];
    }
    return [{ publishedAt: 'desc' }, { id: 'desc' }];
  }

  private normalizeTake(take: number) {
    return Math.min(Math.max(Math.trunc(take), 1), 50);
  }
}
