import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EngineClient, type EngineEvent, type EngineState } from "./engine-client.service";
import { materializeState } from "./materializer";

const SNAPSHOT_INTERVAL = 25;

@Injectable()
export class SimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("SimulationService");
  private timer: NodeJS.Timeout | null = null;
  private advancing = false;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly engine: EngineClient,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const seconds = Number(process.env.SIM_TICK_SECONDS ?? 5);
    if ((process.env.SIM_AUTO_RUN ?? "false") === "true") {
      this.timer = setInterval(() => void this.scheduledTick(), seconds * 1000);
      this.logger.log(`simulation auto-run enabled (${seconds}s per tick)`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async scheduledTick(): Promise<void> {
    if (this.advancing) return;
    this.advancing = true;
    try {
      const planets = await this.db
        .selectFrom("planets")
        .select("id")
        .where("status", "=", "running")
        .execute();
      for (const planet of planets) {
        await this.advancePlanet(planet.id, 1);
      }
    } catch (err) {
      this.logger.error(`scheduled tick failed: ${(err as Error).message}`);
    } finally {
      this.advancing = false;
    }
  }

  async getCurrentPlanet() {
    const planet = await this.db
      .selectFrom("planets")
      .selectAll()
      .orderBy("created_at", "asc")
      .limit(1)
      .executeTakeFirst();
    if (!planet) {
      throw new NotFoundException({ error: "no_planet", hint: "run pnpm db:seed (see README)" });
    }
    return planet;
  }

  async getPlanet(id: string) {
    const planet = await this.db.selectFrom("planets").selectAll().where("id", "=", id).executeTakeFirst();
    if (!planet) throw new NotFoundException({ error: "planet_not_found" });
    return planet;
  }

  /** Algorithmic pre-flight assessment for a contribution. */
  async assessOn(
    planet: { current_state: unknown },
    contribution: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await this.engine.assess(planet.current_state as EngineState, contribution);
    return result.assessment;
  }

  /** Monte-Carlo futures for the preview step (async via jobs). */
  async scenariosOn(
    planet: { current_state: unknown },
    contribution: Record<string, unknown> | null,
    horizons?: number[],
    runs?: number,
  ): Promise<{ report: Record<string, unknown> }> {
    return this.engine.scenarios(planet.current_state as EngineState, contribution, horizons, runs);
  }

  /** Advance the world N ticks: engine -> persist -> events -> materialize
   * -> maps -> snapshots -> realtime deltas -> notifications. */
  async advancePlanet(planetId: string, ticks: number): Promise<{ tick: number; events: EngineEvent[]; hash: string }> {
    const planet = await this.getPlanet(planetId);
    const started = Date.now();
    const result = await this.engine.advance(planet.current_state as EngineState, ticks);
    const durationMs = Date.now() - started;
    const newTick = (result.state.meta.tick as number) ?? planet.tick + ticks;

    await this.persistState(planet.id, result.state, newTick, planet.years_per_tick, durationMs, result.events);
    return { tick: newTick, events: result.events, hash: result.hash };
  }

  async injectContribution(
    planetId: string,
    contribution: Record<string, unknown>,
  ): Promise<{ tick: number; events: EngineEvent[]; hash: string }> {
    const planet = await this.getPlanet(planetId);
    const started = Date.now();
    const result = await this.engine.inject(planet.current_state as EngineState, contribution);
    const durationMs = Date.now() - started;
    const newTick = result.state.meta.tick;
    await this.persistState(planet.id, result.state, newTick, planet.years_per_tick, durationMs, result.events);
    return { tick: newTick, events: result.events, hash: result.hash };
  }

  private async persistState(
    planetId: string,
    state: EngineState,
    tick: number,
    yearsPerTick: number,
    durationMs: number,
    events: EngineEvent[],
  ): Promise<void> {
    const hash = await hashState(state);
    await this.db
      .updateTable("planets")
      .set({ current_state: state as never, tick, state_hash: hash, updated_at: new Date() })
      .where("id", "=", planetId)
      .execute();

    await this.db
      .insertInto("simulation_ticks")
      .values({
        planet_id: planetId,
        tick,
        years_per_tick: yearsPerTick,
        duration_ms: durationMs,
        event_count: events.length,
        state_hash: hash,
      })
      .onConflict((oc) => oc.columns(["planet_id", "tick"]).doNothing())
      .execute();

    if (events.length) {
      await this.db
        .insertInto("world_events")
        .values(
          events.map((e) => ({
            planet_id: planetId,
            id: e.id,
            tick: e.tick,
            type: e.type,
            importance: e.importance,
            cell_id: e.cellId,
            civ_ids: JSON.stringify(e.civIds ?? []),
            species_ids: JSON.stringify(e.speciesIds ?? []),
            plant_ids: JSON.stringify(e.plantIds ?? []),
            cause_event_id: e.causeEventId,
            contribution_id: isUuid(e.contributionId) ? e.contributionId : null,
            confidence: e.confidence,
            payload: e.payload ?? {},
          })),
        )
        .onConflict((oc) => oc.columns(["planet_id", "id"]).doNothing())
        .execute();
      await this.db
        .insertInto("causal_links")
        .values(
          events.map((e) => ({
            planet_id: planetId,
            event_id: e.id,
            cause_event_id: e.causeEventId,
            contribution_id: isUuid(e.contributionId) ? e.contributionId : null,
          })),
        )
        .onConflict((oc) => oc.columns(["planet_id", "event_id"]).doNothing())
        .execute();
    }

    await materializeState(this.db, planetId, state, tick);

    if (tick % SNAPSHOT_INTERVAL === 0 || events.some((e) => e.importance >= 5)) {
      await this.createSnapshot(planetId, tick, state, hash);
    }

    // realtime deltas
    this.gateway.broadcastTick(planetId, tick, hash);
    for (const event of events) {
      if (event.importance >= 2) {
        this.gateway.broadcastWorldEvent(planetId, {
          id: event.id,
          tick: event.tick,
          type: event.type as never,
          importance: event.importance as never,
          cellId: event.cellId,
          civIds: event.civIds ?? [],
          speciesIds: event.speciesIds ?? [],
          plantIds: event.plantIds ?? [],
          causeEventId: event.causeEventId,
          contributionId: event.contributionId,
          confidence: event.confidence,
          payload: event.payload ?? {},
        });
      }
    }
    await this.notifications.processEvents(planetId, events);
  }

  async createSnapshot(planetId: string, tick: number, state: EngineState, hash?: string): Promise<void> {
    const summary = summarizeState(state);
    await this.db
      .insertInto("timeline_snapshots")
      .values({
        planet_id: planetId,
        tick,
        state: state as never,
        state_hash: hash ?? (await hashState(state)),
        summary,
      })
      .onConflict((oc) => oc.columns(["planet_id", "tick"]).doNothing())
      .execute();
    // climate cells for this snapshot (bounded: keep latest 40 snapshots)
    const cells = state.cells as Array<Record<string, number | string | boolean>>;
    const rows = cells.map((c) => ({
      planet_id: planetId,
      cell_id: c.id as number,
      tick,
      temp: c.temp as number,
      moisture: c.moisture as number,
      drought_streak: (c.droughtStreak as number) ?? 0,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await this.db
        .insertInto("climate_cells")
        .values(rows.slice(i, i + 500))
        .onConflict((oc) => oc.columns(["planet_id", "cell_id", "tick"]).doNothing())
        .execute();
    }
  }

  /** Render map layer PNGs from current state and store them. */
  async renderMaps(planetId: string, force = false): Promise<number> {
    const planet = await this.getPlanet(planetId);
    if (!force && planet.map_tick === planet.tick) return planet.tick;
    const { layers, tick } = await this.engine.maps(planet.current_state as EngineState);
    for (const [layer, base64] of Object.entries(layers)) {
      await this.db
        .insertInto("planet_map_layers")
        .values({ planet_id: planetId, layer, tick, png: Buffer.from(base64, "base64") })
        .onConflict((oc) =>
          oc.columns(["planet_id", "layer", "tick"]).doUpdateSet({ png: Buffer.from(base64, "base64") }),
        )
        .execute();
    }
    await this.db.updateTable("planets").set({ map_tick: tick }).where("id", "=", planetId).execute();
    return tick;
  }

  async getMapLayer(planetId: string, layer: string, atTick?: number): Promise<{ png: Buffer; tick: number }> {
    let q = this.db
      .selectFrom("planet_map_layers")
      .select(["png", "tick"])
      .where("planet_id", "=", planetId)
      .where("layer", "=", layer);
    if (atTick !== undefined) {
      q = q.where("tick", "<=", atTick);
    }
    const row = await q.orderBy("tick", "desc").limit(1).executeTakeFirst();
    if (!row) {
      const tick = await this.renderMaps(planetId, true);
      const fresh = await this.db
        .selectFrom("planet_map_layers")
        .select(["png", "tick"])
        .where("planet_id", "=", planetId)
        .where("layer", "=", layer)
        .where("tick", "=", tick)
        .executeTakeFirstOrThrow();
      return fresh;
    }
    return row;
  }

  async setStatus(planetId: string, status: "running" | "paused"): Promise<void> {
    await this.db.updateTable("planets").set({ status, updated_at: new Date() }).where("id", "=", planetId).execute();
    this.gateway.emitToPlanet(planetId, "sim:state", { planetId, status, tick: (await this.getPlanet(planetId)).tick });
  }

  /** Rollback restores the snapshot state and truncates later history. */
  async rollback(planetId: string, snapshotTick: number): Promise<{ tick: number }> {
    const snapshot = await this.db
      .selectFrom("timeline_snapshots")
      .selectAll()
      .where("planet_id", "=", planetId)
      .where("tick", "=", snapshotTick)
      .executeTakeFirst();
    if (!snapshot) {
      throw new BadRequestException({ error: "snapshot_not_found", tick: snapshotTick });
    }
    const state = snapshot.state as EngineState;
    state.meta.tick = snapshotTick;
    await this.db
      .updateTable("planets")
      .set({
        current_state: state as never,
        tick: snapshotTick,
        state_hash: snapshot.state_hash,
        status: "paused",
        updated_at: new Date(),
      })
      .where("id", "=", planetId)
      .execute();
    await this.db.deleteFrom("world_events").where("planet_id", "=", planetId).where("tick", ">", snapshotTick).execute();
    await this.db.deleteFrom("causal_links").where("planet_id", "=", planetId).where((eb) =>
      eb("event_id", "not in", eb.selectFrom("world_events").select("id").where("planet_id", "=", planetId)),
    ).execute();
    await this.db.deleteFrom("simulation_ticks").where("planet_id", "=", planetId).where("tick", ">", snapshotTick).execute();
    await this.db.deleteFrom("timeline_snapshots").where("planet_id", "=", planetId).where("tick", ">", snapshotTick).execute();
    await materializeState(this.db, planetId, state, snapshotTick);
    await this.renderMaps(planetId, true);
    this.gateway.emitToPlanet(planetId, "sim:state", { planetId, status: "paused", tick: snapshotTick });
    return { tick: snapshotTick };
  }
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function summarizeState(state: EngineState): Record<string, number> {
  const civs = Object.values((state.civilizations as Record<string, { extinct: boolean; population: number }>) ?? {});
  const aliveCivs = civs.filter((c) => !c.extinct);
  const species = Object.values((state.species as Record<string, { extinct: boolean }>) ?? {});
  const plants = Object.values((state.plants as Record<string, { extinct: boolean }>) ?? {});
  const cells = (state.cells as Array<{ pollution: number; biome: string }>) ?? [];
  const land = cells.filter((c) => c.biome !== "ocean" && c.biome !== "coast");
  return {
    civilizations: aliveCivs.length,
    cities: Object.keys((state.cities as object) ?? {}).length,
    species: species.filter((s) => !s.extinct).length,
    plants: plants.filter((p) => !p.extinct).length,
    population: Math.round(aliveCivs.reduce((a, c) => a + c.population, 0)),
    tempShift: Number(state.meta.globalTempShift ?? 0),
    pollution: land.length ? land.reduce((a, c) => a + c.pollution, 0) / land.length : 0,
    events: (state.events as unknown[]).length,
  };
}

async function hashState(state: EngineState): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 32);
}
