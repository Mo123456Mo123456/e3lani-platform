import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ModerationModule } from "../moderation/moderation.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { SimulationModule } from "../simulation/simulation.module";
import { CommonModule } from "../common/common.module";
import { ContributionsController } from "./contributions.controller";
import { ContributionsService } from "./contributions.service";

@Module({
  imports: [AiModule, ModerationModule, NotificationsModule, RealtimeModule, SimulationModule, CommonModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
