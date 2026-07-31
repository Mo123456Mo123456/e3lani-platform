import { Injectable, Logger } from '@nestjs/common';
import type { NotificationDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { QueueService } from '../../common/services/queue.service';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';

export interface NotificationPayload {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** ينشئ إشعارًا داخل التطبيق ويجدول إرسال إشعار الدفع. */
  async notify(userId: string, type: string, payload: NotificationPayload): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type,
          titleAr: payload.titleAr,
          titleEn: payload.titleEn,
          bodyAr: payload.bodyAr,
          bodyEn: payload.bodyEn,
          data: (payload.data ?? null) as any,
        },
      });
      await this.queue.enqueueNotification({ userId, type, ...payload });
    } catch (error) {
      this.logger.error(`تعذّر إنشاء الإشعار ${type}: ${(error as Error).message}`);
    }
  }

  async notifyMany(userIds: string[], type: string, payload: NotificationPayload): Promise<number> {
    if (!userIds.length) return 0;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        titleAr: payload.titleAr,
        titleEn: payload.titleEn,
        bodyAr: payload.bodyAr,
        bodyEn: payload.bodyEn,
        data: (payload.data ?? null) as any,
      })),
    });
    for (const userId of userIds) {
      await this.queue.enqueueNotification({ userId, type, ...payload });
    }
    return userIds.length;
  }

  async list(
    userId: string,
    options: { cursor?: string; limit: number },
  ): Promise<Paginated<NotificationDto> & { unreadCount: number }> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.sort) } },
                { createdAt: new Date(cursor.sort), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];
    const unreadCount = await this.prisma.notification.count({ where: { userId, readAt: null } });

    return {
      items: items.map((row) => ({
        id: row.id,
        type: row.type,
        titleAr: row.titleAr,
        titleEn: row.titleEn,
        bodyAr: row.bodyAr,
        bodyEn: row.bodyEn,
        data: (row.data as Record<string, unknown> | null) ?? null,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sort: last.createdAt.toISOString(), id: last.id }) : null,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async registerPushToken(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  async removePushToken(token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }
}
