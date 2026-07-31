import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdDto, PublicAccountDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SerializerService } from '../../common/services/serializer.service';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { AD_INCLUDE } from '../ads/ads.constants';

/** صفحة صاحب الحساب / البراند العامة — تبويبان: الإعلانات | المنشورات. */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: SerializerService,
  ) {}

  async profile(accountId: string): Promise<PublicAccountDto & { shareUrl: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: accountId, status: 'ACTIVE' },
      include: {
        avatarMedia: true,
        city: { select: { id: true, nameAr: true, nameEn: true } },
        business: { include: { logoMedia: true, coverMedia: true } },
      },
    });
    if (!user) throw new NotFoundException({ message: 'الحساب غير موجود', code: 'ACCOUNT_NOT_FOUND' });

    const [activeAds, posts, views] = await Promise.all([
      this.prisma.ad.count({ where: { userId: accountId, status: 'ACTIVE' } }),
      this.prisma.post.count({ where: { userId: accountId, isActive: true } }),
      this.prisma.ad.aggregate({
        where: { userId: accountId },
        _sum: { viewsCount: true },
      }),
    ]);

    return {
      ...this.serializer.account(user),
      stats: { activeAds, posts, totalViews: views._sum.viewsCount ?? 0 },
      shareUrl: this.serializer.accountShareUrl(accountId),
    };
  }

  async ads(
    accountId: string,
    options: { cursor?: string; limit: number },
    viewerId?: string | null,
  ): Promise<Paginated<AdDto>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.ad.findMany({
      where: {
        userId: accountId,
        status: 'ACTIVE',
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: new Date(cursor.sort) } },
                { publishedAt: new Date(cursor.sort), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: AD_INCLUDE,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];

    const savedIds = viewerId
      ? new Set(
          (
            await this.prisma.savedAd.findMany({
              where: { userId: viewerId, adId: { in: items.map((row) => row.id) } },
              select: { adId: true },
            })
          ).map((row) => row.adId),
        )
      : new Set<string>();

    return {
      items: items.map((row) => this.serializer.ad(row, { viewerId, isSaved: savedIds.has(row.id) })),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ sort: (last.publishedAt ?? last.createdAt).toISOString(), id: last.id })
          : null,
    };
  }
}
