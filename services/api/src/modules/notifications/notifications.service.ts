import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProductionNotificationPlaceholderAdapter,
  SandboxNotificationAdapter,
  notificationMode,
  type NotificationAdapter,
} from '../../adapters/notifications/notification-adapter';

@Injectable()
export class NotificationsService {
  private readonly adapter: NotificationAdapter;

  constructor(private readonly prisma: PrismaService) {
    this.adapter =
      notificationMode() === 'production'
        ? new ProductionNotificationPlaceholderAdapter(prisma)
        : new SandboxNotificationAdapter(prisma);
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, count: result.count };
  }

  notifyUser(input: {
    userId: string;
    type: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    payload?: Prisma.InputJsonValue;
    deliver?: {
      push?: boolean;
      email?: { to: string; subject?: string; body?: string };
      sms?: { to: string; body?: string };
    };
  }) {
    return this.deliverNotification(input);
  }

  private async deliverNotification(input: {
    userId: string;
    type: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    payload?: Prisma.InputJsonValue;
    deliver?: {
      push?: boolean;
      email?: { to: string; subject?: string; body?: string };
      sms?: { to: string; body?: string };
    };
  }) {
    const { deliver, ...inApp } = input;
    const notification = await this.adapter.sendInApp(inApp);

    if (deliver?.push) {
      const devices = await this.prisma.userDevice.findMany({
        where: { userId: input.userId, pushToken: { not: null } },
        select: { pushToken: true },
      });
      await this.adapter.sendPush({
        userId: input.userId,
        title: input.titleEn,
        body: input.bodyEn,
        payload: input.payload,
        tokens: devices.flatMap((device) => (device.pushToken ? [device.pushToken] : [])),
      });
    }
    if (deliver?.email) {
      await this.adapter.sendEmail({
        to: deliver.email.to,
        subject: deliver.email.subject ?? input.titleEn,
        body: deliver.email.body ?? input.bodyEn,
      });
    }
    if (deliver?.sms) {
      await this.adapter.sendSms({
        to: deliver.sms.to,
        body: deliver.sms.body ?? input.bodyEn,
      });
    }

    return notification;
  }
}
