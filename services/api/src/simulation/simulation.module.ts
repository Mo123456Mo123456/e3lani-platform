import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { SimulationController } from "./simulation.controller.js";

@Module({
  imports: [WorldsModule],
  controllers: [SimulationController],
})
export class SimulationModule {}
