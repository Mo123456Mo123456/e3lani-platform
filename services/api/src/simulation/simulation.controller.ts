import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";
import { WorldManager } from "../worlds/world-manager.js";

@ApiTags("simulation")
@Controller("simulation")
export class SimulationController {
  constructor(
    private readonly manager: WorldManager,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get(":planetId/status")
  status(@Param("planetId") planetId: string) {
    const status = this.manager.status(planetId);
    const stats = this.manager.statsOf(planetId);
    if (!status || !stats) throw new NotFoundException("planet not running");
    return { planetId, ...status, ...stats };
  }

  @ApiOperation({ summary: "Start the tick loop (SIM_ADMIN+)" })
  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Post(":planetId/start")
  start(@Param("planetId") planetId: string, @Body() body: { ticksPerSecond?: number }) {
    this.manager.startTicker(planetId, body?.ticksPerSecond);
    return { ok: true };
  }

  @ApiOperation({ summary: "Pause the tick loop (SIM_ADMIN+)" })
  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Post(":planetId/pause")
  pause(@Param("planetId") planetId: string) {
    this.manager.stopTicker(planetId);
    return { ok: true };
  }

  @ApiOperation({ summary: "Step N ticks synchronously (SIM_ADMIN+)" })
  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Post(":planetId/step")
  async step(@Param("planetId") planetId: string, @Body() body: { ticks?: number }) {
    const n = Math.max(1, Math.min(500, body?.ticks ?? 1));
    const deltas = await this.manager.runTicks(planetId, n);
    return { ok: true, ticks: n, events: deltas.reduce((s, d) => s + d.newEvents.length, 0) };
  }

  @Public()
  @Get(":planetId/snapshots")
  async snapshots(@Param("planetId") planetId: string) {
    return this.prisma.timelineSnapshot.findMany({
      where: { planetId },
      orderBy: { tick: "desc" },
      take: 100,
      select: { tick: true, simYear: true, hash: true, createdAt: true },
    });
  }

  @ApiOperation({ summary: "Roll the world back to a snapshot tick (SIM_ADMIN+)" })
  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Post(":planetId/rollback")
  async rollback(@Param("planetId") planetId: string, @Body() body: { tick: number }) {
    const ok = await this.manager.rollback(planetId, Math.max(0, Math.floor(body?.tick ?? 0)));
    return { ok };
  }

  @Public()
  @Get(":planetId/compare")
  async compare(
    @Param("planetId") planetId: string,
    @Query("from", ParseIntPipe) from: number,
    @Query("to", ParseIntPipe) to: number,
  ) {
    // era comparison: event counts & stats deltas between two ticks
    const [events, ticks] = await Promise.all([
      this.prisma.worldEvent.groupBy({
        by: ["type"],
        where: { planetId, tick: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.simulationTick.findMany({
        where: { planetId, tick: { in: [from, to] } },
        select: { tick: true, stats: true },
      }),
    ]);
    return { from, to, eventCounts: events, snapshots: ticks };
  }
}
