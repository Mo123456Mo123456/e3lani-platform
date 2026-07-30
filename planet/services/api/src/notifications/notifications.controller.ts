import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { CurrentUser, JwtAuthGuard } from "../auth/guards.js";
import type { AccessPayload } from "../auth/auth.service.js";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessPayload, @Query("unread") unread?: string) {
    return this.notifications.list(user.sub, unread === "true");
  }

  @Post(":id/read")
  markRead(@CurrentUser() user: AccessPayload, @Param("id") id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: AccessPayload) {
    return this.notifications.markAllRead(user.sub);
  }
}
