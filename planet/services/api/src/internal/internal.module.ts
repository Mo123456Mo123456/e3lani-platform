import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [NotificationsModule],
  controllers: [InternalController],
})
export class InternalModule {}
