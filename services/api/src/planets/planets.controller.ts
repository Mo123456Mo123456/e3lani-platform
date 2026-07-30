import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PlanetsService } from "./planets.service";

@ApiTags("planets")
@Controller("planets")
export class PlanetsController {
  constructor(private readonly planets: PlanetsService) {}

  @Get("default")
  getDefaultPlanet() {
    return this.planets.getDefaultPlanet();
  }

  @Get(":id/events")
  getEvents(
    @Param("id") id: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.planets.getPlanetEvents(id, limit);
  }

  @Get(":id/timeline")
  getTimeline(@Param("id") id: string) {
    return this.planets.getPlanetTimeline(id);
  }

  @Get(":id/regions/:regionId")
  getRegion(@Param("id") id: string, @Param("regionId") regionId: string) {
    return this.planets.getRegion(id, regionId);
  }
}
