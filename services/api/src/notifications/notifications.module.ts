import { Module } from "@nestjs/common";
import { NotificationWorker } from "./notification-worker.js";
import { NotificationsController } from "./notifications.controller.js";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationWorker],
  exports: [NotificationWorker],
})
export class NotificationsModule {}
