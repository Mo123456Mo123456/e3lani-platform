import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SerializerService } from '../../common/services/serializer.service';
import { AuditService } from '../../common/services/audit.service';
import { MediaService } from '../media/media.service';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { POST_INCLUDE } from './posts.constants';

/**
 * المنشورات المجانية.
 * كيان مستقل تمامًا: جداول منفصلة، خدمة منفصلة، مسارات منفصلة.
 * تظهر فقط داخل صفحة صاحب الحساب ولا تدخل موجز الإعلانات إطلاقًا.
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: SerializerService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, input: { caption: string; mediaIds: string[] }): Promise<PostDto> {
    const orderedMedia = await this.media.assertUsableMedia(userId, input.mediaIds, 'POST');
    const post = await this.prisma.post.create({
      data: {
        userId,
        caption: input.caption,
        media: { create: orderedMedia.map((item, index) => ({ mediaId: item.id, order: index })) },
      },
      include: POST_INCLUDE,
    });
    await this.audit.record({
      action: 'post.created',
      entityType: 'Post',
      entityId: post.id,
      actorUserId: userId,
    });
    return this.serializer.post(post);
  }

  async update(
    userId: string,
    postId: string,
    input: { caption?: string; mediaIds?: string[] },
  ): Promise<PostDto> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, userId } });
    if (!post) throw new NotFoundException({ message: 'المنشور غير موجود', code: 'POST_NOT_FOUND' });
    if (!post.isActive) {
      throw new ForbiddenException({ message: 'تم إيقاف هذا المنشور', code: 'POST_REMOVED' });
    }

    let mediaUpdate = {};
    if (input.mediaIds) {
      const orderedMedia = await this.media.assertUsableMedia(userId, input.mediaIds, 'POST');
      mediaUpdate = {
        media: {
          deleteMany: {},
          create: orderedMedia.map((item, index) => ({ mediaId: item.id, order: index })),
        },
      };
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { caption: input.caption ?? undefined, ...mediaUpdate },
      include: POST_INCLUDE,
    });
    return this.serializer.post(updated);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, userId } });
    if (!post) throw new NotFoundException({ message: 'المنشور غير موجود', code: 'POST_NOT_FOUND' });
    await this.prisma.post.delete({ where: { id: postId } });
    await this.audit.record({
      action: 'post.deleted_by_owner',
      entityType: 'Post',
      entityId: postId,
      actorUserId: userId,
    });
  }

  async getPublic(postId: string, viewerId?: string | null): Promise<PostDto> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, include: POST_INCLUDE });
    if (!post || (!post.isActive && post.userId !== viewerId)) {
      throw new NotFoundException({ message: 'المنشور غير متاح', code: 'POST_NOT_FOUND' });
    }
    const isSaved = viewerId
      ? Boolean(
          await this.prisma.savedPost.findUnique({
            where: { userId_postId: { userId: viewerId, postId } },
          }),
        )
      : false;
    return this.serializer.post(post, { isSaved });
  }

  /** منشورات حساب معيّن — المصدر الوحيد لعرض المنشورات. */
  async listByAccount(
    accountId: string,
    options: { cursor?: string; limit: number },
    viewerId?: string | null,
  ): Promise<Paginated<PostDto>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.post.findMany({
      where: {
        userId: accountId,
        isActive: true,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.sort) } },
                { createdAt: new Date(cursor.sort), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: POST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];

    const savedIds = viewerId
      ? new Set(
          (
            await this.prisma.savedPost.findMany({
              where: { userId: viewerId, postId: { in: items.map((row) => row.id) } },
              select: { postId: true },
            })
          ).map((row) => row.postId),
        )
      : new Set<string>();

    return {
      items: items.map((row) => this.serializer.post(row, { isSaved: savedIds.has(row.id) })),
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sort: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async registerShare(postId: string): Promise<void> {
    await this.prisma.post.updateMany({
      where: { id: postId, isActive: true },
      data: { sharesCount: { increment: 1 } },
    });
  }
}
