import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { EngineClient } from "./engine-client.service";
import { SimulationService } from "./simulation.service";

@Module({
  imports: [RealtimeModule, NotificationsModule],
  providers: [EngineClient, SimulationService],
  exports: [EngineClient, SimulationService],
})
export class SimulationModule {}
