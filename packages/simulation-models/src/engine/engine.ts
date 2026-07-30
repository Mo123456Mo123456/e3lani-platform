/**
 * SimulationEngine — deterministic, tick-based, event-sourced world engine.
 *
 * Guarantees:
 *  - Same seed + same inputs => identical event journal and identical state
 *    fingerprint (covered by tests).
 *  - Every state change is described by an appended WorldEvent with explicit
 *    causes; nothing mutates silently.
 *  - Snapshots + replay allow rollback to any tick.
 */
import type {
  EventType,
  PlanetStats,
  StateDelta,
  WorldEvent,
} from "@planet/shared-types";
import { rngFromString, type Rng } from "../rng";
import { generatePlanet, type WorldgenConfig } from "../worldgen/planet";
import { genesisBiosphere, genesisCivilizations, genesisTechnology } from "./genesis";
import {
  cloneState,
  stateFingerprint,
  type WorldState,
} from "./state";
import { climateSystem } from "./systems/climate";
import { ecosystemSystem } from "./systems/ecosystem";
import { civilizationSystem } from "./systems/civilization";
import { conflictSystem } from "./systems/conflict";
import { economySystem } from "./systems/economy";

export interface EngineConfig {
  planetId: string;
  seed: string;
  yearsPerTick: number;
  snapshotInterval: number;
  worldgen: Partial<WorldgenConfig>;
  initialCivilizations: number;
  initialSpecies: number;
  initialPlants: number;
  initialTechs: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  planetId: "planet",
  seed: "planet-genesis-prime",
  yearsPerTick: 5,
  snapshotInterval: 25,
  worldgen: {},
  initialCivilizations: 6,
  initialSpecies: 40,
  initialPlants: 48,
  initialTechs: 50,
};

export interface EmitInput {
  type: EventType;
  cell: number;
  causeIds: string[];
  cause: string;
  actors?: WorldEvent["actors"];
  data?: Record<string, number | string | boolean>;
  importance?: number;
  confidence?: number;
  originUserId?: string | null;
  originContributionId?: string | null;
}

export interface SystemCtx {
  state: WorldState;
  rng: Rng;
  emit: (input: EmitInput) => WorldEvent;
}

type System = (ctx: SystemCtx) => void;

/** a user placement to re-apply during deterministic replay */
export interface ReplayedPlacement {
  createdAtTick: number;
  applyOrder: number;
  apply(state: WorldState, emit: (input: EmitInput) => WorldEvent): void;
}

const SYSTEM_ORDER: Array<{ name: string; run: System }> = [
  { name: "climate", run: climateSystem },
  { name: "ecosystem", run: ecosystemSystem },
  { name: "civilization", run: civilizationSystem },
  { name: "conflict", run: conflictSystem },
  { name: "economy", run: economySystem },
];

export class SimulationEngine {
  readonly config: EngineConfig;
  state: WorldState;
  readonly journal: WorldEvent[] = [];
  private readonly snapshots = new Map<number, WorldState>();
  /** journal length at the moment each snapshot was taken — enables exact replay */
  private readonly snapshotJournalLen = new Map<number, number>();
  private lastDelta: StateDelta | null = null;

  private constructor(config: EngineConfig, state: WorldState) {
    this.config = config;
    this.state = state;
  }

  /** Create a brand-new world: procedural planet + genesis biosphere/civs. */
  static genesis(partial: Partial<EngineConfig> = {}): SimulationEngine {
    const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...partial };
    const grid = generatePlanet({ ...config.worldgen, seed: config.seed });
    const state: WorldState = {
      planetId: config.planetId,
      seed: config.seed,
      tick: 0,
      year: 0,
      yearsPerTick: config.yearsPerTick,
      grid,
      species: [],
      plants: [],
      civs: [],
      cities: [],
      techs: [],
      cultures: [],
      languages: [],
      tradeRoutes: [],
      alliances: [],
      wars: [],
      diseases: [],
      migrations: [],
      contributions: [],
      climate: { globalTemp: 0.5, volcanicForcing: 0, droughtStreak: {}, warIntents: {} },
      counters: { entity: 0, event: 0 },
    };
    const engine = new SimulationEngine(config, state);
    const rng = rngFromString(`${config.seed}:genesis`);
    const emit = engine.makeEmitter();
    emit({
      type: "WORLD_GENESIS",
      cell: -1,
      causeIds: [],
      cause: "planet formed from the initial seed",
      data: { seed: config.seed },
      importance: 1,
      confidence: 1,
    });
    genesisTechnology(state, rng, config.initialTechs);
    genesisBiosphere(state, rng, emit, {
      speciesCount: config.initialSpecies,
      plantCount: config.initialPlants,
    });
    genesisCivilizations(state, rng, emit, config.initialCivilizations);
    engine.snapshotNow();
    return engine;
  }

  /** Restore an engine from a serialized snapshot (API rehydration). */
  static fromSnapshot(config: EngineConfig, snapshot: WorldState, journal: WorldEvent[] = []): SimulationEngine {
    const engine = new SimulationEngine(config, cloneState(snapshot));
    engine.journal.push(...journal.map((e) => ({ ...e })));
    engine.snapshots.set(snapshot.tick, cloneState(snapshot));
    engine.snapshotJournalLen.set(snapshot.tick, journal.length);
    return engine;
  }

  /** Public so contribution tooling can emit on throwaway branches. */
  makeEmitter(): (input: EmitInput) => WorldEvent {
    return (input) => {
      const state = this.state;
      state.counters.event++;
      // attribution propagates downstream: any event citing a contribution
      // inherits its owner so impact queries see the full blast radius
      let originUserId = input.originUserId ?? null;
      const originContributionId = input.originContributionId ?? null;
      if (!originUserId && originContributionId) {
        originUserId =
          state.contributions.find((c) => c.id === originContributionId)?.userId ?? null;
      }
      const event: WorldEvent = {
        id: `ev-${state.tick}-${state.counters.event}`,
        planetId: state.planetId,
        tick: state.tick,
        year: state.year,
        type: input.type,
        cell: input.cell,
        causeIds: input.causeIds,
        cause: input.cause,
        actors: input.actors ?? [],
        data: input.data ?? {},
        confidence: input.confidence ?? 0.9,
        importance: input.importance ?? 0.5,
        originUserId,
        originContributionId,
      };
      this.journal.push(event);
      return event;
    };
  }

  /** Advance exactly one tick; returns the events produced by this tick. */
  tick(): WorldEvent[] {
    const before = this.snapshotForDelta();
    const startIdx = this.journal.length;
    const tickRng = rngFromString(`${this.state.seed}:tick:${this.state.tick}`);
    const emit = this.makeEmitter();
    const ctx: SystemCtx = { state: this.state, rng: tickRng, emit };

    for (const system of SYSTEM_ORDER) {
      system.run({ ...ctx, rng: tickRng.fork(system.name) });
    }

    this.state.tick++;
    this.state.year += this.state.yearsPerTick;
    if (this.state.tick % this.config.snapshotInterval === 0) {
      this.snapshotNow();
    }
    this.lastDelta = this.computeDelta(before);
    return this.journal.slice(startIdx);
  }

  run(ticks: number): WorldEvent[] {
    const out: WorldEvent[] = [];
    for (let i = 0; i < ticks; i++) out.push(...this.tick());
    return out;
  }

  snapshotNow(): void {
    this.snapshots.set(this.state.tick, cloneState(this.state));
    this.snapshotJournalLen.set(this.state.tick, this.journal.length);
  }

  availableSnapshots(): number[] {
    return [...this.snapshots.keys()].sort((a, b) => a - b);
  }

  getSnapshot(tick: number): WorldState | null {
    const snap = this.snapshots.get(tick);
    return snap ? cloneState(snap) : null;
  }

  /**
   * Roll back to the moment right after `targetTick` completed:
   * restore the nearest snapshot at or before it, then replay forward.
   * User placements with createdAtTick in [snapTick, targetTick) are
   * re-applied in order at their original tick — snapshots do not contain
   * them, so replay without them would diverge. Placements at exactly
   * targetTick happened "after" the target moment and are NOT re-applied.
   * Deterministic replay makes the regenerated journal identical.
   */
  rollbackTo(
    targetTick: number,
    placements: ReplayedPlacement[] = [],
  ): { ok: true; snapTick: number; journalLenAtSnap: number } | { ok: false } {
    if (targetTick < 0 || targetTick > this.state.tick) return { ok: false };
    const candidates = this.availableSnapshots().filter((t) => t <= targetTick);
    if (candidates.length === 0) return { ok: false };
    const snapTick = candidates[candidates.length - 1]!;
    this.state = cloneState(this.snapshots.get(snapTick)!);
    const journalLenAtSnap = this.snapshotJournalLen.get(snapTick) ?? 0;
    this.journal.length = journalLenAtSnap;
    for (const t of this.availableSnapshots()) {
      if (t > snapTick) {
        this.snapshots.delete(t);
        this.snapshotJournalLen.delete(t);
      }
    }
    const pending = placements
      .filter((p) => p.createdAtTick >= snapTick && p.createdAtTick < targetTick)
      .sort((a, b) => a.createdAtTick - b.createdAtTick || a.applyOrder - b.applyOrder);
    while (this.state.tick < targetTick) {
      for (const placement of pending.filter((p) => p.createdAtTick === this.state.tick)) {
        placement.apply(this.state, this.makeEmitter());
      }
      this.tick();
    }
    return { ok: true, snapTick, journalLenAtSnap };
  }

  fingerprint(): string {
    return stateFingerprint(this.state);
  }

  getDelta(): StateDelta | null {
    return this.lastDelta;
  }

  stats(): PlanetStats {
    const biomeCounts: PlanetStats["biomeCounts"] = {};
    let land = 0;
    let ocean = 0;
    let deposits = 0;
    for (const cell of this.state.grid.cells) {
      biomeCounts[cell.biome] = (biomeCounts[cell.biome] ?? 0) + 1;
      if (cell.height >= this.state.grid.seaLevel) land++;
      else ocean++;
      deposits += cell.resources.length;
    }
    return {
      landCells: land,
      oceanCells: ocean,
      biomeCounts,
      civilizationCount: this.state.civs.filter((c) => !c.collapsedAtTick).length,
      cityCount: this.state.cities.filter((c) => !c.destroyedAtTick).length,
      speciesCount: this.state.species.filter((s) => !s.extinctAtTick).length,
      plantCount: this.state.plants.length,
      resourceDepositCount: deposits,
      activeWarCount: this.state.wars.filter((w) => !w.endedAtTick).length,
      eventCount: this.journal.length,
    };
  }

  // -- delta helpers ---------------------------------------------------------

  private snapshotForDelta() {
    const cells = this.state.grid.cells.map((c) => ({
      ownerId: c.ownerId,
      pollution: Math.round(c.pollution * 500),
      temperature: Math.round(c.temperature * 500),
      moisture: Math.round(c.moisture * 500),
    }));
    return {
      cells,
      cityIds: new Set(this.state.cities.map((c) => c.id)),
      speciesIds: new Set(this.state.species.map((s) => s.id)),
      routeIds: new Set(this.state.tradeRoutes.map((r) => r.id)),
    };
  }

  private computeDelta(before: ReturnType<SimulationEngine["snapshotForDelta"]>): StateDelta {
    const state = this.state;
    const changedCells: StateDelta["cells"] = {};
    for (let i = 0; i < state.grid.cells.length; i++) {
      const c = state.grid.cells[i]!;
      const b = before.cells[i]!;
      if (
        c.ownerId !== b.ownerId ||
        Math.round(c.pollution * 500) !== b.pollution ||
        Math.round(c.temperature * 500) !== b.temperature ||
        Math.round(c.moisture * 500) !== b.moisture
      ) {
        changedCells[i] = {
          ownerId: c.ownerId,
          pollution: Math.round(c.pollution * 1000) / 1000,
          temperature: Math.round(c.temperature * 1000) / 1000,
          moisture: Math.round(c.moisture * 1000) / 1000,
        };
      }
    }
    const newCities = state.cities.filter((c) => !before.cityIds.has(c.id));
    const destroyedCityIds = state.cities
      .filter((c) => c.destroyedAtTick === state.tick)
      .map((c) => c.id);
    const newSpecies = state.species.filter((s) => !before.speciesIds.has(s.id));
    const extinctSpeciesIds = state.species
      .filter((s) => s.extinctAtTick === state.tick)
      .map((s) => s.id);
    const newTradeRoutes = state.tradeRoutes.filter((r) => !before.routeIds.has(r.id));
    return {
      tick: state.tick,
      cells: changedCells,
      newCities,
      destroyedCityIds,
      newSpecies,
      extinctSpeciesIds,
      newTradeRoutes,
      activeWarIds: state.wars.filter((w) => !w.endedAtTick).map((w) => w.id),
      stats: this.stats(),
    };
  }
}
