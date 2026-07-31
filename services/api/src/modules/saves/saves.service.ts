import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdDto, PostDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SerializerService } from '../../common/services/serializer.service';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { AD_INCLUDE } from '../ads/ads.constants';
import { POST_INCLUDE } from '../posts/posts.constants';

/** المحفوظات — صفحة مستقلة مرتبطة بالحساب، تشمل الإعلانات والمنشورات. */
@Injectable()
export class SavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: SerializerService,
  ) {}

  async saveAd(userId: string, adId: string): Promise<{ saved: boolean; savesCount: number }> {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير متاح', code: 'AD_NOT_FOUND' });

    const existing = await this.prisma.savedAd.findUnique({
      where: { userId_adId: { userId, adId } },
    });
    if (existing) {
      const updated = await this.prisma.ad.findUniqueOrThrow({
        where: { id: adId },
        select: { savesCount: true },
      });
      return { saved: true, savesCount: updated.savesCount };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.savedAd.create({ data: { userId, adId } }),
      this.prisma.ad.update({
        where: { id: adId },
        data: { savesCount: { increment: 1 } },
        select: { savesCount: true },
      }),
    ]);

    return { saved: true, savesCount: updated.savesCount };
  }

  async unsaveAd(userId: string, adId: string): Promise<{ saved: boolean; savesCount: number }> {
    const existing = await this.prisma.savedAd.findUnique({
      where: { userId_adId: { userId, adId } },
    });
    if (!existing) {
      const ad = await this.prisma.ad.findUnique({ where: { id: adId }, select: { savesCount: true } });
      return { saved: false, savesCount: ad?.savesCount ?? 0 };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.savedAd.delete({ where: { userId_adId: { userId, adId } } }),
      this.prisma.ad.update({
        where: { id: adId },
        data: { savesCount: { decrement: 1 } },
        select: { savesCount: true },
      }),
    ]);

    return { saved: false, savesCount: Math.max(0, updated.savesCount) };
  }

  async savePost(userId: string, postId: string): Promise<{ saved: boolean }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, isActive: true },
      select: { id: true },
    });
    if (!post) throw new NotFoundException({ message: 'المنشور غير متاح', code: 'POST_NOT_FOUND' });

    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      update: {},
      create: { userId, postId },
    });
    await this.prisma.post.update({ where: { id: postId }, data: { savesCount: { increment: 1 } } });
    return { saved: true };
  }

  async unsavePost(userId: string, postId: string): Promise<{ saved: boolean }> {
    const deleted = await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
    if (deleted.count) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { savesCount: { decrement: 1 } },
      });
    }
    return { saved: false };
  }

  async listAds(userId: string, options: { cursor?: string; limit: number }): Promise<Paginated<AdDto>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.savedAd.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.sort) } },
                { createdAt: new Date(cursor.sort), adId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { ad: { include: AD_INCLUDE } },
      orderBy: [{ createdAt: 'desc' }, { adId: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((row) => this.serializer.ad(row.ad, { viewerId: userId, isSaved: true })),
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sort: last.createdAt.toISOString(), id: last.adId }) : null,
    };
  }

  async listPosts(userId: string, options: { cursor?: string; limit: number }): Promise<Paginated<PostDto>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.savedPost.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.sort) } },
                { createdAt: new Date(cursor.sort), postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { post: { include: POST_INCLUDE } },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((row) => this.serializer.post(row.post, { isSaved: true })),
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sort: last.createdAt.toISOString(), id: last.postId }) : null,
    };
  }
}
