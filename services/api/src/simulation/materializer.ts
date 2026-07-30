import { sql, type Kysely } from "kysely";
import type { Database } from "../db/kysely.types";
import type { EngineState } from "./engine-client.service";

const CHUNK = 400;

interface CellState {
  id: number;
  lat: number;
  lon: number;
  biome: string;
  height: number;
  temp: number;
  moisture: number;
  fertility: number;
  pollution: number;
  vegetation: number;
  freshwater: boolean;
  owner: string | null;
  cityId: string | null;
  deposits: Record<string, number>;
  droughtStreak?: number;
}

/**
 * Projects the authoritative engine state into relational read models
 * (regions, civs, species, ...). Runs after every advance/inject.
 */
export async function materializeState(
  db: Kysely<Database>,
  planetId: string,
  state: EngineState,
  tick: number,
): Promise<void> {
  const cells = state.cells as unknown as CellState[];
  const plantsPresence = new Map<string, number>();
  const speciesPresence = new Map<string, number>();
  for (const plant of Object.values(state.plants as Record<string, { presence?: Record<string, number>; extinct: boolean }>)) {
    if (plant.extinct) continue;
    for (const cid of Object.keys(plant.presence ?? {})) {
      plantsPresence.set(cid, (plantsPresence.get(cid) ?? 0) + 1);
    }
  }
  for (const sp of Object.values(state.species as Record<string, { populations?: Record<string, number>; extinct: boolean }>)) {
    if (sp.extinct) continue;
    for (const cid of Object.keys(sp.populations ?? {})) {
      speciesPresence.set(cid, (speciesPresence.get(cid) ?? 0) + 1);
    }
  }

  await upsertInChunks(db, "planet_regions", cells.map((c) => ({
    planet_id: planetId,
    cell_id: c.id,
    geom: null,
    lat: c.lat,
    lon: c.lon,
    biome: c.biome,
    height: c.height,
    fertility: c.fertility,
    pollution: c.pollution,
    vegetation: c.vegetation,
    freshwater: c.freshwater,
    owner_civ_id: c.owner,
    city_id: c.cityId,
    deposits: c.deposits,
    present_plants: plantsPresence.get(String(c.id)) ?? 0,
    present_species: speciesPresence.get(String(c.id)) ?? 0,
    updated_tick: tick,
  })), ["planet_id", "cell_id"]);

  const civs = Object.values(state.civilizations as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "civilizations", civs.map((c) => ({
    planet_id: planetId,
    id: c.id as string,
    name: c.name as string,
    culture: c.culture as string,
    language: c.language as string,
    government: c.government as string,
    population: c.population as number,
    tech_level: c.techLevel as number,
    military: c.military as number,
    treasury: c.treasury as number,
    happiness: c.happiness as number,
    health: c.health as number,
    stability: c.stability as number,
    education: c.education as number,
    personality: c.personality as Record<string, number>,
    relationships: c.relationships as Record<string, unknown>,
    memory: c.memory as string[],
    extinct: c.extinct as boolean,
    contribution_id: (c.contributionId as string | null) ?? null,
    updated_tick: tick,
  })), ["planet_id", "id"]);

  const cities = Object.values(state.cities as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "cities", cities.map((c) => ({
    planet_id: planetId,
    id: c.id as string,
    civ_id: c.civId as string,
    cell_id: c.cellId as number,
    name: c.name as string,
    population: c.population as number,
    founded_tick: c.foundedTick as number,
    updated_tick: tick,
  })), ["planet_id", "id"]);

  const species = Object.values(state.species as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "species", species.map((s) => ({
    planet_id: planetId,
    id: s.id as string,
    name: s.name as string,
    traits: s.traits as Record<string, unknown>,
    diet: (s.traits as { diet?: string }).diet ?? "herbivore",
    total_population: Object.values((s.populations as Record<string, number>) ?? {}).reduce((a, b) => a + b, 0),
    cell_count: Object.keys((s.populations as Record<string, number>) ?? {}).length,
    extinct: s.extinct as boolean,
    parent_id: (s.parentId as string | null) ?? null,
    contribution_id: (s.contributionId as string | null) ?? null,
    updated_tick: tick,
  })), ["planet_id", "id"]);

  const plants = Object.values(state.plants as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "plants", plants.map((p) => ({
    planet_id: planetId,
    id: p.id as string,
    name: p.name as string,
    home_biome: p.homeBiome as string,
    traits: p.traits as Record<string, unknown>,
    cell_count: Object.keys((p.presence as Record<string, number>) ?? {}).length,
    extinct: p.extinct as boolean,
    contribution_id: (p.contributionId as string | null) ?? null,
    updated_tick: tick,
  })), ["planet_id", "id"]);

  const techs = Object.values(state.technologies as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "technologies", techs.map((t) => ({
    planet_id: planetId,
    id: t.id as string,
    name: t.name as string,
    tier: t.tier as number,
    discovered_by: (t.discoveredBy as string | null) ?? null,
    discovered_tick: (t.tick as number | null) ?? null,
    contribution_id: (t.contributionId as string | null) ?? null,
  })), ["planet_id", "id"]);

  const resources = Object.values(state.resources as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "resources", resources.map((r) => ({
    planet_id: planetId,
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    base_value: r.baseValue as number,
    regen: r.regen as number,
    env_impact: r.envImpact as number,
    contribution_id: (r.contributionId as string | null) ?? null,
  })), ["planet_id", "id"]);

  const routes = Object.values(state.tradeRoutes as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "trade_routes", routes.map((r) => ({
    planet_id: planetId,
    id: r.id as string,
    civ_a: r.civA as string,
    civ_b: r.civB as string,
    city_a: r.cityA as string,
    city_b: r.cityB as string,
    commodity: r.commodity as string,
    path: r.path as number[],
    volume: r.volume as number,
    active: r.active as boolean,
    created_tick: r.createdTick as number,
  })), ["planet_id", "id"]);

  const alliances = Object.values(state.alliances as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "alliances", alliances.map((a) => ({
    planet_id: planetId,
    id: a.id as string,
    members: a.members as string[],
    formed_tick: a.formedTick as number,
    active: a.active as boolean,
  })), ["planet_id", "id"]);

  const wars = Object.values(state.wars as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "wars", wars.map((w) => ({
    planet_id: planetId,
    id: w.id as string,
    attacker: w.attacker as string,
    defender: w.defender as string,
    start_tick: w.startTick as number,
    end_tick: w.active ? null : tick,
    fronts: w.fronts as number[],
    causes: (w.causes ?? []) as Array<{ factor: string; weight: number }>,
    active: w.active as boolean,
  })), ["planet_id", "id"]);

  const diseases = Object.values(state.diseases as Record<string, Record<string, unknown>>);
  await upsertInChunks(db, "diseases", diseases.map((d) => ({
    planet_id: planetId,
    id: d.id as string,
    origin_cell: (d.originCell as number | null) ?? null,
    severity: d.severity as number,
    transmission: d.transmission as number,
    civs: (d.civs ?? []) as string[],
    start_tick: d.startTick as number,
    active: d.active as boolean,
    contribution_id: (d.contributionId as string | null) ?? null,
  })), ["planet_id", "id"]);

  const migrations = (state.migrations as Array<Record<string, unknown>>) ?? [];
  if (migrations.length) {
    const existing = await db
      .selectFrom("migrations")
      .select("id")
      .where("planet_id", "=", planetId)
      .execute();
    const have = new Set(existing.map((r) => r.id));
    const fresh = migrations.filter((m) => !have.has(m.id as string));
    if (fresh.length) {
      await upsertInChunks(db, "migrations", fresh.map((m) => ({
        planet_id: planetId,
        id: m.id as string,
        civ_id: (m.civId as string | null) ?? null,
        species_id: (m.speciesId as string | null) ?? null,
        from_cell: m.fromCell as number,
        to_cell: m.toCell as number,
        size: m.size as number,
        tick: m.tick as number,
      })), ["planet_id", "id"]);
    }
  }
}

async function upsertInChunks<T extends Record<string, unknown>>(
  db: Kysely<Database>,
  table: keyof Database,
  rows: T[],
  conflictCols: string[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    if (!chunk.length) continue;
    const updateCols = Object.keys(chunk[0] as Record<string, unknown>).filter(
      (k) => !conflictCols.includes(k),
    );
    await db
      .insertInto(table as never)
      .values(chunk as never[])
      .onConflict((oc) =>
        oc.columns(conflictCols as never[]).doUpdateSet(
          Object.fromEntries(
            updateCols.map((c) => [c, sql.raw(`excluded."${c}"`)]),
          ) as never,
        ),
      )
      .execute();
  }
}
