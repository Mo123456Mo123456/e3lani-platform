import { Injectable } from '@nestjs/common';
import type { Prisma } from '@e3lani/database';
import type { AdDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SerializerService } from '../../common/services/serializer.service';
import { CatalogService } from '../catalog/catalog.service';
import { RankingService } from './ranking.service';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { AD_INCLUDE } from '../ads/ads.constants';

export interface FeedQuery {
  tab: 'for-you' | 'nearby' | 'latest';
  cityId?: string;
  lat?: number;
  lng?: number;
  categoryId?: string;
  cursor?: string;
  limit: number;
  deviceId?: string;
}

/**
 * موجز الإعلانات — تصفح عمودي إعلانًا بعد إعلان.
 * المنشورات المجانية لا تدخل هذا الموجز إطلاقًا: الاستعلام يقرأ جدول الإعلانات فقط.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: SerializerService,
    private readonly catalog: CatalogService,
    private readonly ranking: RankingService,
  ) {}

  private activeWhere(now: Date): Prisma.AdWhereInput {
    return {
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }

  private promotedWhere(now: Date): Prisma.AdWhereInput {
    return {
      OR: [{ highlightUntil: { gt: now } }, { topOfCategoryUntil: { gt: now } }],
    };
  }

  private async resolveCityId(query: FeedQuery): Promise<string | undefined> {
    if (query.cityId) return query.cityId;
    if (typeof query.lat === 'number' && typeof query.lng === 'number') {
      const city = await this.catalog.nearestCity(query.lat, query.lng);
      return city?.id;
    }
    return undefined;
  }

  async feed(query: FeedQuery, viewerId?: string | null): Promise<Paginated<AdDto> & { cityId?: string }> {
    const now = new Date();
    const cityId = query.tab === 'latest' ? query.cityId : await this.resolveCityId(query);

    // تبويب «لك» يمرّ عبر محرّك الترتيب الداخلي عند تفعيله
    if (query.tab === 'for-you' && (await this.ranking.isEnabled())) {
      return this.rankedFeed(query, cityId, viewerId);
    }

    const scope: Prisma.AdWhereInput[] = [this.activeWhere(now)];
    if (query.categoryId) scope.push({ categoryId: query.categoryId });

    if (cityId && query.tab !== 'latest') {
      scope.push({
        OR: [
          { cityId },
          { reachScope: 'KINGDOM' },
          { extraCities: { some: { cityId } } },
        ],
      });
    }

    const baseWhere: Prisma.AdWhereInput = { AND: scope };
    const usePhases = query.tab === 'for-you' || query.tab === 'nearby';
    const orderField = query.tab === 'latest' ? 'publishedAt' : 'lastBumpedAt';

    const cursor = decodeCursor(query.cursor);
    let phase = 0;
    let cursorValue: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      const [rawPhase, rawDate] = cursor.sort.split('|');
      phase = usePhases ? Number(rawPhase ?? 0) : 0;
      cursorValue = rawDate ? new Date(rawDate) : null;
      cursorId = cursor.id;
    }

    const collected: any[] = [];
    const maxPhase = usePhases ? 1 : 0;

    while (collected.length <= query.limit && phase <= maxPhase) {
      const phaseWhere: Prisma.AdWhereInput = usePhases
        ? phase === 0
          ? { AND: [baseWhere, this.promotedWhere(now)] }
          : { AND: [baseWhere, { NOT: this.promotedWhere(now) }] }
        : baseWhere;

      const keyset: Prisma.AdWhereInput =
        cursorValue && cursorId
          ? {
              OR: [
                { [orderField]: { lt: cursorValue } } as Prisma.AdWhereInput,
                { [orderField]: cursorValue, id: { lt: cursorId } } as Prisma.AdWhereInput,
              ],
            }
          : {};

      const rows = await this.prisma.ad.findMany({
        where: { AND: [phaseWhere, keyset] },
        include: AD_INCLUDE,
        orderBy: [{ [orderField]: 'desc' } as any, { id: 'desc' }],
        take: query.limit + 1 - collected.length,
      });

      collected.push(...rows.map((row) => ({ row, phase })));

      if (collected.length <= query.limit) {
        phase += 1;
        cursorValue = null;
        cursorId = null;
      } else {
        break;
      }
    }

    const hasMore = collected.length > query.limit;
    const page = hasMore ? collected.slice(0, query.limit) : collected;
    const last = page[page.length - 1];

    const savedIds = await this.savedIdsFor(viewerId, page.map((entry) => entry.row.id));

    return {
      items: page.map((entry) =>
        this.serializer.ad(entry.row, { viewerId, isSaved: savedIds.has(entry.row.id) }),
      ),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              sort: `${last.phase}|${(last.row[orderField] ?? last.row.createdAt).toISOString()}`,
              id: last.row.id,
            })
          : null,
      cityId,
    };
  }

  /** موجز مرتّب بمحرّك الترتيب الداخلي، مع ترقيم ثابت فوق قائمة مثبّتة للجلسة. */
  private async rankedFeed(
    query: FeedQuery,
    cityId: string | undefined,
    viewerId?: string | null,
  ): Promise<Paginated<AdDto> & { cityId?: string }> {
    const now = new Date();
    const scope: Prisma.AdWhereInput[] = [this.activeWhere(now)];
    if (query.categoryId) scope.push({ categoryId: query.categoryId });
    if (cityId) {
      scope.push({
        OR: [{ cityId }, { reachScope: 'KINGDOM' }, { extraCities: { some: { cityId } } }],
      });
    }

    const region = cityId
      ? await this.prisma.city.findUnique({ where: { id: cityId }, select: { regionId: true } })
      : null;

    const context = {
      viewerId,
      deviceId: query.deviceId,
      cityId,
      regionId: region?.regionId,
    };

    const cursor = decodeCursor(query.cursor);
    const offset = cursor?.sort === 'rank' ? Math.max(0, Number(cursor.id) || 0) : 0;

    const orderedIds = await this.ranking.orderedIds(context, { AND: scope });
    const pageIds = orderedIds.slice(offset, offset + query.limit);

    if (!pageIds.length) {
      return { items: [], hasMore: false, nextCursor: null, cityId };
    }

    const rows = await this.prisma.ad.findMany({
      where: { id: { in: pageIds }, ...this.activeWhere(now) },
      include: AD_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    // نحافظ على ترتيب المحرّك ونتجاهل ما حُذف أو انتهى بعد بناء الترتيب
    const ordered = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const savedIds = await this.savedIdsFor(viewerId, ordered.map((row) => row.id));
    const hasMore = offset + query.limit < orderedIds.length;

    return {
      items: ordered.map((row) =>
        this.serializer.ad(row, { viewerId, isSaved: savedIds.has(row.id) }),
      ),
      hasMore,
      nextCursor: hasMore
        ? encodeCursor({ sort: 'rank', id: String(offset + query.limit) })
        : null,
      cityId,
    };
  }

  async savedIdsFor(viewerId: string | null | undefined, adIds: string[]): Promise<Set<string>> {
    if (!viewerId || !adIds.length) return new Set();
    const rows = await this.prisma.savedAd.findMany({
      where: { userId: viewerId, adId: { in: adIds } },
      select: { adId: true },
    });
    return new Set(rows.map((row) => row.adId));
  }
}
