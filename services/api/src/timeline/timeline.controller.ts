import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PlanetsService } from "../planets/planets.service";

@ApiTags("timeline")
@Controller("timeline")
export class TimelineController {
  constructor(private readonly planets: PlanetsService) {}

  @Get(":planetId")
  getTimeline(@Param("planetId") planetId: string) {
    return this.planets.getPlanetTimeline(planetId);
  }
}
