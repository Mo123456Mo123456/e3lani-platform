import { Controller, Get, Param, ParseIntPipe, Query, UsePipes } from "@nestjs/common";
import { eventFeedSchema, paginationSchema } from "@planet/validation";
import { Public } from "../common/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PlanetsService } from "./planets.service";
import { SimulationService } from "../simulation/simulation.service";

@Controller("planets")
export class PlanetsController {
  constructor(
    private readonly planets: PlanetsService,
    private readonly simulation: SimulationService,
  ) {}

  @Public()
  @Get("current")
  current() {
    return this.planets.currentSummary();
  }

  @Public()
  @Get(":id")
  byId(@Param("id") id: string) {
    return this.planets.summary(id);
  }

  @Public()
  @Get(":id/regions/:cellId")
  region(@Param("id") id: string, @Param("cellId", ParseIntPipe) cellId: number) {
    return this.planets.region(id, cellId);
  }

  @Public()
  @Get(":id/maps/:layer")
  async mapLayer(@Param("id") id: string, @Param("layer") layer: string) {
    const { png, tick } = await this.simulation.getMapLayer(id, layer);
    return { layer, tick, pngBase64: png.toString("base64") };
  }

  @Public()
  @Get(":id/overlays")
  overlays(@Param("id") id: string) {
    return this.planets.overlays(id);
  }

  @Public()
  @Get(":id/civilizations")
  civilizations(@Param("id") id: string) {
    return this.planets.civilizations(id);
  }

  @Public()
  @Get(":id/civilizations/:civId")
  civilizationDetail(@Param("id") id: string, @Param("civId") civId: string) {
    return this.planets.civilizationDetail(id, civId);
  }

  @Public()
  @Get(":id/species")
  @UsePipes(new ZodValidationPipe(paginationSchema))
  species(@Param("id") id: string, @Query() query: { page: number; pageSize: number }) {
    return this.planets.species(id, query.page, query.pageSize);
  }

  @Public()
  @Get(":id/plants")
  @UsePipes(new ZodValidationPipe(paginationSchema))
  plants(@Param("id") id: string, @Query() query: { page: number; pageSize: number }) {
    return this.planets.plants(id, query.page, query.pageSize);
  }

  @Public()
  @Get(":id/technologies")
  technologies(@Param("id") id: string) {
    return this.planets.technologies(id);
  }

  @Public()
  @Get(":id/alliances")
  alliances(@Param("id") id: string) {
    return this.planets.alliances(id);
  }

  @Public()
  @Get(":id/wars")
  wars(@Param("id") id: string) {
    return this.planets.wars(id);
  }

  @Public()
  @Get(":id/trade-routes")
  tradeRoutes(@Param("id") id: string) {
    return this.planets.tradeRoutes(id);
  }

  @Public()
  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.planets.timeline(id);
  }

  @Public()
  @Get(":id/snapshots")
  snapshots(@Param("id") id: string) {
    return this.planets.snapshots(id);
  }

  @Public()
  @Get(":id/snapshots/compare")
  compareSnapshots(
    @Param("id") id: string,
    @Query("from", ParseIntPipe) from: number,
    @Query("to", ParseIntPipe) to: number,
  ) {
    return this.planets.compareSnapshots(id, from, to);
  }

  @Public()
  @Get(":id/events")
  @UsePipes(new ZodValidationPipe(eventFeedSchema))
  events(@Param("id") id: string, @Query() query: {
    page: number; pageSize: number; types?: string; minImportance?: number;
    civId?: string; contributionId?: string; fromTick?: number; toTick?: number;
  }) {
    return this.planets.events(id, query);
  }

  @Public()
  @Get(":id/events/:eventId/chain")
  eventChain(@Param("id") id: string, @Param("eventId") eventId: string) {
    return this.planets.eventChain(id, eventId);
  }
}
