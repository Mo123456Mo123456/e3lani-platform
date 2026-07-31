import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [RealtimeModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
