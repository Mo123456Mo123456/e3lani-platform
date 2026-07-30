import { Module } from "@nestjs/common";
import { SimulationModule } from "../simulation/simulation.module";
import { PlanetsController } from "./planets.controller";
import { PlanetsService } from "./planets.service";

@Module({
  imports: [SimulationModule],
  controllers: [PlanetsController],
  providers: [PlanetsService],
})
export class PlanetsModule {}
