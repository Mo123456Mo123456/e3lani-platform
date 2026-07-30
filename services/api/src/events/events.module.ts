import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { EventsController } from "./events.controller.js";

@Module({
  imports: [WorldsModule],
  controllers: [EventsController],
})
export class EventsModule {}
