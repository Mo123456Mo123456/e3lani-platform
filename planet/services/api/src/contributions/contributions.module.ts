import { Module } from "@nestjs/common";
import { ContributionsService } from "./contributions.service.js";
import { ContributionsController } from "./contributions.controller.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { WorldsModule } from "../worlds/worlds.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [WorldsModule, NotificationsModule, AuthModule],
  controllers: [ContributionsController],
  providers: [ContributionsService, OrchestratorClient],
})
export class ContributionsModule {}
