import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { sql, type Kysely, type SqlBool } from "kysely";
import type {
  AllianceDto,
  CityDto,
  CivilizationDetail,
  CivilizationDto,
  Paginated,
  PlanetSummary,
  PlantDto,
  RegionInfo,
  SnapshotCompare,
  SnapshotDto,
  SpeciesDto,
  TechnologyDto,
  TradeRouteDto,
  WarDto,
  WorldEvent,
} from "@planet/shared-types";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import { SimulationService } from "../simulation/simulation.service";

@Injectable()
export class PlanetsService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly simulation: SimulationService,
  ) {}

  async currentSummary(): Promise<PlanetSummary> {
    const planet = await this.simulation.getCurrentPlanet();
    return this.toSummary(planet);
  }

  async summary(id: string): Promise<PlanetSummary> {
    return this.toSummary(await this.simulation.getPlanet(id));
  }

  private async toSummary(planet: {
    id: string; name: string; seed: number; tick: number; years_per_tick: number;
    status: string; state_hash: string | null; created_at: Date;
  }): Promise<PlanetSummary> {
    const [civs, cities, species, plants, techs, wars, events] = await Promise.all([
      this.count("civilizations", planet.id, { column: "extinct", value: false }),
      this.count("cities", planet.id),
      this.count("species", planet.id, { column: "extinct", value: false }),
      this.count("plants", planet.id, { column: "extinct", value: false }),
      this.count("technologies", planet.id),
      this.count("wars", planet.id, { column: "active", value: true }),
      this.count("world_events", planet.id),
    ]);
    const state = await this.db
      .selectFrom("planets")
      .select((eb) => eb.ref("current_state").as("s"))
      .where("id", "=", planet.id)
      .executeTakeFirstOrThrow();
    const tempShift = ((state as { s: { meta?: { globalTempShift?: number } } }).s?.meta?.globalTempShift) ?? 0;
    return {
      id: planet.id,
      name: planet.name,
      seed: planet.seed,
      tick: planet.tick,
      yearsPerTick: planet.years_per_tick,
      status: planet.status as PlanetSummary["status"],
      civilizations: civs,
      cities,
      species,
      plants,
      technologies: techs,
      activeWars: wars,
      eventCount: events,
      globalTempShift: tempShift,
      stateHash: planet.state_hash,
      createdAt: planet.created_at.toISOString(),
    };
  }

  private async count(
    table: "civilizations" | "cities" | "species" | "plants" | "technologies" | "wars" | "world_events",
    planetId: string,
    extra?: { column: string; value: unknown },
  ): Promise<number> {
    let q = this.db.selectFrom(table).where("planet_id", "=", planetId);
    if (extra) q = q.where(extra.column as never, "=", extra.value as never) as never;
    const row = await q.select((eb) => eb.fn.countAll<number>().as("c")).executeTakeFirstOrThrow();
    return Number(row.c);
  }

  async regionsList(planetId: string, biome: string | undefined, limit: number): Promise<RegionInfo[]> {
    let q = this.db
      .selectFrom("planet_regions")
      .selectAll()
      .where("planet_id", "=", planetId);
    if (biome) q = q.where("biome", "=", biome);
    const rows = await q
      .orderBy("fertility", "desc")
      .limit(Math.min(limit, 200))
      .execute();
    const civIds = [...new Set(rows.map((r) => r.owner_civ_id).filter(Boolean))] as string[];
    const civNames = new Map(
      civIds.length
        ? (
            await this.db
              .selectFrom("civilizations")
              .select(["id", "name"])
              .where("planet_id", "=", planetId)
              .where("id", "in", civIds)
              .execute()
          ).map((c) => [c.id, c.name])
        : [],
    );
    const planet = await this.simulation.getPlanet(planetId);
    const cells = (planet.current_state as { cells: Array<Record<string, unknown>> }).cells;
    return rows.map((row) => ({
      cellId: row.cell_id,
      lat: row.lat,
      lon: row.lon,
      biome: row.biome as RegionInfo["biome"],
      temp: (cells[row.cell_id]?.temp as number) ?? 0,
      moisture: (cells[row.cell_id]?.moisture as number) ?? 0,
      fertility: row.fertility,
      pollution: row.pollution,
      vegetation: row.vegetation,
      freshwater: row.freshwater,
      ownerCivId: row.owner_civ_id,
      ownerCivName: row.owner_civ_id ? civNames.get(row.owner_civ_id) ?? null : null,
      cityId: row.city_id,
      cityName: null,
      deposits: row.deposits as Record<string, number>,
      presentPlants: row.present_plants,
      presentSpecies: row.present_species,
    }));
  }

  async resourcesList(planetId: string) {
    const resources = await this.db
      .selectFrom("resources")
      .selectAll()
      .where("planet_id", "=", planetId)
      .execute();
    const deposits = await sql<{ id: string; total: string; count: string }>`
      SELECT key AS id, COALESCE(SUM((value)::numeric), 0)::text AS total, COUNT(*)::text AS count
      FROM planet_regions, jsonb_each_text(deposits)
      WHERE planet_id = ${planetId}
      GROUP BY key
    `.execute(this.db);
    const byId = new Map(deposits.rows.map((r) => [r.id, r]));
    return resources.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      baseValue: r.base_value,
      regen: r.regen,
      envImpact: r.env_impact,
      totalQuantity: Number(byId.get(r.id)?.total ?? 0),
      deposits: Number(byId.get(r.id)?.count ?? 0),
      contributionId: r.contribution_id,
    }));
  }

  async region(planetId: string, cellId: number): Promise<RegionInfo> {
    const row = await this.db
      .selectFrom("planet_regions")
      .selectAll()
      .where("planet_id", "=", planetId)
      .where("cell_id", "=", cellId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException({ error: "region_not_found" });
    let civName: string | null = null;
    let cityName: string | null = null;
    if (row.owner_civ_id) {
      civName =
        (await this.db
          .selectFrom("civilizations")
          .select("name")
          .where("planet_id", "=", planetId)
          .where("id", "=", row.owner_civ_id)
          .executeTakeFirst())?.name ?? null;
    }
    if (row.city_id) {
      cityName =
        (await this.db
          .selectFrom("cities")
          .select("name")
          .where("planet_id", "=", planetId)
          .where("id", "=", row.city_id)
          .executeTakeFirst())?.name ?? null;
    }
    const planet = await this.simulation.getPlanet(planetId);
    const cell = (planet.current_state as { cells: Array<Record<string, unknown>> }).cells[cellId];
    return {
      cellId: row.cell_id,
      lat: row.lat,
      lon: row.lon,
      biome: row.biome as RegionInfo["biome"],
      temp: (cell?.temp as number) ?? 0,
      moisture: (cell?.moisture as number) ?? 0,
      fertility: row.fertility,
      pollution: row.pollution,
      vegetation: row.vegetation,
      freshwater: row.freshwater,
      ownerCivId: row.owner_civ_id,
      ownerCivName: civName,
      cityId: row.city_id,
      cityName,
      deposits: row.deposits as Record<string, number>,
      presentPlants: row.present_plants,
      presentSpecies: row.present_species,
    };
  }

  async overlays(planetId: string) {
    const [cities, tradeRoutes, wars, migrations] = await Promise.all([
      this.citiesOf(planetId),
      this.tradeRoutes(planetId),
      this.wars(planetId),
      this.db
        .selectFrom("migrations")
        .select(["from_cell", "to_cell", "size", "tick"])
        .where("planet_id", "=", planetId)
        .orderBy("tick", "desc")
        .limit(60)
        .execute(),
    ]);
    return {
      cities,
      tradeRoutes,
      wars,
      migrations: migrations.map((m) => ({
        fromCell: m.from_cell,
        toCell: m.to_cell,
        size: m.size,
        tick: m.tick,
      })),
    };
  }

  async civilizations(planetId: string): Promise<CivilizationDto[]> {
    const rows = await this.db
      .selectFrom("civilizations")
      .selectAll()
      .where("planet_id", "=", planetId)
      .orderBy("population", "desc")
      .execute();
    const cityCounts = await this.db
      .selectFrom("cities")
      .select(["civ_id"])
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .where("planet_id", "=", planetId)
      .groupBy("civ_id")
      .execute();
    const territory = await this.db
      .selectFrom("planet_regions")
      .select(["owner_civ_id"])
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .where("planet_id", "=", planetId)
      .where("owner_civ_id", "is not", null)
      .groupBy("owner_civ_id")
      .execute();
    const cityCountBy = new Map(cityCounts.map((r) => [r.civ_id, Number(r.c)]));
    const territoryBy = new Map(territory.map((r) => [r.owner_civ_id, Number(r.c)]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      culture: r.culture,
      language: r.language,
      government: r.government,
      population: Math.round(r.population),
      techLevel: r.tech_level,
      military: Math.round(r.military),
      treasury: Math.round(r.treasury),
      happiness: r.happiness,
      health: r.health,
      stability: r.stability,
      education: r.education,
      cities: cityCountBy.get(r.id) ?? 0,
      territoryCells: territoryBy.get(r.id) ?? 0,
      extinct: r.extinct,
      contributionId: r.contribution_id,
    }));
  }

  async civilizationDetail(planetId: string, civId: string): Promise<CivilizationDetail> {
    const all = await this.civilizations(planetId);
    const base = all.find((c) => c.id === civId);
    if (!base) throw new NotFoundException({ error: "civilization_not_found" });
    const row = await this.db
      .selectFrom("civilizations")
      .selectAll()
      .where("planet_id", "=", planetId)
      .where("id", "=", civId)
      .executeTakeFirstOrThrow();
    const rels = row.relationships as Record<string, { trust: number; atWar: boolean; allied: boolean; trade: boolean }>;
    const names = new Map(all.map((c) => [c.id, c.name]));
    return {
      ...base,
      cityList: (await this.citiesOf(planetId)).filter((c) => c.civId === civId),
      relationships: Object.entries(rels).map(([id, rel]) => ({
        civId: id,
        civName: names.get(id) ?? id,
        trust: rel.trust,
        atWar: rel.atWar,
        allied: rel.allied,
        trade: rel.trade,
      })),
      memory: row.memory as string[],
    };
  }

  async citiesOf(planetId: string): Promise<CityDto[]> {
    const rows = await this.db
      .selectFrom("cities")
      .innerJoin("civilizations", (j) =>
        j.onRef("civilizations.id", "=", "cities.civ_id").onRef("civilizations.planet_id", "=", "cities.planet_id"),
      )
      .select([
        "cities.id", "cities.civ_id", "cities.cell_id", "cities.name",
        "cities.population", "cities.founded_tick", "civilizations.name as civ_name",
      ])
      .where("cities.planet_id", "=", planetId)
      .execute();
    const planet = await this.simulation.getPlanet(planetId);
    const cells = (planet.current_state as { cells: Array<{ lat: number; lon: number }> }).cells;
    return rows.map((r) => ({
      id: r.id,
      civId: r.civ_id,
      civName: r.civ_name,
      cellId: r.cell_id,
      lat: cells[r.cell_id]?.lat ?? 0,
      lon: cells[r.cell_id]?.lon ?? 0,
      name: r.name,
      population: r.population,
      foundedTick: r.founded_tick,
    }));
  }

  async species(planetId: string, page: number, pageSize: number): Promise<Paginated<SpeciesDto>> {
    const total = await this.count("species", planetId);
    const rows = await this.db
      .selectFrom("species")
      .selectAll()
      .where("planet_id", "=", planetId)
      .orderBy("extinct", "asc")
      .orderBy("total_population", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        diet: r.diet,
        size: (r.traits as { size?: number }).size ?? 0,
        totalPopulation: Math.round(r.total_population),
        cellCount: r.cell_count,
        extinct: r.extinct,
        parentId: r.parent_id,
        contributionId: r.contribution_id,
      })),
      total,
      page,
      pageSize,
    };
  }

  async plants(planetId: string, page: number, pageSize: number): Promise<Paginated<PlantDto>> {
    const total = await this.count("plants", planetId);
    const rows = await this.db
      .selectFrom("plants")
      .selectAll()
      .where("planet_id", "=", planetId)
      .orderBy("extinct", "asc")
      .orderBy("cell_count", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        homeBiome: r.home_biome,
        cellCount: r.cell_count,
        extinct: r.extinct,
        contributionId: r.contribution_id,
        traits: r.traits as Record<string, number>,
      })),
      total,
      page,
      pageSize,
    };
  }

  async technologies(planetId: string): Promise<TechnologyDto[]> {
    const rows = await this.db
      .selectFrom("technologies")
      .leftJoin("civilizations", (j) =>
        j.onRef("civilizations.id", "=", "technologies.discovered_by").onRef("civilizations.planet_id", "=", "technologies.planet_id"),
      )
      .select([
        "technologies.id", "technologies.name", "technologies.tier",
        "technologies.discovered_by", "technologies.discovered_tick",
        "technologies.contribution_id", "civilizations.name as civ_name",
      ])
      .where("technologies.planet_id", "=", planetId)
      .orderBy("technologies.discovered_tick", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier,
      discoveredBy: r.discovered_by,
      discoveredByName: r.civ_name ?? null,
      tick: r.discovered_tick,
      contributionId: r.contribution_id,
    }));
  }

  async alliances(planetId: string): Promise<AllianceDto[]> {
    const rows = await this.db.selectFrom("alliances").selectAll().where("planet_id", "=", planetId).execute();
    const civNames = new Map((await this.civilizations(planetId)).map((c) => [c.id, c.name]));
    return rows.map((r) => ({
      id: r.id,
      members: r.members as string[],
      memberNames: (r.members as string[]).map((m) => civNames.get(m) ?? m),
      formedTick: r.formed_tick,
      active: r.active,
    }));
  }

  async wars(planetId: string): Promise<WarDto[]> {
    const rows = await this.db.selectFrom("wars").selectAll().where("planet_id", "=", planetId).execute();
    const civNames = new Map((await this.civilizations(planetId)).map((c) => [c.id, c.name]));
    return rows.map((r) => ({
      id: r.id,
      attacker: r.attacker,
      attackerName: civNames.get(r.attacker) ?? r.attacker,
      defender: r.defender,
      defenderName: civNames.get(r.defender) ?? r.defender,
      startTick: r.start_tick,
      active: r.active,
      causes: r.causes as Array<{ factor: string; weight: number }>,
      fronts: r.fronts as number[],
    }));
  }

  async tradeRoutes(planetId: string): Promise<TradeRouteDto[]> {
    const rows = await this.db.selectFrom("trade_routes").selectAll().where("planet_id", "=", planetId).execute();
    const civNames = new Map((await this.civilizations(planetId)).map((c) => [c.id, c.name]));
    return rows.map((r) => ({
      id: r.id,
      civA: r.civ_a,
      civB: r.civ_b,
      civAName: civNames.get(r.civ_a) ?? r.civ_a,
      civBName: civNames.get(r.civ_b) ?? r.civ_b,
      commodity: r.commodity,
      path: r.path as number[],
      volume: r.volume,
      active: r.active,
    }));
  }

  async timeline(planetId: string) {
    const planet = await this.simulation.getPlanet(planetId);
    const bucketSize = Math.max(10, Math.ceil(Math.max(planet.tick, 1) / 24));
    const rows = await sql<{ from_tick: number; to_tick: number; count: string; types: string }>`
      SELECT (tick / ${bucketSize}) * ${bucketSize} AS from_tick,
             (tick / ${bucketSize}) * ${bucketSize} + ${bucketSize} - 1 AS to_tick,
             COUNT(*)::text AS count,
             jsonb_object_agg(type, cnt)::text AS types
      FROM (
        SELECT tick, type, COUNT(*) AS cnt
        FROM world_events
        WHERE planet_id = ${planetId}
        GROUP BY tick, type
      ) sub
      GROUP BY 1
      ORDER BY 1
    `.execute(this.db);
    return {
      bucketSize,
      eras: rows.rows.map((r) => ({
        fromTick: Number(r.from_tick),
        toTick: Number(r.to_tick),
        eventCount: Number(r.count),
        topEvents: Object.entries(JSON.parse(r.types) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
      })),
    };
  }

  async snapshots(planetId: string): Promise<SnapshotDto[]> {
    const rows = await this.db
      .selectFrom("timeline_snapshots")
      .select(["id", "tick", "state_hash", "summary", "created_at"])
      .where("planet_id", "=", planetId)
      .orderBy("tick", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      tick: r.tick,
      stateHash: r.state_hash,
      createdAt: r.created_at.toISOString(),
      summary: r.summary as SnapshotDto["summary"],
    }));
  }

  async compareSnapshots(planetId: string, fromTick: number, toTick: number): Promise<SnapshotCompare> {
    const snaps = await this.db
      .selectFrom("timeline_snapshots")
      .select(["tick", "summary"])
      .where("planet_id", "=", planetId)
      .where("tick", "in", [fromTick, toTick])
      .execute();
    const from = snaps.find((s) => s.tick === fromTick)?.summary as Record<string, number> | undefined;
    const to = snaps.find((s) => s.tick === toTick)?.summary as Record<string, number> | undefined;
    if (!from || !to) {
      throw new NotFoundException({ error: "snapshot_not_found", fromTick, toTick });
    }
    const deltas: Record<string, number> = {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      deltas[key] = (to[key] ?? 0) - (from[key] ?? 0);
    }
    const notable = await this.db
      .selectFrom("world_events")
      .where("planet_id", "=", planetId)
      .where("tick", ">", fromTick)
      .where("tick", "<=", toTick)
      .where("importance", ">=", 3)
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .executeTakeFirstOrThrow();
    return { fromTick, toTick, deltas, notableEvents: Number(notable.c) };
  }

  async events(
    planetId: string,
    query: {
      page: number; pageSize: number; types?: string; minImportance?: number;
      civId?: string; contributionId?: string; fromTick?: number; toTick?: number;
    },
  ): Promise<Paginated<WorldEvent>> {
    let q = this.db.selectFrom("world_events").where("planet_id", "=", planetId);
    if (query.types) {
      const types = query.types.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length) q = q.where("type", "in", types);
    }
    if (query.minImportance) q = q.where("importance", ">=", query.minImportance);
    if (query.contributionId) q = q.where("contribution_id", "=", query.contributionId);
    if (query.fromTick !== undefined) q = q.where("tick", ">=", query.fromTick);
    if (query.toTick !== undefined) q = q.where("tick", "<=", query.toTick);
    if (query.civId) {
      q = q.where(sql<SqlBool>`civ_ids @> ${JSON.stringify([query.civId])}::jsonb`);
    }
    const total = await q.select((eb) => eb.fn.countAll<number>().as("c")).executeTakeFirstOrThrow();
    const rows = await q
      .selectAll()
      .orderBy("tick", "desc")
      .orderBy("id", "desc")
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .execute();
    return {
      items: rows.map(mapEventRow),
      total: Number(total.c),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async eventChain(planetId: string, eventId: string) {
    const event = await this.db
      .selectFrom("world_events")
      .selectAll()
      .where("planet_id", "=", planetId)
      .where("id", "=", eventId)
      .executeTakeFirst();
    if (!event) throw new NotFoundException({ error: "event_not_found" });
    const ancestors = await sql<{ id: string }>`
      WITH RECURSIVE up AS (
        SELECT event_id, cause_event_id, 1 AS depth
        FROM causal_links WHERE planet_id = ${planetId} AND event_id = ${eventId}
        UNION ALL
        SELECT c.event_id, c.cause_event_id, up.depth + 1
        FROM causal_links c JOIN up ON c.event_id = up.cause_event_id
        WHERE up.depth < 40
      )
      SELECT cause_event_id AS id FROM up WHERE cause_event_id IS NOT NULL
    `.execute(this.db);
    const descendants = await sql<{ id: string }>`
      WITH RECURSIVE down AS (
        SELECT event_id, cause_event_id, 1 AS depth
        FROM causal_links WHERE planet_id = ${planetId} AND cause_event_id = ${eventId}
        UNION ALL
        SELECT c.event_id, c.cause_event_id, down.depth + 1
        FROM causal_links c JOIN down ON c.cause_event_id = down.event_id
        WHERE down.depth < 40
      )
      SELECT event_id AS id FROM down
      LIMIT 200
    `.execute(this.db);
    const ids = [...ancestors.rows.map((r) => r.id), ...descendants.rows.map((r) => r.id)];
    const rows = ids.length
      ? await this.db.selectFrom("world_events").selectAll().where("planet_id", "=", planetId).where("id", "in", ids).orderBy("tick", "asc").execute()
      : [];
    const byId = new Map(rows.map((r) => [r.id, mapEventRow(r)]));
    const rootId = ancestors.rows[ancestors.rows.length - 1]?.id;
    return {
      root: rootId ? byId.get(rootId) ?? null : null,
      event: mapEventRow(event),
      ancestors: ancestors.rows.map((r) => byId.get(r.id)).filter(Boolean),
      descendants: descendants.rows.map((r) => byId.get(r.id)).filter(Boolean),
    };
  }
}

function mapEventRow(r: {
  id: string; tick: number; type: string; importance: number; cell_id: number | null;
  civ_ids: unknown; species_ids: unknown; plant_ids: unknown; cause_event_id: string | null;
  contribution_id: string | null; confidence: number; payload: unknown;
}): WorldEvent {
  return {
    id: r.id,
    tick: r.tick,
    type: r.type as WorldEvent["type"],
    importance: r.importance as WorldEvent["importance"],
    cellId: r.cell_id,
    civIds: (r.civ_ids as string[]) ?? [],
    speciesIds: (r.species_ids as string[]) ?? [],
    plantIds: (r.plant_ids as string[]) ?? [],
    causeEventId: r.cause_event_id,
    contributionId: r.contribution_id,
    confidence: r.confidence,
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}
