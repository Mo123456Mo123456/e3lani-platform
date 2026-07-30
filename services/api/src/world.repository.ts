import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  connectDatabase,
  type DatabaseConnection,
} from "@planet/database";
import type { WorldEvent } from "@planet/shared-types";
import {
  hashWorld,
  replayWorld,
  type ContributionRecord,
  type WorldState,
} from "@planet/simulation-models";

@Injectable()
export class WorldRepository implements OnModuleDestroy {
  private readonly logger = new Logger(WorldRepository.name);
  private connection: DatabaseConnection | null = null;

  get mode(): "postgresql" | "memory-sandbox" {
    return this.connection ? "postgresql" : "memory-sandbox";
  }

  async initialize(initial: WorldState): Promise<WorldState> {
    const databaseUrl = process.env.DATABASE_URL;
    const environment = process.env.APP_ENV ?? "sandbox";
    if (!databaseUrl) {
      if (environment === "production") {
        throw new Error("DATABASE_URL is mandatory in production");
      }
      this.logger.warn(
        "DATABASE_URL is absent; using explicitly labeled in-memory sandbox persistence",
      );
      return initial;
    }

    this.connection = connectDatabase(databaseUrl);
    const rows = await this.connection.sql`
      SELECT id, sequence, type, tick, year, region_id, contribution_id,
             cause, cause_event_ids, actor_ids, payload, confidence,
             direct_impact, occurred_at
      FROM world_events
      WHERE planet_id = ${initial.id} AND sequence > 0
      ORDER BY sequence ASC
    `;
    const events = rows.map((row) => mapStoredEvent(initial.id, row));
    this.logger.log(`Loaded ${events.length} persisted events from PostgreSQL`);
    return events.length > 0 ? replayWorld(initial, events) : initial;
  }

  async persist(world: WorldState, events: readonly WorldEvent[]): Promise<void> {
    if (!this.connection || events.length === 0) return;
    const connection = this.connection;

    await connection.sql.begin(async (sql) => {
      for (const event of events) {
        if (event.type === "CONTRIBUTION_ADDED") {
          const contribution = event.payload.contribution as ContributionRecord;
          await sql`
            INSERT INTO user_contributions (
              id, planet_id, user_id, region_id, category, name,
              original_idea, structured_analysis, status, idempotency_key
            ) VALUES (
              ${contribution.id}, ${world.id}, ${contribution.userId},
              ${contribution.regionId}, ${contribution.analysis.category},
              ${contribution.analysis.name}, ${contribution.analysis.description},
              ${sql.json(contribution.analysis)}, 'committed', ${contribution.id}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }

        await sql`
          INSERT INTO world_events (
            id, planet_id, sequence, type, tick, year, region_id,
            contribution_id, cause, cause_event_ids, actor_ids, payload,
            confidence, direct_impact, occurred_at
          ) VALUES (
            ${event.id}, ${event.worldId}, ${event.sequence}, ${event.type},
            ${event.tick}, ${event.year}, ${event.regionId},
            ${event.contributionId}, ${event.cause},
            ${sql.json(event.causeEventIds)}, ${sql.json(event.actorIds)},
            ${sql.json(event.payload)}, ${event.confidence},
            ${sql.json(event.directImpact)}, ${event.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
        `;

        if (event.regionId) {
          const region = world.regions.find(({ id }) => id === event.regionId);
          if (region) {
            await sql`
              UPDATE planet_regions
              SET temperature = ${region.temperature},
                  moisture = ${region.moisture},
                  fertility = ${region.fertility},
                  pollution = ${region.pollution},
                  population = ${region.population},
                  updated_at = now()
              WHERE id = ${region.id}
            `;
          }
        }
      }

      for (const edge of world.causalEdges.filter((candidate) =>
        events.some(({ id }) => id === candidate.targetEventId),
      )) {
        await sql`
          INSERT INTO causal_links (
            source_event_id, target_event_id, relation, strength, explanation
          ) VALUES (
            ${edge.sourceEventId}, ${edge.targetEventId}, ${edge.relation},
            ${edge.strength}, ${edge.explanation}
          )
          ON CONFLICT (source_event_id, target_event_id) DO NOTHING
        `;
      }

      await sql`
        UPDATE planets
        SET current_tick = ${world.currentTick},
            current_year = ${world.currentYear},
            state_hash = ${hashWorld(world)},
            updated_at = now()
        WHERE id = ${world.id}
      `;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }
}

function mapStoredEvent(
  worldId: string,
  row: Record<string, unknown>,
): WorldEvent {
  const occurredAt = row.occurred_at;
  return {
    id: String(row.id),
    sequence: Number(row.sequence),
    worldId,
    type: row.type as WorldEvent["type"],
    tick: Number(row.tick),
    year: Number(row.year),
    regionId: row.region_id ? String(row.region_id) : null,
    contributionId: row.contribution_id ? String(row.contribution_id) : null,
    cause: String(row.cause),
    causeEventIds: row.cause_event_ids as string[],
    actorIds: row.actor_ids as string[],
    payload: row.payload as Record<string, unknown>,
    confidence: Number(row.confidence),
    directImpact: row.direct_impact as Record<string, number>,
    createdAt:
      occurredAt instanceof Date
        ? occurredAt.toISOString()
        : new Date(String(occurredAt)).toISOString(),
  };
}
