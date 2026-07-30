import { Module } from "@nestjs/common";
import { PlanetsModule } from "../planets/planets.module";
import { TimelineController } from "./timeline.controller";

@Module({
  imports: [PlanetsModule],
  controllers: [TimelineController],
})
export class TimelineModule {}
