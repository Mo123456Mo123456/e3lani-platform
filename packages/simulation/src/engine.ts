import type {
  BiomeType,
  LayerId,
  LayerPayload,
  ParsedContribution,
  PlanetStats,
  RegionData,
  TimelineEntry,
  WorldDelta,
  WorldEvent,
  WorldEventType,
} from "@kawkab/shared-types";
import { SIMULATION_DEFAULTS } from "@kawkab/config";
import { CausalGraph } from "./causality.js";
import type { EmitFn, EmitOptions, SystemContext } from "./context.js";
import { generateWorld } from "./generator.js";
import { PlanetGrid } from "./grid.js";
import { RngStream, deterministicId } from "./rng.js";
import { deserializeWorld, hashWorld, serializeWorld, type SerializedWorld } from "./snapshot.js";
import { tickClimate } from "./systems/climate.js";
import { tickAlliances, tickMigrations, tickWars } from "./systems/conflict.js";
import { applyContribution } from "./systems/contributions.js";
import { tickCivilizations } from "./systems/civilization.js";
import { tickEcology } from "./systems/ecology.js";
import { tickEconomy } from "./systems/economy.js";
import type { EngineConfig, PendingContribution, WorldState } from "./types.js";

export interface EngineSnapshot {
  tick: number;
  simYear: number;
  hash: string;
  data: SerializedWorld;
  /** emission counter at snapshot time — restored on rollback so ids stay reproducible */
  seq: number;
}

const GLOBAL_CAUSE_TYPES: ReadonlySet<WorldEventType> = new Set([
  "POLLUTION_SPIKE",
  "VOLCANO_ERUPTED",
  "ELEMENT_ADDED",
  "CLIMATE_CHANGED",
  "WAR_STARTED",
  "DISEASE_OUTBREAK",
]);

export const BIOME_COLORS: Record<BiomeType, string> = {
  ocean: "#0b3d66",
  coast: "#2a6f8f",
  plains: "#6d8f3f",
  rainforest: "#14532d",
  temperate_forest: "#2d6a4f",
  desert: "#d4b26a",
  mountains: "#8b8d91",
  tundra: "#b8c4c9",
  swamp: "#4a5d3a",
  steppe: "#a3a380",
  volcanic: "#7c2d12",
  ice: "#e8f1f5",
};

export class SimulationEngine {
  readonly grid: PlanetGrid;
  readonly config: EngineConfig;
  state: WorldState;
  readonly events: WorldEvent[] = [];
  readonly causality = new CausalGraph();
  readonly snapshots: EngineSnapshot[] = [];
  /** salt mixed into rng forks — scenario runs use it to diverge */
  salt = "";

  private seq = 0;
  private readonly eventById = new Map<string, WorldEvent>();
  private readonly lastEventByCell = new Map<number, string>();
  private readonly globalCauseRing: string[] = [];
  private readonly contributionRoots = new Map<string, string>();
  private prevAnomaly = 0;
  private genesisIds = { formed: "", oceans: "", life: "", plants: "" };
  private dirty = new Set<number>();

  private constructor(state: WorldState, config: EngineConfig) {
    this.state = state;
    this.config = config;
    this.grid = new PlanetGrid(config.gridWidth, config.gridHeight);
    this.genesisIds = {
      formed: deterministicId("ev", state.seed, -10000, "PLANET_FORMED"),
      oceans: deterministicId("ev", state.seed, -8200, "OCEANS_FORMED"),
      life: deterministicId("ev", state.seed, -6300, "LIFE_EMERGED"),
      plants: deterministicId("ev", state.seed, -4600, "PLANTS_SPREAD"),
    };
  }

  static create(seed: string, config?: Partial<EngineConfig>): SimulationEngine {
    const cfg: EngineConfig = {
      gridWidth: config?.gridWidth ?? SIMULATION_DEFAULTS.gridWidth,
      gridHeight: config?.gridHeight ?? SIMULATION_DEFAULTS.gridHeight,
      seaLevel: config?.seaLevel ?? SIMULATION_DEFAULTS.seaLevel,
      snapshotInterval: config?.snapshotInterval ?? SIMULATION_DEFAULTS.snapshotInterval,
      yearsPerTick: config?.yearsPerTick ?? 1,
    };
    const { state, genesisEvents } = generateWorld(seed, cfg);
    const engine = new SimulationEngine(state, cfg);
    for (const ev of genesisEvents) engine.registerEvent(ev);
    engine.genesisIds = {
      formed: genesisEvents[0]!.id,
      oceans: genesisEvents[1]!.id,
      life: genesisEvents[2]!.id,
      plants: genesisEvents[3]!.id,
    };
    engine.snapshotNow();
    return engine;
  }

  /** clone from a serialized world (scenario forks, worker bootstrap) */
  static fromWorld(data: SerializedWorld, config?: Partial<EngineConfig>): SimulationEngine {
    const state = deserializeWorld(data);
    return new SimulationEngine(state, {
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      seaLevel: 0,
      snapshotInterval: config?.snapshotInterval ?? SIMULATION_DEFAULTS.snapshotInterval,
      yearsPerTick: config?.yearsPerTick ?? 1,
    });
  }

  // ------------------------------------------------------------------ events
  private registerEvent(event: WorldEvent): void {
    this.events.push(event);
    this.eventById.set(event.id, event);
    this.causality.addEvent(event);
    if (event.region && typeof event.region.index === "number") {
      this.lastEventByCell.set(event.region.index, event.id);
    }
    if (GLOBAL_CAUSE_TYPES.has(event.type)) {
      this.globalCauseRing.push(event.id);
      if (this.globalCauseRing.length > 6) this.globalCauseRing.shift();
    }
    if (event.type === "ELEMENT_ADDED" && event.contributionId) {
      this.contributionRoots.set(event.contributionId, event.id);
    }
  }

  private makeEmit(tickRngLabel: string): EmitFn {
    return (type, opts: EmitOptions) => {
      // inherit contribution lineage from causes
      let contributionId = opts.contributionId ?? null;
      if (!contributionId) {
        for (const causeId of opts.causeIds) {
          const cause = this.eventById.get(causeId);
          if (cause?.contributionId) {
            contributionId = cause.contributionId;
            break;
          }
        }
      }
      const region = opts.region !== null && opts.region !== undefined
        ? { lat: this.grid.lat(opts.region), lon: this.grid.lon(opts.region), index: opts.region }
        : null;
      const event: WorldEvent = {
        id: deterministicId("ev", this.state.seed, this.state.tick, type, tickRngLabel, this.seq++),
        tick: this.state.tick,
        simYear: Math.round(this.state.simYear),
        type,
        title: opts.title,
        summary: opts.summary,
        region,
        actorIds: opts.actorIds ?? [],
        causeIds: opts.causeIds,
        contributionId,
        confidence: opts.confidence ?? 0.9,
        magnitude: opts.magnitude ?? 0.3,
        data: opts.data ?? {},
      };
      this.registerEvent(event);
      return event;
    };
  }

  private makeContext(phase: string): SystemContext {
    return {
      grid: this.grid,
      state: this.state,
      rng: new RngStream(this.state.seed, `tick:${this.state.tick}:${phase}${this.salt}`),
      yearsPerTick: this.config.yearsPerTick,
      emit: this.makeEmit(phase),
      touch: (index) => this.dirty.add(index),
      lastEventByCell: this.lastEventByCell,
      genesisIds: this.genesisIds,
      recentGlobalCauses: () => [...this.globalCauseRing],
    };
  }

  // ------------------------------------------------------------------- ticks
  runTick(): WorldDelta {
    const fromTick = this.state.tick;
    this.state.tick += 1;
    this.state.simYear += this.config.yearsPerTick;
    this.dirty = new Set<number>();
    const eventsBefore = this.events.length;

    // pending contributions land at their tick
    const due = this.state.pendingContributions.filter((p) => p.applyTick <= this.state.tick);
    this.state.pendingContributions = this.state.pendingContributions.filter((p) => p.applyTick > this.state.tick);
    for (const pending of due) {
      applyContribution(this.makeContext(`contrib:${pending.id}`), pending);
    }

    this.prevAnomaly = tickClimate(this.makeContext("climate"), this.prevAnomaly);
    tickEcology(this.makeContext("ecology"));
    tickCivilizations(this.makeContext("civ"));
    tickWars(this.makeContext("war"));
    tickAlliances(this.makeContext("ally"));
    tickMigrations(this.makeContext("move"));
    tickEconomy(this.makeContext("eco"));

    if (this.state.tick % this.config.snapshotInterval === 0) this.snapshotNow();

    const newEvents = this.events.slice(eventsBefore);
    const changedRegions = this.sampleDirty(600).map((index) => this.regionDelta(index));
    return {
      planetId: "",
      fromTick,
      toTick: this.state.tick,
      simYear: Math.round(this.state.simYear),
      changedRegions,
      newEvents,
      stats: this.getStats(),
    };
  }

  runTicks(n: number, onTick?: (delta: WorldDelta) => void): WorldDelta[] {
    const out: WorldDelta[] = [];
    for (let i = 0; i < n; i++) {
      const d = this.runTick();
      out.push(d);
      onTick?.(d);
    }
    return out;
  }

  private sampleDirty(cap: number): number[] {
    const all = [...this.dirty];
    if (all.length <= cap) return all;
    const step = all.length / cap;
    const out: number[] = [];
    for (let i = 0; i < cap; i++) out.push(all[Math.floor(i * step)]!);
    return out;
  }

  // ------------------------------------------------------------ contributions
  addContribution(input: { id: string; userId: string; parsed: ParsedContribution; originIndex: number; delayTicks?: number }): void {
    const pending: PendingContribution = {
      id: input.id,
      userId: input.userId,
      category: input.parsed.category,
      parsed: input.parsed,
      originIndex: Math.max(0, Math.min(this.state.cells.length - 1, input.originIndex)),
      applyTick: this.state.tick + (input.delayTicks ?? 0),
    };
    this.state.pendingContributions.push(pending);
    if ((input.delayTicks ?? 0) === 0) {
      // apply immediately so the user sees the world react now
      this.state.pendingContributions = this.state.pendingContributions.filter((p) => p.id !== pending.id);
      applyContribution(this.makeContext(`contrib:${pending.id}`), pending);
    }
  }

  getContributionRoot(contributionId: string): string | null {
    return this.contributionRoots.get(contributionId) ?? null;
  }

  getContributionTrace(contributionId: string) {
    const root = this.contributionRoots.get(contributionId);
    if (!root) return null;
    return this.causality.chain(root, 5, 400);
  }

  // ---------------------------------------------------------------- snapshots
  snapshotNow(): EngineSnapshot {
    const snap: EngineSnapshot = {
      tick: this.state.tick,
      simYear: this.state.simYear,
      hash: hashWorld(this.state),
      data: serializeWorld(this.state),
      seq: this.seq,
    };
    this.snapshots.push(snap);
    if (this.snapshots.length > 400) this.snapshots.splice(1, 1); // keep genesis
    return snap;
  }

  rollback(toTick: number): boolean {
    const snap = [...this.snapshots].reverse().find((s) => s.tick <= toTick);
    if (!snap) return false;
    this.state = deserializeWorld(snap.data);
    // drop events after the restored tick and rebuild indexes
    const cutoff = this.state.tick;
    let i = this.events.length;
    while (i > 0 && this.events[i - 1]!.tick > cutoff) i--;
    this.events.length = i;
    this.eventById.clear();
    this.lastEventByCell.clear();
    this.contributionRoots.clear();
    this.globalCauseRing.length = 0;
    const keep = new Set<string>();
    for (const ev of this.events) {
      keep.add(ev.id);
      this.eventById.set(ev.id, ev);
      if (ev.region && typeof ev.region.index === "number") this.lastEventByCell.set(ev.region.index, ev.id);
      if (GLOBAL_CAUSE_TYPES.has(ev.type)) this.globalCauseRing.push(ev.id);
      if (ev.type === "ELEMENT_ADDED" && ev.contributionId) this.contributionRoots.set(ev.contributionId, ev.id);
    }
    this.causality.prune(keep);
    this.prevAnomaly = this.state.globalTempAnomaly;
    // restore the exact emission counter so post-rollback event ids match a fresh run
    this.seq = snap.seq;
    while (this.globalCauseRing.length > 6) this.globalCauseRing.shift();
    return true;
  }

  hashState(): string {
    return hashWorld(this.state);
  }

  serialize(): SerializedWorld {
    return serializeWorld(this.state);
  }

  // ------------------------------------------------------------------- views
  getStats(): PlanetStats {
    const civs = [...this.state.civs.values()].filter((c) => !c.extinct);
    let pop = 0;
    let tempSum = 0;
    let pollSum = 0;
    for (const c of this.state.cells) {
      pop += c.population;
      tempSum += c.temperature;
      pollSum += c.pollution;
    }
    const n = this.state.cells.length;
    return {
      tick: this.state.tick,
      simYear: Math.round(this.state.simYear),
      civilizations: civs.length,
      cities: this.state.cities.size,
      species: [...this.state.species.values()].filter((s) => !s.extinct).length,
      plants: [...this.state.plants.values()].filter((p) => !p.extinct).length,
      totalPopulation: Math.round(pop),
      meanTemperature: tempSum / n,
      meanPollution: pollSum / n,
      activeWars: [...this.state.wars.values()].filter((w) => w.status === "active").length,
      activeDiseases: [...this.state.diseases.values()].filter((d) => !d.contained).length,
      tradeRoutes: [...this.state.tradeRoutes.values()].filter((r) => r.active).length,
    };
  }

  getRegion(index: number): RegionData | null {
    const c = this.state.cells[index];
    if (!c) return null;
    return {
      index: c.index,
      x: this.grid.x(index),
      y: this.grid.y(index),
      lat: this.grid.lat(index),
      lon: this.grid.lon(index),
      elevation: c.elevation,
      temperature: c.temperature,
      moisture: c.moisture,
      biome: c.biome,
      fertility: c.fertility,
      pollution: c.pollution,
      river: c.river,
      isOcean: c.isOcean,
      isVolcanic: c.isVolcanic,
      hasIce: c.hasIce,
      ownerCivId: c.ownerCivId,
      cityId: c.cityId,
      population: Math.round(c.population),
      plantCoverage: c.plantCoverage,
      resources: c.resources.map((r) => ({ kind: r.kind, amount: r.amount })),
    };
  }

  private regionDelta(index: number): Partial<RegionData> & { index: number } {
    const c = this.state.cells[index]!;
    return {
      index,
      temperature: c.temperature,
      moisture: c.moisture,
      pollution: c.pollution,
      population: Math.round(c.population),
      plantCoverage: c.plantCoverage,
      biome: c.biome,
      isOcean: c.isOcean,
      hasIce: c.hasIce,
      ownerCivId: c.ownerCivId,
      cityId: c.cityId,
      fertility: c.fertility,
    };
  }

  getLayer(layer: LayerId): LayerPayload {
    const cells: LayerPayload["cells"] = [];
    const legend: LayerPayload["legend"] = [];
    switch (layer) {
      case "biome":
      case "surface": {
        for (const c of this.state.cells) {
          cells.push({ index: c.index, value: c.isOcean ? 0 : c.elevation, color: BIOME_COLORS[c.biome] });
        }
        for (const [biome, color] of Object.entries(BIOME_COLORS)) legend.push({ color, labelKey: `biome.${biome}` });
        break;
      }
      case "temperature": {
        for (const c of this.state.cells) cells.push({ index: c.index, value: (c.temperature + 40) / 90 });
        legend.push({ color: "#2166ac", labelKey: "legend.cold" }, { color: "#b2182b", labelKey: "legend.hot" });
        break;
      }
      case "pollution": {
        for (const c of this.state.cells) cells.push({ index: c.index, value: c.pollution });
        legend.push({ color: "#5ab4ac", labelKey: "legend.clean" }, { color: "#8c510a", labelKey: "legend.polluted" });
        break;
      }
      case "weather": {
        for (const c of this.state.cells) cells.push({ index: c.index, value: Math.max(c.storm, c.droughtTicks > 2 ? 0.6 : 0, c.fire) });
        legend.push({ color: "#e0f3f8", labelKey: "legend.calm" }, { color: "#6a51a3", labelKey: "legend.storm" });
        break;
      }
      case "civilization": {
        for (const c of this.state.cells) {
          const civ = c.ownerCivId ? this.state.civs.get(c.ownerCivId) : null;
          cells.push({ index: c.index, value: civ ? 1 : 0, color: civ ? civ.color : undefined });
        }
        break;
      }
      case "resource": {
        for (const c of this.state.cells) {
          const best = c.resources.reduce((m, r) => Math.max(m, r.amount), 0);
          cells.push({ index: c.index, value: best });
        }
        legend.push({ color: "#ffd700", labelKey: "legend.resources" });
        break;
      }
      case "conflict": {
        const hot = new Set<number>();
        for (const w of this.state.wars.values()) if (w.status === "active") for (const i of w.frontCells) hot.add(i);
        for (const c of this.state.cells) cells.push({ index: c.index, value: hot.has(c.index) ? 1 : 0 });
        legend.push({ color: "#e03131", labelKey: "legend.war" });
        break;
      }
      case "migration": {
        const onPath = new Map<number, number>();
        for (const m of this.state.migrations.values()) {
          if (m.completedTick !== null) continue;
          for (const i of m.path) onPath.set(i, (onPath.get(i) ?? 0) + 1);
        }
        for (const c of this.state.cells) cells.push({ index: c.index, value: Math.min(1, (onPath.get(c.index) ?? 0) / 3) });
        legend.push({ color: "#9775fa", labelKey: "legend.migration" });
        break;
      }
      case "trade": {
        const onRoute = new Map<number, number>();
        for (const r of this.state.tradeRoutes.values()) {
          if (!r.active) continue;
          for (const i of r.path) onRoute.set(i, (onRoute.get(i) ?? 0) + 1);
        }
        for (const c of this.state.cells) cells.push({ index: c.index, value: Math.min(1, (onRoute.get(c.index) ?? 0) / 3) });
        legend.push({ color: "#ffd43b", labelKey: "legend.trade" });
        break;
      }
      case "history": {
        for (const c of this.state.cells) {
          const evId = this.lastEventByCell.get(c.index);
          const ev = evId ? this.eventById.get(evId) : undefined;
          cells.push({ index: c.index, value: ev ? Math.min(1, ev.magnitude + 0.2) : 0 });
        }
        legend.push({ color: "#f8f9fa", labelKey: "legend.history" });
        break;
      }
    }
    return { layer, cells, legend };
  }

  getTimeline(limit = 200): TimelineEntry[] {
    const important = this.events
      .filter((e) => e.magnitude >= 0.4)
      .slice(-limit)
      .map((e) => ({ tick: e.tick, simYear: e.simYear, type: e.type, title: e.title, magnitude: e.magnitude }));
    return important;
  }

  getEvents(opts: { fromTick?: number; types?: WorldEventType[]; contributionId?: string; limit?: number }): WorldEvent[] {
    let list = this.events;
    if (opts.fromTick !== undefined) list = list.filter((e) => e.tick >= opts.fromTick!);
    if (opts.types && opts.types.length > 0) list = list.filter((e) => opts.types!.includes(e.type));
    if (opts.contributionId) list = list.filter((e) => e.contributionId === opts.contributionId);
    return list.slice(-(opts.limit ?? 500));
  }
}
