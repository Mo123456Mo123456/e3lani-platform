import { Injectable } from '@nestjs/common';
import type { Prisma } from '@e3lani/database';
import type { AdDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SerializerService } from '../../common/services/serializer.service';
import { CatalogService } from '../catalog/catalog.service';
import { FeedService } from '../feed/feed.service';
import { distanceKm } from '../../common/utils/geo';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { AD_INCLUDE } from '../ads/ads.constants';

export interface SearchQuery {
  q?: string;
  cityId?: string;
  categoryId?: string;
  subcategoryId?: string;
  nearMe?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  mediaType?: 'IMAGE' | 'VIDEO';
  verifiedOnly?: boolean;
  highlightedOnly?: boolean;
  promotedOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort: 'latest' | 'most-viewed' | 'relevance';
  cursor?: string;
  limit: number;
}

/** بحث متقدم مع كل الفلاتر المطلوبة. */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: SerializerService,
    private readonly catalog: CatalogService,
    private readonly feed: FeedService,
  ) {}

  async search(query: SearchQuery, viewerId?: string | null): Promise<Paginated<AdDto>> {
    const now = new Date();
    const filters: Prisma.AdWhereInput[] = [
      { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ];

    if (query.q) {
      filters.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    let nearbyCityIds: string[] | null = null;
    if (query.nearMe && typeof query.lat === 'number' && typeof query.lng === 'number') {
      const radius = query.radiusKm ?? 100;
      const cities = await this.catalog.cities();
      nearbyCityIds = cities
        .filter((city) => distanceKm(query.lat!, query.lng!, city.lat, city.lng) <= radius)
        .map((city) => city.id);
      filters.push({
        OR: [
          { cityId: { in: nearbyCityIds } },
          { extraCities: { some: { cityId: { in: nearbyCityIds } } } },
          { reachScope: 'KINGDOM' },
        ],
      });
    } else if (query.cityId) {
      filters.push({
        OR: [
          { cityId: query.cityId },
          { extraCities: { some: { cityId: query.cityId } } },
          { reachScope: 'KINGDOM' },
        ],
      });
    }

    if (query.categoryId) filters.push({ categoryId: query.categoryId });
    if (query.subcategoryId) filters.push({ subcategoryId: query.subcategoryId });
    if (query.mediaType) filters.push({ media: { some: { media: { type: query.mediaType } } } });
    if (query.verifiedOnly) {
      filters.push({ OR: [{ user: { isVerified: true } }, { user: { business: { verifiedAt: { not: null } } } }] });
    }
    if (query.highlightedOnly) filters.push({ highlightUntil: { gt: now } });
    if (query.promotedOnly) {
      filters.push({ OR: [{ highlightUntil: { gt: now } }, { topOfCategoryUntil: { gt: now } }] });
    }
    if (typeof query.minPrice === 'number') filters.push({ price: { gte: query.minPrice } });
    if (typeof query.maxPrice === 'number') filters.push({ price: { lte: query.maxPrice } });

    const orderField =
      query.sort === 'most-viewed' ? 'viewsCount' : query.sort === 'relevance' ? 'impressionsCount' : 'publishedAt';
    const isNumericSort = orderField !== 'publishedAt';

    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const value = isNumericSort ? Number(cursor.sort) : new Date(cursor.sort);
      filters.push({
        OR: [
          { [orderField]: { lt: value } } as Prisma.AdWhereInput,
          { [orderField]: value, id: { lt: cursor.id } } as Prisma.AdWhereInput,
        ],
      });
    }

    const rows = await this.prisma.ad.findMany({
      where: { AND: filters },
      include: AD_INCLUDE,
      orderBy: [{ [orderField]: 'desc' } as any, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    const savedIds = await this.feed.savedIdsFor(viewerId, items.map((row) => row.id));

    return {
      items: items.map((row) =>
        this.serializer.ad(row, { viewerId, isSaved: savedIds.has(row.id) }),
      ),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              sort: isNumericSort
                ? String((last as any)[orderField])
                : ((last as any)[orderField] ?? last.createdAt).toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async suggestions(term: string): Promise<{ ads: string[]; categories: { id: string; nameAr: string; nameEn: string }[] }> {
    if (!term || term.length < 2) return { ads: [], categories: [] };
    const [ads, categories] = await Promise.all([
      this.prisma.ad.findMany({
        where: { status: 'ACTIVE', title: { contains: term, mode: 'insensitive' } },
        select: { title: true },
        take: 6,
        orderBy: { viewsCount: 'desc' },
      }),
      this.prisma.category.findMany({
        where: {
          isActive: true,
          OR: [
            { nameAr: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nameAr: true, nameEn: true },
        take: 6,
      }),
    ]);
    return { ads: ads.map((ad) => ad.title), categories };
  }
}
