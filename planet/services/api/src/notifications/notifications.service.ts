import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async create(input: {
    userId: string;
    planetId?: string;
    type: string;
    title: string;
    body: string;
    eventSeq?: number;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        planetId: input.planetId,
        type: input.type,
        title: input.title,
        body: input.body,
        eventSeq: input.eventSeq,
      },
    });
    this.realtime.sendToUser(input.userId, {
      kind: "notification",
      userId: input.userId,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        worldId: notification.planetId ?? "",
        eventSeq: notification.eventSeq ?? undefined,
        createdAt: notification.createdAt.toISOString(),
      },
    });
    return notification;
  }

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
