import { Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../common/auth.guard";
import type { AccessClaims } from "../auth/jwt.util";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessClaims) {
    return this.notifications.listForUser(user.sub);
  }

  @Post(":id/read")
  markRead(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    return this.notifications.markRead(user.sub, id);
  }
}
