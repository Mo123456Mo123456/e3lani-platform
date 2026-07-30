import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { SimulationEngine, type SerializedWorld } from "@kawkab/simulation";
import type { PlanetConfig, PlanetStats, WorldDelta, WorldEvent } from "@kawkab/shared-types";
import { EventBus } from "../common/event-bus.js";
import { PrismaService } from "../common/prisma.service.js";

interface ManagedWorld {
  planetId: string;
  engine: SimulationEngine;
  running: boolean;
  ticksPerSecond: number;
  timer: NodeJS.Timeout | null;
  lastTickDurationMs: number;
  eventDbIds: Map<string, string>; // engine event key -> WorldEvent row id
  dirtyRegions: Set<number>;
  queuedJobs: number;
}

const DEFAULT_TICKS_PER_SECOND = 0.2; // one simulated year every five seconds
const REGION_FLUSH_INTERVAL = 25;
const READMODEL_SYNC_INTERVAL = 50;

/**
 * Owns every live SimulationEngine. The engine is the source of truth for the
 * present; PostgreSQL is the source of truth for history (events, snapshots)
 * and materialised read models (regions, civs, species) refreshed on a cadence.
 */
@Injectable()
export class WorldManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorldManager.name);
  private readonly worlds = new Map<string, ManagedWorld>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn("DATABASE_URL missing — world manager idle (API will report 503 for world routes).");
      return;
    }
    const planets = await this.prisma.planet.findMany({ where: { status: { not: "archived" } } }).catch(() => []);
    for (const planet of planets) {
      try {
        const managed = await this.loadEngine(planet.id);
        if (planet.status === "active") this.startTicker(planet.id);
        this.logger.log(`loaded planet ${planet.name} (${planet.id}) at tick ${managed.engine.state.tick}`);
      } catch (err) {
        this.logger.error(`failed to load planet ${planet.id}: ${String(err)}`);
      }
    }
  }

  onModuleDestroy(): void {
    for (const w of this.worlds.values()) {
      if (w.timer) clearInterval(w.timer);
    }
  }

  // ------------------------------------------------------------------ engines
  get(planetId: string): SimulationEngine | null {
    return this.worlds.get(planetId)?.engine ?? null;
  }

  status(planetId: string): { running: boolean; ticksPerSecond: number; lastTickDurationMs: number; queuedJobs: number } | null {
    const w = this.worlds.get(planetId);
    if (!w) return null;
    return { running: w.running, ticksPerSecond: w.ticksPerSecond, lastTickDurationMs: w.lastTickDurationMs, queuedJobs: w.queuedJobs };
  }

  /** create a brand-new procedurally generated planet and persist everything */
  async createPlanet(input: { name: string; seed: string; description?: string; config?: Partial<PlanetConfig>; createdById?: string }): Promise<{ planetId: string }> {
    const engine = SimulationEngine.create(input.seed, input.config);
    const planet = await this.prisma.planet.create({
      data: {
        name: input.name,
        seed: input.seed,
        description: input.description ?? null,
        createdById: input.createdById ?? null,
        status: "paused",
        config: {
          seed: input.seed,
          gridWidth: engine.config.gridWidth,
          gridHeight: engine.config.gridHeight,
          seaLevel: engine.config.seaLevel,
          tickDuration: "year",
          snapshotInterval: engine.config.snapshotInterval,
        },
        tick: 0,
        simYear: 0,
        stats: engine.getStats() as unknown as object,
      },
    });
    const managed: ManagedWorld = {
      planetId: planet.id,
      engine,
      running: false,
      ticksPerSecond: DEFAULT_TICKS_PER_SECOND,
      timer: null,
      lastTickDurationMs: 0,
      eventDbIds: new Map(),
      dirtyRegions: new Set(),
      queuedJobs: 0,
    };
    this.worlds.set(planet.id, managed);
    await this.persistGenesis(managed);
    await this.persistRegions(managed, true);
    await this.syncReadModels(managed);
    await this.persistSnapshot(managed);
    return { planetId: planet.id };
  }

  /** load engine from the latest snapshot (or genesis when none exists) */
  private async loadEngine(planetId: string): Promise<ManagedWorld> {
    const existing = this.worlds.get(planetId);
    if (existing) return existing;
    const planet = await this.prisma.planet.findUniqueOrThrow({ where: { id: planetId } });
    const snapshot = await this.prisma.timelineSnapshot.findFirst({ where: { planetId }, orderBy: { tick: "desc" } });
    const engine = snapshot
      ? SimulationEngine.fromWorld(snapshot.state as SerializedWorld)
      : SimulationEngine.create(planet.seed);
    const managed: ManagedWorld = {
      planetId,
      engine,
      running: false,
      ticksPerSecond: DEFAULT_TICKS_PER_SECOND,
      timer: null,
      lastTickDurationMs: 0,
      eventDbIds: new Map(),
      dirtyRegions: new Set(),
      queuedJobs: 0,
    };
    this.worlds.set(planetId, managed);
    return managed;
  }

  // ------------------------------------------------------------------ ticking
  startTicker(planetId: string, ticksPerSecond?: number): void {
    const w = this.worlds.get(planetId);
    if (!w) return;
    if (ticksPerSecond !== undefined) w.ticksPerSecond = Math.max(0.05, Math.min(20, ticksPerSecond));
    if (w.timer) clearInterval(w.timer);
    w.running = true;
    const intervalMs = Math.max(50, 1000 / w.ticksPerSecond);
    w.timer = setInterval(() => {
      void this.tickOnce(w).catch((err) => this.logger.error(`tick failed for ${planetId}: ${String(err)}`));
    }, intervalMs);
    void this.prisma.planet.update({ where: { id: planetId }, data: { status: "active" } }).catch(() => undefined);
    this.bus.publish("simulation.status", { planetId, running: true, tick: w.engine.state.tick });
  }

  stopTicker(planetId: string): void {
    const w = this.worlds.get(planetId);
    if (!w) return;
    w.running = false;
    if (w.timer) clearInterval(w.timer);
    w.timer = null;
    void this.prisma.planet.update({ where: { id: planetId }, data: { status: "paused" } }).catch(() => undefined);
    this.bus.publish("simulation.status", { planetId, running: false, tick: w.engine.state.tick });
  }

  /** run N ticks synchronously (admin "step" & contribution fast-forward) */
  async runTicks(planetId: string, n: number): Promise<WorldDelta[]> {
    const w = await this.loadEngine(planetId);
    const deltas: WorldDelta[] = [];
    for (let i = 0; i < n; i++) {
      deltas.push(await this.tickOnce(w));
    }
    return deltas;
  }

  private async tickOnce(w: ManagedWorld): Promise<WorldDelta> {
    const started = Date.now();
    const delta = w.engine.runTick();
    w.lastTickDurationMs = Date.now() - started;
    delta.planetId = w.planetId;
    for (const r of delta.changedRegions) w.dirtyRegions.add(r.index);

    this.bus.publish("world.delta", { planetId: w.planetId, delta });
    for (const event of delta.newEvents) {
      this.bus.publish("world.event", { planetId: w.planetId, event });
    }

    w.queuedJobs++;
    try {
      await this.persistTick(w, delta);
      if (w.engine.state.tick % REGION_FLUSH_INTERVAL === 0) await this.persistRegions(w, false);
      if (w.engine.state.tick % READMODEL_SYNC_INTERVAL === 0) {
        await this.syncReadModels(w);
        await this.persistSnapshot(w);
      }
      if (w.engine.state.tick % 5 === 0) {
        await this.prisma.planet.update({
          where: { id: w.planetId },
          data: { tick: w.engine.state.tick, simYear: Math.round(w.engine.state.simYear), stats: delta.stats as unknown as object },
        });
      }
    } finally {
      w.queuedJobs--;
    }
    return delta;
  }

  // ------------------------------------------------------------------ rollback
  async rollback(planetId: string, toTick: number): Promise<boolean> {
    const w = await this.loadEngine(planetId);
    const wasRunning = w.running;
    if (wasRunning) this.stopTicker(planetId);
    const snap = await this.prisma.timelineSnapshot.findFirst({ where: { planetId, tick: { lte: toTick } }, orderBy: { tick: "desc" } });
    if (!snap) return false;
    w.engine = SimulationEngine.fromWorld(snap.state as SerializedWorld);
    w.eventDbIds.clear();
    await this.prisma.$transaction([
      this.prisma.worldEvent.deleteMany({ where: { planetId, tick: { gt: snap.tick } } }),
      this.prisma.simulationTick.deleteMany({ where: { planetId, tick: { gt: snap.tick } } }),
      this.prisma.causalLink.deleteMany({ where: { planetId, effect: { tick: { gt: snap.tick } } } }),
      this.prisma.planet.update({ where: { id: planetId }, data: { tick: snap.tick, simYear: snap.simYear } }),
    ]);
    await this.persistRegions(w, true);
    if (wasRunning) this.startTicker(planetId);
    return true;
  }

  async addContribution(planetId: string, input: { id: string; userId: string; parsed: import("@kawkab/shared-types").ParsedContribution; originIndex: number }): Promise<void> {
    const w = await this.loadEngine(planetId);
    w.engine.addContribution(input);
  }

  // ------------------------------------------------------------------ persistence
  private async persistGenesis(w: ManagedWorld): Promise<void> {
    for (const ev of w.engine.events) {
      await this.persistEvent(w, ev);
    }
  }

  private async persistTick(w: ManagedWorld, delta: WorldDelta): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    await this.prisma.simulationTick
      .create({
        data: {
          planetId: w.planetId,
          tick: delta.toTick,
          simYear: delta.simYear,
          durationMs: w.lastTickDurationMs,
          eventCount: delta.newEvents.length,
          stats: delta.stats as unknown as object,
        },
      })
      .catch(() => undefined); // duplicate tick rows are harmless on replay
    for (const ev of delta.newEvents) {
      await this.persistEvent(w, ev);
    }
  }

  private async persistEvent(w: ManagedWorld, ev: WorldEvent): Promise<void> {
    const row = await this.prisma.worldEvent
      .upsert({
        where: { planetId_key: { planetId: w.planetId, key: ev.id } },
        create: {
          planetId: w.planetId,
          key: ev.id,
          tick: ev.tick,
          simYear: ev.simYear,
          type: ev.type,
          title: ev.title,
          summary: ev.summary,
          regionIndex: ev.region?.index ?? null,
          lat: ev.region?.lat ?? null,
          lon: ev.region?.lon ?? null,
          actorIds: ev.actorIds,
          contributionId: ev.contributionId,
          confidence: ev.confidence,
          magnitude: ev.magnitude,
          data: ev.data as object,
        },
        update: {},
      })
      .catch(() => null);
    if (!row) return;
    w.eventDbIds.set(ev.id, row.id);
    for (const causeKey of ev.causeIds) {
      const causeDbId = w.eventDbIds.get(causeKey)
        ?? (await this.prisma.worldEvent.findUnique({ where: { planetId_key: { planetId: w.planetId, key: causeKey } }, select: { id: true } }))?.id;
      if (!causeDbId) continue;
      await this.prisma.causalLink
        .create({ data: { planetId: w.planetId, causeEventId: causeDbId, effectEventId: row.id } })
        .catch(() => undefined);
    }
  }

  private async persistRegions(w: ManagedWorld, full: boolean): Promise<void> {
    const engine = w.engine;
    const indexes = full ? engine.state.cells.map((c) => c.index) : [...w.dirtyRegions];
    w.dirtyRegions.clear();
    const chunk = 150;
    for (let i = 0; i < indexes.length; i += chunk) {
      const slice = indexes.slice(i, i + chunk);
      await this.prisma
        .$transaction(
          slice.map((index) => {
            const region = engine.getRegion(index)!;
            return this.prisma.planetRegion.upsert({
              where: { planetId_index: { planetId: w.planetId, index } },
              create: {
                planetId: w.planetId,
                index,
                x: region.x,
                y: region.y,
                lat: region.lat,
                lon: region.lon,
                elevation: region.elevation,
                temperature: region.temperature,
                moisture: region.moisture,
                biome: region.biome,
                fertility: region.fertility,
                pollution: region.pollution,
                river: region.river,
                isOcean: region.isOcean,
                isVolcanic: region.isVolcanic,
                hasIce: region.hasIce,
                ownerCivKey: region.ownerCivId,
                cityKey: region.cityId,
                population: region.population,
                plantCoverage: region.plantCoverage,
                updatedTick: engine.state.tick,
              },
              update: {
                temperature: region.temperature,
                moisture: region.moisture,
                biome: region.biome,
                pollution: region.pollution,
                hasIce: region.hasIce,
                ownerCivKey: region.ownerCivId,
                cityKey: region.cityId,
                population: region.population,
                plantCoverage: region.plantCoverage,
                updatedTick: engine.state.tick,
              },
            });
          }),
        )
        .catch((err) => this.logger.warn(`region flush failed: ${String(err)}`));
    }
  }

  /** refresh materialised read models (civs, species, plants, cities, routes…) */
  private async syncReadModels(w: ManagedWorld): Promise<void> {
    const s = w.engine.state;
    const planetId = w.planetId;
    const asJson = (v: unknown) => v as object;

    for (const civ of s.civs.values()) {
      await this.prisma.civilization
        .upsert({
          where: { planetId_key: { planetId, key: civ.id } },
          create: {
            planetId, key: civ.id, name: civ.name, color: civ.color, foundedTick: civ.foundedTick, extinct: civ.extinct,
            government: civ.government, techEra: civ.techEra, population: Math.round(civ.population), territorySize: civ.territory.size,
            military: civ.military, stability: civ.stability, happiness: civ.happiness, health: civ.health, education: civ.education,
            economy: civ.economy, foodSecurity: civ.foodSecurity, aggression: civ.aggression, innovation: civ.innovation,
            techKeys: [...civ.techKeys], stockpiles: asJson(civ.stockpiles), relations: asJson(civ.relations), memory: civ.memory,
          },
          update: {
            extinct: civ.extinct, government: civ.government, techEra: civ.techEra, population: Math.round(civ.population),
            territorySize: civ.territory.size, military: civ.military, stability: civ.stability, happiness: civ.happiness,
            health: civ.health, education: civ.education, economy: civ.economy, foodSecurity: civ.foodSecurity,
            techKeys: [...civ.techKeys], stockpiles: asJson(civ.stockpiles), relations: asJson(civ.relations), memory: civ.memory,
          },
        })
        .catch(() => undefined);
    }
    for (const city of s.cities.values()) {
      const civRow = await this.prisma.civilization.findUnique({ where: { planetId_key: { planetId, key: city.civId } }, select: { id: true } });
      await this.prisma.city
        .upsert({
          where: { planetId_key: { planetId, key: city.id } },
          create: {
            planetId, key: city.id, name: city.name, civKey: city.civId, civDbId: civRow?.id ?? null,
            regionIndex: city.cellIndex, lat: w.engine.grid.lat(city.cellIndex), lon: w.engine.grid.lon(city.cellIndex),
            population: Math.round(city.population), foundedTick: city.foundedTick, isCapital: city.isCapital,
            health: city.health, prosperity: city.prosperity,
          },
          update: { population: Math.round(city.population), health: city.health, prosperity: city.prosperity, civKey: city.civId, civDbId: civRow?.id ?? null },
        })
        .catch(() => undefined);
    }
    for (const sp of s.species.values()) {
      const pops = s.speciesPops.get(sp.id);
      const global = pops ? [...pops.values()].reduce((a, b) => a + b, 0) : 0;
      await this.prisma.species
        .upsert({
          where: { planetId_key: { planetId, key: sp.id } },
          create: {
            planetId, key: sp.id, name: sp.name, parentKey: sp.parentId, homeBiome: sp.homeBiome,
            traits: asJson(sp.traits), diet: sp.diet, preyKeys: sp.preyIds, originContributionId: sp.originContributionId,
            globalPopulation: Math.round(global), cellCount: pops?.size ?? 0, createdTick: sp.createdTick,
            extinct: sp.extinct, extinctTick: sp.extinctTick,
          },
          update: { globalPopulation: Math.round(global), cellCount: pops?.size ?? 0, extinct: sp.extinct, extinctTick: sp.extinctTick },
        })
        .catch(() => undefined);
    }
    for (const plant of s.plants.values()) {
      const coverage = plant.cells.size > 0 ? plant.cells.size : plant.estimatedCoverage;
      await this.prisma.plant
        .upsert({
          where: { planetId_key: { planetId, key: plant.id } },
          create: {
            planetId, key: plant.id, name: plant.name, biomes: plant.biomes, traits: asJson(plant.traits),
            originContributionId: plant.originContributionId, coverage, createdTick: plant.createdTick, extinct: plant.extinct,
          },
          update: { coverage, extinct: plant.extinct },
        })
        .catch(() => undefined);
    }
    for (const tech of s.techTree) {
      await this.prisma.technology
        .upsert({
          where: { planetId_key: { planetId, key: tech.key } },
          create: { planetId, key: tech.key, name: tech.name, era: tech.era, prereqKeys: tech.prereqKeys, effects: asJson(tech.effects) },
          update: {},
        })
        .catch(() => undefined);
    }
    for (const route of s.tradeRoutes.values()) {
      const from = s.cities.get(route.fromCityId);
      const to = s.cities.get(route.toCityId);
      await this.prisma.tradeRoute
        .upsert({
          where: { planetId_key: { planetId, key: route.id } },
          create: {
            planetId, key: route.id, fromCityKey: route.fromCityId, toCityKey: route.toCityId,
            fromCivKey: from?.civId ?? "", toCivKey: to?.civId ?? "",
            path: route.path.map((i) => ({ lat: w.engine.grid.lat(i), lon: w.engine.grid.lon(i) })),
            goods: route.goods, value: route.value, risk: route.risk, active: route.active, createdTick: route.createdTick,
          },
          update: { active: route.active, value: route.value, risk: route.risk },
        })
        .catch(() => undefined);
    }
    for (const war of s.wars.values()) {
      await this.prisma.war
        .upsert({
          where: { planetId_key: { planetId, key: war.id } },
          create: {
            planetId, key: war.id, name: war.name, attackerCivKey: war.attackerCivId, defenderCivKey: war.defenderCivId,
            status: war.status, startedTick: war.startedTick, endedTick: war.endedTick, casualties: Math.round(war.casualties),
            frontCells: [...war.frontCells].map((i) => ({ lat: w.engine.grid.lat(i), lon: w.engine.grid.lon(i) })),
            causeSummary: war.causeSummary,
          },
          update: { status: war.status, endedTick: war.endedTick, casualties: Math.round(war.casualties) },
        })
        .catch(() => undefined);
    }
    for (const alliance of s.alliances.values()) {
      await this.prisma.alliance
        .upsert({
          where: { planetId_key: { planetId, key: alliance.id } },
          create: {
            planetId, key: alliance.id, name: alliance.name, memberCivKeys: alliance.memberCivIds,
            status: alliance.status, createdTick: alliance.createdTick, brokenTick: alliance.brokenTick,
          },
          update: { status: alliance.status, brokenTick: alliance.brokenTick },
        })
        .catch(() => undefined);
    }
    for (const disease of s.diseases.values()) {
      await this.prisma.disease
        .upsert({
          where: { planetId_key: { planetId, key: disease.id } },
          create: {
            planetId, key: disease.id, name: disease.name, severity: disease.severity, contagiousness: disease.contagiousness,
            affectedCivKeys: [...disease.affectedCivIds], originContributionId: disease.originContributionId,
            startedTick: disease.startedTick, contained: disease.contained,
          },
          update: { contained: disease.contained, affectedCivKeys: [...disease.affectedCivIds] },
        })
        .catch(() => undefined);
    }
    for (const mig of s.migrations.values()) {
      await this.prisma.migration
        .upsert({
          where: { planetId_key: { planetId, key: mig.id } },
          create: {
            planetId, key: mig.id, civKey: mig.civId, speciesKey: mig.speciesId, fromIndex: mig.fromIndex, toIndex: mig.toIndex,
            path: mig.path.map((i) => ({ lat: w.engine.grid.lat(i), lon: w.engine.grid.lon(i) })),
            size: Math.round(mig.size), startedTick: mig.startedTick, completedTick: mig.completedTick,
          },
          update: { completedTick: mig.completedTick },
        })
        .catch(() => undefined);
    }
    // biome catalogue
    const biomeNames: Record<string, [string, string]> = {
      ocean: ["محيط", "Ocean"], coast: ["ساحل", "Coast"], plains: ["سهول", "Plains"],
      rainforest: ["غابات مطيرة", "Rainforest"], temperate_forest: ["غابات معتدلة", "Temperate forest"],
      desert: ["صحراء", "Desert"], mountains: ["جبال", "Mountains"], tundra: ["تندرا", "Tundra"],
      swamp: ["مستنقعات", "Swamp"], steppe: ["سهوب", "Steppe"], volcanic: ["بركانية", "Volcanic"], ice: ["جليدية", "Ice"],
    };
    const counts = new Map<string, number>();
    for (const c of s.cells) counts.set(c.biome, (counts.get(c.biome) ?? 0) + 1);
    const colors = (await import("@kawkab/simulation")).BIOME_COLORS;
    for (const [biome, count] of counts) {
      const [nameAr, nameEn] = biomeNames[biome] ?? [biome, biome];
      await this.prisma.biome
        .upsert({
          where: { planetId_key: { planetId, key: biome } },
          create: { planetId, key: biome, nameAr, nameEn, color: colors[biome as keyof typeof colors] ?? "#999", cellCount: count },
          update: { cellCount: count },
        })
        .catch(() => undefined);
    }
  }

  private async persistSnapshot(w: ManagedWorld): Promise<void> {
    const snap = w.engine.snapshotNow();
    await this.prisma.timelineSnapshot
      .upsert({
        where: { planetId_tick: { planetId: w.planetId, tick: snap.tick } },
        create: { planetId: w.planetId, tick: snap.tick, simYear: Math.round(snap.simYear), hash: snap.hash, state: snap.data as object },
        update: { hash: snap.hash, state: snap.data as object },
      })
      .catch((err) => this.logger.warn(`snapshot persist failed: ${String(err)}`));
  }

  statsOf(planetId: string): PlanetStats | null {
    return this.worlds.get(planetId)?.engine.getStats() ?? null;
  }
}
