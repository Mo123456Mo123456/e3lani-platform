import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { WorldEvent, WorldState } from "@planet/shared-types";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required. Use docker compose for a local PostgreSQL sandbox.");
    }
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idleTimeoutMillis: 30_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query("SELECT 1");
    const result = await this.pool.query<{ exists: string | null }>(
      "SELECT to_regclass('public.planets')::text AS exists",
    );
    if (!result.rows[0]?.exists) {
      throw new Error("Database is not migrated. Run `pnpm db:migrate` before starting the API.");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(text, values)).rows;
  }

  async loadLatestWorld(seed: string): Promise<WorldState | null> {
    const rows = await this.query<{ state: WorldState }>(
      `SELECT ts.state
       FROM timeline_snapshots ts
       JOIN planets p ON p.id = ts.planet_id
       WHERE p.seed = $1
       ORDER BY ts.tick DESC
       LIMIT 1`,
      [seed],
    );
    return rows[0]?.state ?? null;
  }

  async listEvents(planetId: string, limit: number, beforeSequence?: number): Promise<WorldEvent[]> {
    const rows = await this.query<{ event: WorldEvent }>(
      `SELECT jsonb_build_object(
          'id', id, 'planetId', planet_id, 'sequence', sequence, 'tick', tick, 'year', year,
          'type', type, 'cause', cause, 'regionId', region_id, 'contributionId', contribution_id,
          'actorIds', actor_ids, 'confidence', confidence, 'directImpact', direct_impact,
          'payload', payload, 'titleAr', title_ar, 'titleEn', title_en,
          'descriptionAr', description_ar, 'descriptionEn', description_en, 'createdAt', created_at
        ) AS event
       FROM world_events
       WHERE planet_id = $1 AND ($2::bigint IS NULL OR sequence < $2)
       ORDER BY sequence DESC
       LIMIT $3`,
      [planetId, beforeSequence ?? null, limit],
    );
    return rows.map((row) => row.event);
  }

  async saveWorld(
    state: WorldState,
    events: WorldEvent[],
    changedRegionIds?: string[],
    tickDurationMs = 0,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.upsertPlanet(client, state);
      const changedSet = changedRegionIds ? new Set(changedRegionIds) : null;
      for (const region of state.regions) {
        if (!changedSet || changedSet.has(region.id)) await this.upsertRegion(client, state, region);
      }
      for (const civilization of state.civilizations) {
        await client.query(
          `INSERT INTO civilizations(
             id, planet_id, region_id, name_ar, name_en, population, technology, economy,
             military, stability, innovation, pollution, relations, historical_memory
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             region_id=EXCLUDED.region_id, population=EXCLUDED.population,
             technology=EXCLUDED.technology, economy=EXCLUDED.economy,
             military=EXCLUDED.military, stability=EXCLUDED.stability,
             innovation=EXCLUDED.innovation, pollution=EXCLUDED.pollution,
             relations=EXCLUDED.relations, historical_memory=EXCLUDED.historical_memory`,
          [
            civilization.id,
            state.planet.id,
            civilization.regionId,
            civilization.nameAr,
            civilization.nameEn,
            civilization.population,
            civilization.technology,
            civilization.economy,
            civilization.military,
            civilization.stability,
            civilization.innovation,
            civilization.pollution,
            JSON.stringify(civilization.relations),
            JSON.stringify(civilization.memory),
          ],
        );
      }
      for (const contribution of state.contributions) {
        await client.query(
          `INSERT INTO user_contributions(
             id,user_id,planet_id,region_id,category,name,description,structured_traits,
             possible_biomes,risks,status,created_tick
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)
           ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, structured_traits=EXCLUDED.structured_traits`,
          [
            contribution.id,
            contribution.ownerId,
            state.planet.id,
            contribution.regionId,
            contribution.category,
            contribution.name,
            contribution.description,
            JSON.stringify(contribution.traits),
            JSON.stringify(contribution.possibleBiomes),
            JSON.stringify(contribution.risks),
            contribution.status,
            contribution.createdAtTick,
          ],
        );
      }
      for (const event of events) await this.insertEvent(client, event);
      if (state.planet.tick > 0) {
        await client.query(
          `INSERT INTO simulation_ticks(
             planet_id,tick,year,seed_state,duration_ms,event_count,checksum
           ) VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (planet_id,tick) DO UPDATE SET
             duration_ms=EXCLUDED.duration_ms,event_count=EXCLUDED.event_count,checksum=EXCLUDED.checksum`,
          [
            state.planet.id,
            state.planet.tick,
            state.planet.year,
            `${state.planet.seed}:${state.planet.tick}`,
            tickDurationMs,
            events.length,
            state.checksum,
          ],
        );
      }
      await client.query(
        `INSERT INTO timeline_snapshots(planet_id,tick,year,checksum,state)
         VALUES($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (planet_id,tick) DO UPDATE SET
           year=EXCLUDED.year,checksum=EXCLUDED.checksum,state=EXCLUDED.state,created_at=now()`,
        [
          state.planet.id,
          state.planet.tick,
          state.planet.year,
          state.checksum,
          JSON.stringify(state),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertPlanet(client: PoolClient, state: WorldState): Promise<void> {
    await client.query(
      `INSERT INTO planets(id,seed,name_ar,name_en,algorithm_version,current_tick,current_year,status)
       VALUES($1,$2,$3,$4,'1.0.0',$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         current_tick=EXCLUDED.current_tick,current_year=EXCLUDED.current_year,status=EXCLUDED.status`,
      [
        state.planet.id,
        state.planet.seed,
        state.planet.nameAr,
        state.planet.nameEn,
        state.planet.tick,
        state.planet.year,
        state.planet.status,
      ],
    );
  }

  private async upsertRegion(
    client: PoolClient,
    state: WorldState,
    region: WorldState["regions"][number],
  ): Promise<void> {
    await client.query(
      `INSERT INTO planet_regions(
         id,planet_id,name_ar,name_en,center,biome_code,elevation,temperature,moisture,
         precipitation,fertility,surface_water,vegetation,pollution,population,
         carrying_capacity,resource_richness,state
       ) VALUES($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'{}')
       ON CONFLICT (id) DO UPDATE SET
         biome_code=EXCLUDED.biome_code,elevation=EXCLUDED.elevation,
         temperature=EXCLUDED.temperature,moisture=EXCLUDED.moisture,
         precipitation=EXCLUDED.precipitation,fertility=EXCLUDED.fertility,
         surface_water=EXCLUDED.surface_water,vegetation=EXCLUDED.vegetation,
         pollution=EXCLUDED.pollution,population=EXCLUDED.population,
         carrying_capacity=EXCLUDED.carrying_capacity,resource_richness=EXCLUDED.resource_richness`,
      [
        region.id,
        state.planet.id,
        region.nameAr,
        region.nameEn,
        region.longitude,
        region.latitude,
        region.biome,
        region.elevation,
        region.temperature,
        region.moisture,
        region.precipitation,
        region.fertility,
        region.water,
        region.vegetation,
        region.pollution,
        region.population,
        region.carryingCapacity,
        region.resourceRichness,
      ],
    );
  }

  private async insertEvent(client: PoolClient, event: WorldEvent): Promise<void> {
    await client.query(
      `INSERT INTO world_events(
         id,planet_id,sequence,tick,year,type,cause,region_id,contribution_id,actor_ids,
         confidence,direct_impact,payload,title_ar,title_en,description_ar,description_en,created_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.planetId,
        event.sequence,
        event.tick,
        event.year,
        event.type,
        event.cause,
        event.regionId ?? null,
        event.contributionId ?? null,
        JSON.stringify(event.actorIds),
        event.confidence,
        JSON.stringify(event.directImpact),
        JSON.stringify(event.payload),
        event.titleAr,
        event.titleEn,
        event.descriptionAr,
        event.descriptionEn,
        event.createdAt,
      ],
    );
    const payload = event.payload as { causeEventId?: string };
    if (payload.causeEventId) {
      await client.query(
        `INSERT INTO causal_links(
           event_id,cause_event_id,contribution_id,relation,strength,explanation_ar,explanation_en
         ) VALUES($1,$2,$3,'caused_by',1,$4,$5)
         ON CONFLICT DO NOTHING`,
        [
          event.id,
          payload.causeEventId,
          event.contributionId ?? null,
          `نتج الحدث عن ${event.cause}`,
          `Event resulted from ${event.cause}`,
        ],
      );
    }
  }
}
