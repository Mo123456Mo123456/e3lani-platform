import { Module } from "@nestjs/common";
import { ModerationModule } from "../moderation/moderation.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { SimulationModule } from "../simulation/simulation.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [SimulationModule, ModerationModule, RealtimeModule],
  controllers: [AdminController],
})
export class AdminModule {}
