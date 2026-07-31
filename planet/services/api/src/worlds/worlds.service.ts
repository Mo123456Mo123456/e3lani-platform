import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { WorldEvent } from "@planet/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { EngineClient } from "../common/engine.client.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";

/**
 * Worlds orchestration: the engine computes, the API persists and fans out.
 * Every tick batch lands in Postgres (events, causal links, tick records,
 * planet cursor) and is pushed to subscribed WebSocket clients as deltas.
 */
@Injectable()
export class WorldsService {
  constructor(
    private prisma: PrismaService,
    private engine: EngineClient,
    private realtime: RealtimeGateway,
  ) {}

  async listPlanets() {
    return this.prisma.planet.findMany({
      select: {
        id: true, name: true, seed: true, status: true, currentTick: true,
        yearsPerTick: true, era: true, createdAt: true,
        _count: { select: { civilizations: true, events: true, contributions: true } },
      },
    });
  }

  async getPlanet(id: string) {
    const planet = await this.prisma.planet.findUnique({
      where: { id },
      include: { _count: { select: { events: true, civilizations: true, cities: true, species: true, plants: true, technologies: true } } },
    });
    if (!planet) throw new NotFoundException("planet_not_found");
    return planet;
  }

  /**
   * Ensure the engine holds this world in memory before live operations,
   * deterministically fast-forwarding it to the DB cursor. Identical seed +
   * identical history ⇒ identical state (proven by engine determinism tests),
   * so the live continuation keeps the event seq/hash chain coherent.
   */
  async ensureEngineWorld(planetId: string): Promise<void> {
    const planet = await this.getPlanet(planetId);
    const { meta } = await this.engine.ensureWorld({
      worldId: planet.id,
      name: planet.name,
      seed: planet.seed,
      yearsPerTick: planet.yearsPerTick,
    });
    const behind = planet.currentTick - (meta?.tick ?? 0);
    if (behind > 0) {
      // Catch up in bounded batches so the engine stays responsive.
      const BATCH = 250;
      for (let done = 0; done < behind; done += BATCH) {
        await this.engine.runTicks(planetId, Math.min(BATCH, behind - done));
      }
    }
  }

  async grid(planetId: string) {
    await this.ensureEngineWorld(planetId);
    return this.engine.grid(planetId);
  }

  async liveSnapshot(planetId: string) {
    await this.ensureEngineWorld(planetId);
    return this.engine.snapshot(planetId);
  }

  async region(planetId: string, cell: number) {
    // Prefer DB-persisted region state; refresh from engine when live.
    const fromDb = await this.prisma.planetRegion.findUnique({
      where: { planetId_cellIndex: { planetId, cellIndex: cell } },
    });
    if (fromDb) return fromDb;
    await this.ensureEngineWorld(planetId);
    return this.engine.region(planetId, cell);
  }

  async timeline(planetId: string) {
    return this.prisma.timelineSnapshot.findMany({
      where: { planetId },
      orderBy: { tick: "asc" },
      select: { tick: true, year: true, checksum: true, state: true },
    });
  }

  /**
   * Advance the simulation N ticks, persist everything, broadcast deltas.
   * Returns the newly persisted events.
   */
  async advanceTicks(planetId: string, count: number): Promise<WorldEvent[]> {
    await this.ensureEngineWorld(planetId);
    const started = Date.now();
    const result = await this.engine.runTicks(planetId, count);
    const events = (result.events ?? []) as WorldEvent[];
    await this.persistEvents(planetId, events);

    const planet = await this.prisma.planet.update({
      where: { id: planetId },
      data: { currentTick: result.tick },
    });
    await this.prisma.simulationTick.createMany({
      data: Array.from({ length: Math.min(count, 100) }, (_, i) => ({
        planetId,
        tick: result.tick - count + i + 1,
        year: (result.tick - count + i + 1) * planet.yearsPerTick,
        eventCount: events.filter((e) => e.tick === result.tick - count + i + 1).length,
        checksum: events[events.length - 1]?.hash ?? "none",
        durationMs: Math.round((Date.now() - started) / count),
      })),
      skipDuplicates: true,
    });
    if (result.tick % 25 < count) {
      await this.recordTimelineSnapshot(planetId, result.tick, result.year);
    }

    for (const event of events.slice(-50)) {
      this.realtime.broadcastToWorld(planetId, { kind: "world.event", worldId: planetId, event });
    }
    this.realtime.broadcastToWorld(planetId, {
      kind: "tick.completed",
      worldId: planetId,
      tick: result.tick,
      year: result.year,
      eventCount: events.length,
    });
    return events;
  }

  /** Push a single event delta to all subscribers of this world. */
  broadcastEvent(planetId: string, event: WorldEvent): void {
    this.realtime.broadcastToWorld(planetId, { kind: "world.event", worldId: planetId, event });
  }

  async persistEvents(planetId: string, events: WorldEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.prisma.worldEvent.createMany({
      data: events.map((e) => ({
        planetId,
        seq: e.seq,
        tick: e.tick,
        year: e.year,
        type: String(e.type),
        cellIndex: e.cellIndex ?? null,
        civIds: e.civIds ?? [],
        payload: (e.payload ?? {}) as Prisma.InputJsonValue,
        causes: e.causes ?? [],
        confidence: e.confidence,
        contributionId: e.contributionId ?? null,
        importance: e.importance,
        hash: e.hash,
      })),
      skipDuplicates: true,
    });
    const links = events.flatMap((e) =>
      e.causes.map((c) => ({ planetId, fromSeq: c, toSeq: e.seq, relation: "causes" })),
    );
    if (links.length > 0) {
      await this.prisma.causalLink.createMany({ data: links, skipDuplicates: true });
    }
  }

  private async recordTimelineSnapshot(planetId: string, tick: number, year: number): Promise<void> {
    const snap = (await this.engine.snapshot(planetId)) as { stats?: Prisma.InputJsonValue };
    await this.prisma.timelineSnapshot.upsert({
      where: { planetId_tick: { planetId, tick } },
      create: { planetId, tick, year, checksum: `snap-${tick}`, state: { stats: snap.stats ?? {} } as Prisma.InputJsonValue },
      update: { state: { stats: snap.stats ?? {} } as Prisma.InputJsonValue },
    });
  }

  async rollback(planetId: string, tick: number) {
    await this.ensureEngineWorld(planetId);
    const result = await this.engine.rollback(planetId, tick);
    await this.prisma.planet.update({ where: { id: planetId }, data: { currentTick: tick } });
    await this.prisma.auditLog.create({
      data: { action: "world.rollback", targetType: "Planet", targetId: planetId, metadata: { tick } },
    });
    return result;
  }
}
