import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  ContributionAnalysis,
  WorldEvent,
  WorldOverview,
  WorldState,
} from "@planet/shared-types";
import {
  applyContribution,
  deterministicId,
  generateWorld,
  simulateTick,
} from "@planet/simulation-models";

const hashState = (state: WorldState) =>
  createHash("sha256").update(JSON.stringify(state)).digest("hex");

interface EventRow {
  id: string;
  planet_id: string;
  type: WorldEvent["type"];
  tick: string;
  year: string;
  region_id: string | null;
  cause: string;
  actor_ids: string[];
  payload: Record<string, unknown>;
  confidence: number;
  direct_impact: Record<string, number>;
  root_contribution_id: string | null;
  created_at: Date;
}

function mapEvent(row: EventRow): WorldEvent {
  return {
    id: row.id,
    planetId: row.planet_id,
    type: row.type,
    tick: Number(row.tick),
    year: Number(row.year),
    regionId: row.region_id,
    cause: row.cause,
    actorIds: row.actor_ids,
    payload: row.payload,
    confidence: row.confidence,
    directImpact: row.direct_impact,
    rootContributionId: row.root_contribution_id,
    causedByEventIds: [],
    createdAt: row.created_at.toISOString(),
  };
}

export class WorldStore {
  constructor(
    private readonly pool: Pool,
    private readonly seed: string,
  ) {}

  async ensureWorld(): Promise<WorldState> {
    const existing = await this.pool.query<{ id: string }>(
      "SELECT id FROM planets WHERE seed = $1",
      [this.seed],
    );
    if (existing.rows[0]) return this.getState(existing.rows[0].id);

    const state = generateWorld({ seed: this.seed });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO planets(id, name, seed, current_tick, current_year, version, simulation_status)
         VALUES ($1, $2, $3, 0, 0, 1, 'paused')
         ON CONFLICT (seed) DO NOTHING`,
        [state.planetId, "Gaia Prima", state.seed],
      );
      const won = await client.query<{ id: string }>("SELECT id FROM planets WHERE seed = $1", [
        this.seed,
      ]);
      if (won.rows[0]?.id !== state.planetId) {
        await client.query("ROLLBACK");
        return this.getState(won.rows[0]!.id);
      }
      await this.insertRegions(client, state);
      await this.insertCivilizations(client, state);
      await this.insertSpecies(client, state);
      const worldCreated: WorldEvent = {
        id: deterministicId(`${state.seed}:event:world-created`),
        planetId: state.planetId,
        type: "WORLD_CREATED",
        tick: 0,
        year: 0,
        regionId: null,
        cause: "The configured deterministic seed generated the initial world",
        actorIds: [],
        payload: {
          seed: state.seed,
          regions: state.regions.length,
          civilizations: state.civilizations.length,
          species: state.species.length,
        },
        confidence: 1,
        directImpact: {},
        rootContributionId: null,
        causedByEventIds: [],
        createdAt: new Date(Date.UTC(2000, 0, 1)).toISOString(),
      };
      await this.insertEvents(client, [worldCreated]);
      await this.insertSnapshot(client, state);
      await client.query("COMMIT");
      return state;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getOverview(): Promise<WorldOverview> {
    const state = await this.ensureWorld();
    const [events, count, status] = await Promise.all([
      this.pool.query<EventRow>(
        `SELECT id, planet_id, type, tick, year, region_id, cause, actor_ids, payload,
                confidence, direct_impact, root_contribution_id, created_at
         FROM world_events WHERE planet_id = $1 ORDER BY sequence DESC LIMIT 60`,
        [state.planetId],
      ),
      this.pool.query<{ count: string }>(
        "SELECT count(*) FROM user_contributions WHERE planet_id = $1",
        [state.planetId],
      ),
      this.pool.query<{ simulation_status: "running" | "paused" }>(
        "SELECT simulation_status FROM planets WHERE id = $1",
        [state.planetId],
      ),
    ]);
    return {
      state,
      recentEvents: events.rows.map(mapEvent),
      contributionCount: Number(count.rows[0]?.count ?? 0),
      simulationStatus: status.rows[0]?.simulation_status ?? "paused",
      dataSource: "postgresql",
    };
  }

  async getState(planetId: string): Promise<WorldState> {
    const result = await this.pool.query<{ state: WorldState }>(
      `SELECT state FROM timeline_snapshots
       WHERE planet_id = $1 ORDER BY version DESC LIMIT 1`,
      [planetId],
    );
    if (!result.rows[0]) throw new Error("World has no snapshot");
    return result.rows[0].state;
  }

  async addContribution(input: {
    userId: string;
    analysis: ContributionAnalysis;
    regionId: string;
    expectedVersion: number;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const state = await this.lockCurrentState(client);
      if (state.version !== input.expectedVersion) {
        const error = new Error("WORLD_VERSION_CONFLICT");
        Object.assign(error, { statusCode: 409 });
        throw error;
      }
      const contributionId = randomUUID();
      await client.query(
        `INSERT INTO user_contributions(
           id, user_id, planet_id, region_id, category, name, idea, analysis, created_tick
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          contributionId,
          input.userId,
          state.planetId,
          input.regionId,
          input.analysis.category,
          input.analysis.name,
          input.analysis.description,
          JSON.stringify(input.analysis),
          state.tick,
        ],
      );
      const result = applyContribution(
        state,
        contributionId,
        input.analysis,
        input.regionId,
      );
      await this.persistMutation(client, result.state, result.events);
      await client.query(
        `INSERT INTO notifications(user_id, type, title, body, world_event_id)
         VALUES ($1, 'CONTRIBUTION_ACTIVE', $2, $3, $4)`,
        [
          input.userId,
          input.analysis.name,
          "Your contribution entered the causal simulation",
          result.events[0]?.id,
        ],
      );
      await client.query("COMMIT");
      return { contributionId, ...result };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async runTicks(count: number) {
    const client = await this.pool.connect();
    const allEvents: WorldEvent[] = [];
    let lastDelta;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      let state = await this.lockCurrentState(client);
      await client.query("UPDATE planets SET simulation_status = 'running' WHERE id = $1", [
        state.planetId,
      ]);
      for (let index = 0; index < count; index += 1) {
        const started = performance.now();
        const result = simulateTick(state);
        const durationMs = Math.round(performance.now() - started);
        await this.persistMutation(client, result.state, result.events);
        await client.query(
          `INSERT INTO simulation_ticks(
             planet_id, tick, year, seed, duration_ms, event_count, state_hash
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (planet_id, tick) DO NOTHING`,
          [
            state.planetId,
            result.state.tick,
            result.state.year,
            `${state.seed}:tick:${result.state.tick}`,
            durationMs,
            result.events.length,
            hashState(result.state),
          ],
        );
        state = result.state;
        lastDelta = result.delta;
        allEvents.push(...result.events);
      }
      await client.query("UPDATE planets SET simulation_status = 'paused' WHERE id = $1", [
        state.planetId,
      ]);
      await client.query("COMMIT");
      return { state, delta: lastDelta, events: allEvents };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async events(limit = 100): Promise<WorldEvent[]> {
    const state = await this.ensureWorld();
    const result = await this.pool.query<EventRow>(
      `SELECT id, planet_id, type, tick, year, region_id, cause, actor_ids, payload,
              confidence, direct_impact, root_contribution_id, created_at
       FROM world_events WHERE planet_id = $1 ORDER BY sequence DESC LIMIT $2`,
      [state.planetId, Math.min(limit, 500)],
    );
    return result.rows.map(mapEvent);
  }

  async causalGraph(eventId: string) {
    const result = await this.pool.query(
      `WITH RECURSIVE graph AS (
         SELECT cl.*, 1 AS depth FROM causal_links cl
         WHERE cl.from_event_id = $1 OR cl.to_event_id = $1
         UNION ALL
         SELECT cl.*, graph.depth + 1 FROM causal_links cl
         JOIN graph ON cl.from_event_id = graph.to_event_id
         WHERE graph.depth < 8
       )
       SELECT DISTINCT graph.*, source.type AS source_type, target.type AS target_type
       FROM graph
       JOIN world_events source ON source.id = graph.from_event_id
       JOIN world_events target ON target.id = graph.to_event_id`,
      [eventId],
    );
    return result.rows;
  }

  private async lockCurrentState(client: PoolClient): Promise<WorldState> {
    const planet = await client.query<{ id: string }>(
      "SELECT id FROM planets WHERE seed = $1 FOR UPDATE",
      [this.seed],
    );
    if (!planet.rows[0]) throw new Error("World is not initialized");
    const snapshot = await client.query<{ state: WorldState }>(
      "SELECT state FROM timeline_snapshots WHERE planet_id = $1 ORDER BY version DESC LIMIT 1",
      [planet.rows[0].id],
    );
    if (!snapshot.rows[0]) throw new Error("World has no snapshot");
    return snapshot.rows[0].state;
  }

  private async persistMutation(
    client: PoolClient,
    state: WorldState,
    events: WorldEvent[],
  ): Promise<void> {
    await this.insertEvents(client, events);
    await this.updateRegions(client, state);
    await this.updateCivilizations(client, state);
    await this.insertSnapshot(client, state);
    await client.query(
      `UPDATE planets SET current_tick=$2, current_year=$3, version=$4 WHERE id=$1`,
      [state.planetId, state.tick, state.year, state.version],
    );
  }

  private async insertSnapshot(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `INSERT INTO timeline_snapshots(planet_id,tick,year,version,state,state_hash)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (planet_id, version) DO NOTHING`,
      [
        state.planetId,
        state.tick,
        state.year,
        state.version,
        JSON.stringify(state),
        hashState(state),
      ],
    );
  }

  private async insertEvents(client: PoolClient, events: WorldEvent[]): Promise<void> {
    for (const event of events) {
      await client.query(
        `INSERT INTO world_events(
           id,planet_id,type,tick,year,region_id,cause,actor_ids,payload,confidence,
           direct_impact,root_contribution_id,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.planetId,
          event.type,
          event.tick,
          event.year,
          event.regionId,
          event.cause,
          JSON.stringify(event.actorIds),
          JSON.stringify(event.payload),
          event.confidence,
          JSON.stringify(event.directImpact),
          event.rootContributionId,
          event.createdAt,
        ],
      );
    }
    for (const event of events) {
      for (const causeId of event.causedByEventIds) {
        await client.query(
          `INSERT INTO causal_links(
             from_event_id,to_event_id,relation,strength,explanation
           ) VALUES ($1,$2,'causes',$3,$4)
           ON CONFLICT (from_event_id,to_event_id,relation) DO NOTHING`,
          [causeId, event.id, event.confidence, event.cause],
        );
      }
    }
  }

  private async insertRegions(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `INSERT INTO planet_regions(
         id,planet_id,region_index,location,biome_code,elevation,temperature,moisture,
         rainfall,fertility,surface_water,vegetation,pollution,population,resources
       )
       SELECT x.id::uuid, $2::uuid, x.region_index,
         ST_SetSRID(ST_MakePoint(x.longitude,x.latitude),4326)::geography,
         x.biome_code,x.elevation,x.temperature,x.moisture,x.rainfall,x.fertility,
         x.surface_water,x.vegetation,x.pollution,x.population,x.resources
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,region_index int,longitude real,latitude real,biome_code text,elevation real,
         temperature real,moisture real,rainfall real,fertility real,surface_water real,
         vegetation real,pollution real,population bigint,resources jsonb
       )`,
      [
        JSON.stringify(
          state.regions.map((region) => ({
            ...region,
            region_index: region.index,
            biome_code: region.biome,
            surface_water: region.surfaceWater,
          })),
        ),
        state.planetId,
      ],
    );
  }

  private async insertCivilizations(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `INSERT INTO civilizations(id,planet_id,capital_region_id,name,state,population)
       SELECT x.id::uuid,$2::uuid,x.region_id::uuid,x.name,x.state,x.population
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,region_id text,name text,state jsonb,population bigint
       )`,
      [
        JSON.stringify(
          state.civilizations.map((civilization) => ({
            id: civilization.id,
            region_id: civilization.regionId,
            name: civilization.name,
            state: civilization,
            population: civilization.population,
          })),
        ),
        state.planetId,
      ],
    );
  }

  private async insertSpecies(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `INSERT INTO species(
         id,planet_id,region_id,name,traits,population,carrying_capacity
       )
       SELECT x.id::uuid,$2::uuid,x.region_id::uuid,x.name,x.traits,x.population,x.carrying_capacity
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,region_id text,name text,traits jsonb,population bigint,carrying_capacity bigint
       )`,
      [
        JSON.stringify(
          state.species.map((species) => ({
            id: species.id,
            region_id: species.regionId,
            name: species.name,
            traits: species,
            population: species.population,
            carrying_capacity: species.carryingCapacity,
          })),
        ),
        state.planetId,
      ],
    );
  }

  private async updateRegions(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `UPDATE planet_regions region SET
         temperature=x.temperature,moisture=x.moisture,rainfall=x.rainfall,
         surface_water=x.surface_water,vegetation=x.vegetation,pollution=x.pollution,
         population=x.population,resources=x.resources
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text,temperature real,moisture real,rainfall real,surface_water real,
         vegetation real,pollution real,population bigint,resources jsonb
       ) WHERE region.id=x.id::uuid`,
      [
        JSON.stringify(
          state.regions.map((region) => ({
            ...region,
            surface_water: region.surfaceWater,
          })),
        ),
      ],
    );
  }

  private async updateCivilizations(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `UPDATE civilizations civilization SET state=x.state,population=x.population
       FROM jsonb_to_recordset($1::jsonb) AS x(id text,state jsonb,population bigint)
       WHERE civilization.id=x.id::uuid`,
      [
        JSON.stringify(
          state.civilizations.map((civilization) => ({
            id: civilization.id,
            state: civilization,
            population: civilization.population,
          })),
        ),
      ],
    );
  }
}
