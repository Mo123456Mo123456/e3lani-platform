import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { AdminController } from "./admin.controller.js";

@Module({
  imports: [WorldsModule],
  controllers: [AdminController],
})
export class AdminModule {}
