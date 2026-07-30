import { Module } from "@nestjs/common";
import { WorldsService } from "./worlds.service.js";
import { WorldsController } from "./worlds.controller.js";
import { EngineClient } from "../common/engine.client.js";
import { EventsModule } from "../events/events.module.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [EventsModule, AuthModule],
  controllers: [WorldsController],
  providers: [WorldsService, EngineClient],
  exports: [WorldsService, EngineClient],
})
export class WorldsModule {}
