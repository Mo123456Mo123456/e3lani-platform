import { Module } from "@nestjs/common";
import { WorldManager } from "./world-manager.js";
import { WorldsController } from "./worlds.controller.js";
import { WorldsService } from "./worlds.service.js";

@Module({
  controllers: [WorldsController],
  providers: [WorldManager, WorldsService],
  exports: [WorldManager, WorldsService],
})
export class WorldsModule {}
