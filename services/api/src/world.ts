import type {
  AnalyzedContribution,
  CausalLink,
  PlanetBootstrap,
  WorldEvent,
  WorldEventType,
} from "@living-planet/shared-types";
import {
  calculateMetrics,
  createInitialState,
  getStateChecksum,
  type SimulationState,
  type TickResult,
} from "@living-planet/simulation-engine";
import type { JSONValue, TransactionSql } from "postgres";
import { getDatabase } from "./database.js";

const asNumber = (value: unknown): number => Number(value ?? 0);
const toJson = (value: unknown): JSONValue => JSON.parse(JSON.stringify(value)) as JSONValue;

interface PlanetRow {
  id: string;
  name: string;
  seed: string;
  current_tick: string | number;
  current_year: string | number;
  tick_unit: "year";
  status: "running" | "paused";
}

interface RegionRow {
  id: string;
  region_index: number;
  name: string;
  latitude: number | string;
  longitude: number | string;
  biome_code: string;
  elevation: number | string;
  temperature: number | string;
  moisture: number | string;
  fertility: number | string;
  surface_water: number | string;
  plate_activity: number | string;
  resource_richness: number | string;
  carrying_capacity: number | string;
  population: number | string;
  pollution: number | string;
  biodiversity: number | string;
  economy: number | string;
}

interface EventRow {
  id: string;
  planet_id: string;
  tick: number | string;
  year: number | string;
  type: WorldEventType;
  title: string;
  summary: string;
  region_id: string;
  latitude: number | string;
  longitude: number | string;
  cause: string;
  direct_effects: Record<string, number>;
  importance: number | string;
  confidence: number | string;
  contribution_id: string | null;
  created_at: Date;
}

function mapEvent(row: EventRow): WorldEvent {
  return {
    id: row.id,
    planetId: row.planet_id,
    tick: asNumber(row.tick),
    year: asNumber(row.year),
    type: row.type,
    title: row.title,
    summary: row.summary,
    regionId: row.region_id,
    coordinates: { latitude: asNumber(row.latitude), longitude: asNumber(row.longitude) },
    cause: row.cause,
    directEffects: row.direct_effects,
    importance: asNumber(row.importance),
    confidence: asNumber(row.confidence),
    contributionId: row.contribution_id,
    createdAt: row.created_at.toISOString(),
  };
}

async function loadPlanet(planetId: string): Promise<PlanetRow> {
  const rows = await getDatabase()<PlanetRow[]>`
    SELECT id, name, seed, current_tick, current_year, tick_unit, status
    FROM planets WHERE id = ${planetId}
  `;
  if (!rows[0]) throw new Error("Planet not found");
  return rows[0];
}

async function loadRegions(planetId: string): Promise<RegionRow[]> {
  return getDatabase()<RegionRow[]>`
    SELECT id, region_index, name, latitude, longitude, biome_code, elevation,
      temperature, moisture, fertility, surface_water, plate_activity,
      resource_richness, carrying_capacity, population, pollution, biodiversity, economy
    FROM planet_regions
    WHERE planet_id = ${planetId}
    ORDER BY region_index
  `;
}

async function loadEvents(planetId: string, limit = 120): Promise<WorldEvent[]> {
  const rows = await getDatabase()<EventRow[]>`
    SELECT e.id, e.planet_id, e.tick, e.year, e.type, e.title, e.summary,
      e.region_id, r.latitude, r.longitude, e.cause, e.direct_effects,
      e.importance, e.confidence, e.contribution_id, e.created_at
    FROM world_events e
    JOIN planet_regions r ON r.id = e.region_id
    WHERE e.planet_id = ${planetId}
    ORDER BY e.tick DESC, e.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapEvent);
}

export async function getBootstrap(planetId: string): Promise<PlanetBootstrap> {
  const planet = await loadPlanet(planetId);
  const regions = await loadRegions(planetId);
  const events = await loadEvents(planetId, 80);
  const metrics = {
    population: regions.reduce((total, region) => total + asNumber(region.population), 0),
    biodiversity: regions.reduce((total, region) => total + asNumber(region.biodiversity), 0) / regions.length,
    meanTemperature: regions.reduce((total, region) => total + asNumber(region.temperature), 0) / regions.length,
    pollution: regions.reduce((total, region) => total + asNumber(region.pollution), 0) / regions.length,
    civilizations: 0,
    activeConflicts: 0,
  };
  const counts = await getDatabase()<[{ civilizations: number | string; conflicts: number | string }]>`
    SELECT
      (SELECT count(*) FROM civilizations WHERE planet_id = ${planetId}) AS civilizations,
      (SELECT count(*) FROM wars WHERE planet_id = ${planetId} AND ended_tick IS NULL) AS conflicts
  `;

  return {
    planet: {
      id: planet.id,
      name: planet.name,
      seed: planet.seed,
      currentTick: asNumber(planet.current_tick),
      currentYear: asNumber(planet.current_year),
      tickUnit: planet.tick_unit,
      status: planet.status,
    },
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name,
      latitude: asNumber(region.latitude),
      longitude: asNumber(region.longitude),
      biome: region.biome_code,
      elevation: asNumber(region.elevation),
      temperature: asNumber(region.temperature),
      moisture: asNumber(region.moisture),
      fertility: asNumber(region.fertility),
      carryingCapacity: asNumber(region.carrying_capacity),
      population: asNumber(region.population),
      pollution: asNumber(region.pollution),
    })),
    events,
    metrics: {
      population: metrics.population,
      biodiversity: Math.round(metrics.biodiversity * 10_000) / 10_000,
      meanTemperature: Math.round(metrics.meanTemperature * 10_000) / 10_000,
      pollution: Math.round(metrics.pollution * 10_000) / 10_000,
      civilizations: asNumber(counts[0]?.civilizations),
      activeConflicts: asNumber(counts[0]?.conflicts),
    },
  };
}

export async function loadSimulationState(planetId: string): Promise<SimulationState> {
  const planet = await loadPlanet(planetId);
  const rows = await loadRegions(planetId);
  const events = (await loadEvents(planetId, 10_000)).sort((left, right) => left.tick - right.tick);
  const eventCountRows = await getDatabase()<[{ count: number | string }]>`
    SELECT count(*) FROM world_events WHERE planet_id = ${planetId}
  `;
  const generated = createInitialState(planet.seed, planet.id);
  for (const row of rows) {
    const region = generated.regions[row.id];
    if (!region) continue;
    generated.regions[row.id] = {
      ...region,
      index: row.region_index,
      name: row.name,
      latitude: asNumber(row.latitude),
      longitude: asNumber(row.longitude),
      biome: row.biome_code as typeof region.biome,
      elevation: asNumber(row.elevation),
      temperature: asNumber(row.temperature),
      moisture: asNumber(row.moisture),
      fertility: asNumber(row.fertility),
      surfaceWater: asNumber(row.surface_water),
      plateActivity: asNumber(row.plate_activity),
      resourceRichness: asNumber(row.resource_richness),
      carryingCapacity: asNumber(row.carrying_capacity),
      population: asNumber(row.population),
      pollution: asNumber(row.pollution),
      biodiversity: asNumber(row.biodiversity),
      economy: asNumber(row.economy),
      vegetation: asNumber(row.fertility),
    };
  }
  const linkRows = await getDatabase()<{
    id: string;
    source_event_id: string;
    target_event_id: string;
    mechanism: string;
    strength: string | number;
  }[]>`
    SELECT id, source_event_id, target_event_id, mechanism, strength
    FROM causal_links WHERE planet_id = ${planetId}
  `;
  return {
    ...generated,
    tick: asNumber(planet.current_tick),
    year: asNumber(planet.current_year),
    sequence: asNumber(eventCountRows[0]?.count),
    events,
    causalLinks: linkRows.map((row): CausalLink => ({
      id: row.id,
      sourceEventId: row.source_event_id,
      targetEventId: row.target_event_id,
      mechanism: row.mechanism,
      strength: asNumber(row.strength),
    })),
  };
}

async function persistEvent(
  transaction: TransactionSql,
  event: WorldEvent,
): Promise<void> {
  await transaction`
    INSERT INTO world_events (
      id, planet_id, tick, year, type, title, summary, region_id, cause,
      direct_effects, importance, confidence, contribution_id, created_at
    ) VALUES (
      ${event.id}, ${event.planetId}, ${event.tick}, ${event.year}, ${event.type},
      ${event.title}, ${event.summary}, ${event.regionId}, ${event.cause},
      ${transaction.json(event.directEffects)}, ${event.importance}, ${event.confidence},
      ${event.contributionId ?? null}, ${event.createdAt}
    )
  `;
}

export async function persistTick(result: TickResult, durationMs: number): Promise<void> {
  const sql = getDatabase();
  await sql.begin(async (transaction) => {
    for (const event of result.events) {
      await persistEvent(transaction, event);
      const region = result.state.regions[event.regionId];
      if (region) {
        await transaction`
          UPDATE planet_regions SET
            temperature = ${region.temperature}, moisture = ${region.moisture},
            population = ${region.population}, pollution = ${region.pollution},
            biodiversity = ${region.biodiversity}, economy = ${region.economy},
            state_version = state_version + 1
          WHERE id = ${region.id}
        `;
      }
    }
    for (const link of result.causalLinks) {
      await transaction`
        INSERT INTO causal_links (
          id, planet_id, source_event_id, target_event_id, mechanism, strength
        ) VALUES (
          ${link.id}, ${result.state.planetId}, ${link.sourceEventId},
          ${link.targetEventId}, ${link.mechanism}, ${link.strength}
        )
      `;
    }
    await transaction`
      UPDATE planets SET current_tick = ${result.state.tick}, current_year = ${result.state.year}
      WHERE id = ${result.state.planetId}
    `;
    await transaction`
      INSERT INTO simulation_ticks (
        planet_id, tick, year, seed, status, duration_ms, event_count, state_checksum
      ) VALUES (
        ${result.state.planetId}, ${result.state.tick}, ${result.state.year}, ${result.state.seed},
        'committed', ${durationMs}, ${result.events.length}, ${getStateChecksum(result.state)}
      )
    `;
    if (result.state.tick % 10 === 0) {
      await transaction`
        INSERT INTO timeline_snapshots (planet_id, tick, year, state, checksum)
        VALUES (
          ${result.state.planetId}, ${result.state.tick}, ${result.state.year},
          ${transaction.json(toJson({
            regions: result.state.regions,
            eventOffset: result.state.sequence,
          }))},
          ${getStateChecksum(result.state)}
        )
        ON CONFLICT (planet_id, tick) DO NOTHING
      `;
    }
  });
}

export async function persistContribution(input: {
  id: string;
  userId: string;
  planetId: string;
  regionId: string;
  originalIdea: string;
  idempotencyKey: string;
  contribution: AnalyzedContribution;
  result: TickResult;
}): Promise<{ event: WorldEvent; existing: boolean }> {
  const sql = getDatabase();
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM user_contributions WHERE idempotency_key = ${input.idempotencyKey}
  `;
  if (existing[0]) {
    const events = await sql<EventRow[]>`
      SELECT e.id, e.planet_id, e.tick, e.year, e.type, e.title, e.summary, e.region_id,
        r.latitude, r.longitude, e.cause, e.direct_effects, e.importance, e.confidence,
        e.contribution_id, e.created_at
      FROM world_events e JOIN planet_regions r ON r.id = e.region_id
      WHERE e.contribution_id = ${existing[0].id} ORDER BY e.created_at LIMIT 1
    `;
    if (!events[0]) throw new Error("Idempotent contribution exists without its event");
    return { event: mapEvent(events[0]), existing: true };
  }
  const event = input.result.events[0];
  if (!event) throw new Error("Simulation produced no contribution event");
  const region = input.result.state.regions[input.regionId];
  if (!region) throw new Error("Simulation produced no target region");

  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO user_contributions (
        id, user_id, planet_id, region_id, category, name, original_idea,
        structured_traits, risks, analysis_metadata, status, introduced_tick, idempotency_key
      ) VALUES (
        ${input.id}, ${input.userId}, ${input.planetId}, ${input.regionId},
        ${input.contribution.category}, ${input.contribution.name}, ${input.originalIdea},
        ${transaction.json(input.contribution.traits)}, ${transaction.json(input.contribution.risks)},
        ${transaction.json({
          provider: input.contribution.provider,
          sandbox: input.contribution.sandbox,
          balance: input.contribution.balance,
        })},
        'active', ${input.result.state.tick}, ${input.idempotencyKey}
      )
    `;
    await persistEvent(transaction, event);
    await transaction`
      UPDATE planet_regions SET
        temperature = ${region.temperature}, moisture = ${region.moisture},
        population = ${region.population}, pollution = ${region.pollution},
        biodiversity = ${region.biodiversity}, economy = ${region.economy},
        state_version = state_version + 1
      WHERE id = ${region.id}
    `;
    await transaction`
      INSERT INTO moderation_results (contribution_id, input_hash, decision, rule_hits, classifier)
      VALUES (
        ${input.id}, encode(digest(${input.originalIdea}, 'sha256'), 'hex'), 'allow',
        '[]', ${transaction.json({ provider: input.contribution.provider, score: 1 })}
      )
    `;
    await transaction`
      INSERT INTO notifications (user_id, event_id, type, title, body)
      VALUES (
        ${input.userId}, ${event.id}, 'contribution.introduced', ${event.title},
        ${`Your contribution entered ${region.name} at year ${event.year}.`}
      )
    `;
    await transaction`
      INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      VALUES (
        ${input.userId}, 'contribution.confirm', 'user_contribution', ${input.id},
        ${transaction.json({ eventId: event.id, regionId: input.regionId })}
      )
    `;
  });
  return { event, existing: false };
}

export async function getCausalGraph(contributionId: string): Promise<{
  events: WorldEvent[];
  links: CausalLink[];
}> {
  const events = await getDatabase()<EventRow[]>`
    SELECT e.id, e.planet_id, e.tick, e.year, e.type, e.title, e.summary, e.region_id,
      r.latitude, r.longitude, e.cause, e.direct_effects, e.importance, e.confidence,
      e.contribution_id, e.created_at
    FROM world_events e JOIN planet_regions r ON r.id = e.region_id
    WHERE e.contribution_id = ${contributionId}
       OR e.id IN (
         SELECT target_event_id FROM causal_links
         WHERE source_event_id IN (SELECT id FROM world_events WHERE contribution_id = ${contributionId})
       )
    ORDER BY e.tick
  `;
  if (events.length === 0) throw new Error("Contribution history not found");
  const ids = events.map((event) => event.id);
  const links = await getDatabase()<{
    id: string;
    source_event_id: string;
    target_event_id: string;
    mechanism: string;
    strength: string | number;
  }[]>`
    SELECT id, source_event_id, target_event_id, mechanism, strength
    FROM causal_links
    WHERE source_event_id = ANY(${ids}) OR target_event_id = ANY(${ids})
  `;
  return {
    events: events.map(mapEvent),
    links: links.map((link) => ({
      id: link.id,
      sourceEventId: link.source_event_id,
      targetEventId: link.target_event_id,
      mechanism: link.mechanism,
      strength: asNumber(link.strength),
    })),
  };
}

export async function compareTimeline(planetId: string, fromTick: number, toTick: number): Promise<{
  from: { tick: number; checksum: string };
  to: { tick: number; checksum: string };
  eventCount: number;
}> {
  const snapshots = await getDatabase()<{
    tick: number | string;
    checksum: string;
  }[]>`
    SELECT tick, checksum FROM timeline_snapshots
    WHERE planet_id = ${planetId} AND tick IN (${fromTick}, ${toTick})
  `;
  const from = snapshots.find((snapshot) => asNumber(snapshot.tick) === fromTick);
  const to = snapshots.find((snapshot) => asNumber(snapshot.tick) === toTick);
  if (!from || !to) throw new Error("Both requested ticks must have snapshots");
  const counts = await getDatabase()<[{ count: number | string }]>`
    SELECT count(*) FROM world_events
    WHERE planet_id = ${planetId} AND tick > ${fromTick} AND tick <= ${toTick}
  `;
  return {
    from: { tick: fromTick, checksum: from.checksum },
    to: { tick: toTick, checksum: to.checksum },
    eventCount: asNumber(counts[0]?.count),
  };
}

export async function rollbackPlanet(planetId: string, tick: number, actorUserId: string): Promise<void> {
  const sql = getDatabase();
  const snapshots = await sql<{
    state: { regions: Record<string, {
      temperature: number;
      moisture: number;
      population: number;
      pollution: number;
      biodiversity: number;
      economy: number;
    }> };
    year: number | string;
  }[]>`
    SELECT state, year FROM timeline_snapshots
    WHERE planet_id = ${planetId} AND tick = ${tick}
  `;
  const snapshot = snapshots[0];
  if (!snapshot) throw new Error("Snapshot not found");
  await sql.begin(async (transaction) => {
    for (const [regionId, region] of Object.entries(snapshot.state.regions)) {
      await transaction`
        UPDATE planet_regions SET
          temperature = ${region.temperature}, moisture = ${region.moisture},
          population = ${region.population}, pollution = ${region.pollution},
          biodiversity = ${region.biodiversity}, economy = ${region.economy},
          state_version = state_version + 1
        WHERE id = ${regionId} AND planet_id = ${planetId}
      `;
    }
    await transaction`DELETE FROM world_events WHERE planet_id = ${planetId} AND tick > ${tick}`;
    await transaction`DELETE FROM simulation_ticks WHERE planet_id = ${planetId} AND tick > ${tick}`;
    await transaction`DELETE FROM timeline_snapshots WHERE planet_id = ${planetId} AND tick > ${tick}`;
    await transaction`
      UPDATE user_contributions SET status = 'pending', introduced_tick = NULL
      WHERE planet_id = ${planetId} AND introduced_tick > ${tick}
    `;
    await transaction`
      UPDATE planets SET current_tick = ${tick}, current_year = ${asNumber(snapshot.year)}, status = 'paused'
      WHERE id = ${planetId}
    `;
    await transaction`
      INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      VALUES (
        ${actorUserId}, 'simulation.rollback', 'planet', ${planetId},
        ${transaction.json({ tick, destructiveFutureBranchRemoval: true })}
      )
    `;
  });
}

export function metricsForState(state: SimulationState) {
  return calculateMetrics(state);
}
