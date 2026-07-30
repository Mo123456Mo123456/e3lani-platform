import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthUser } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query("unread") unread?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId: user.id, ...(unread === "true" ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const unreadCount = await this.prisma.notification.count({ where: { userId: user.id, read: false } });
    return { items, unreadCount };
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
    return { ok: true };
  }

  @Patch("read-all")
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return { ok: true };
  }
}
