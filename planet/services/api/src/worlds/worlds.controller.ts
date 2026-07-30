import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { runTicksSchema, rollbackSchema } from "@planet/validation";
import { Body } from "@nestjs/common";
import { WorldsService } from "./worlds.service.js";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/guards.js";
import { EventsService } from "../events/events.service.js";

@Controller("worlds")
export class WorldsController {
  constructor(
    private worlds: WorldsService,
    private events: EventsService,
  ) {}

  @Get()
  list() {
    return this.worlds.listPlanets();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.worlds.getPlanet(id);
  }

  @Get(":id/grid")
  grid(@Param("id") id: string) {
    return this.worlds.grid(id);
  }

  @Get(":id/snapshot")
  snapshot(@Param("id") id: string) {
    return this.worlds.liveSnapshot(id);
  }

  @Get(":id/regions/:cell")
  region(@Param("id") id: string, @Param("cell", ParseIntPipe) cell: number) {
    return this.worlds.region(id, cell);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.worlds.timeline(id);
  }

  @Get(":id/events")
  eventList(
    @Param("id") id: string,
    @Query("beforeSeq") beforeSeq?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("contributionId") contributionId?: string,
  ) {
    return this.events.query(id, {
      beforeSeq: beforeSeq !== undefined ? Number(beforeSeq) : undefined,
      limit: limit !== undefined ? Number(limit) : 40,
      type,
      contributionId,
    });
  }

  @Get(":id/causal/:seq")
  causal(@Param("id") id: string, @Param("seq", ParseIntPipe) seq: number) {
    return this.events.causalChain(id, seq);
  }

  @Post(":id/ticks")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("simulation_manager", "system_admin", "super_admin")
  advance(@Param("id") id: string, @Body() body: unknown) {
    const parsed = runTicksSchema.safeParse(body);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    return this.worlds.advanceTicks(id, parsed.data.count);
  }

  @Post(":id/rollback")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("simulation_manager", "system_admin", "super_admin")
  rollback(@Param("id") id: string, @Body() body: unknown) {
    const parsed = rollbackSchema.safeParse(body);
    if (!parsed.success) return { error: "tick_required" };
    return this.worlds.rollback(id, parsed.data.tick);
  }
}
