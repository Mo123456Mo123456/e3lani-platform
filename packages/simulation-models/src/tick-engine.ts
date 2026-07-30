/**
 * Deterministic event-sourced simulation tick engine.
 */

import type {
  ElementCategory,
  ForecastResult,
  ForecastScenario,
  TickType,
  WorldEventType,
} from "@planet/shared-types";
import { SeededRNG } from "./seeded-rng.js";
import { CausalGraph } from "./causal-graph.js";
import { World } from "./ecs.js";
import {
  buildFoodWeb,
  habitatSuitability,
  carryingCapacity,
  populationGrowth,
  predationPressure,
  lotkaVolterraStep,
} from "./ecology.js";
import { chooseAction, resolveWar, warProbability, type CivState, type CivRelation } from "./civilization.js";
import { createClimateGrid, climateStep, type ClimateGrid } from "./climate.js";
import {
  priceFromSupplyDemand,
  scarcity,
  tradeRouteCost,
  updateMarket,
  type MarketGood,
  type RegionNode,
} from "./economy.js";
import { balanceUserElement, type ElementTraits } from "./balance.js";
import { ProceduralPlanetGenerator, type PlanetTerrainData } from "./world-generator.js";

export interface WorldEventRecord {
  id: string;
  type: WorldEventType;
  tick: number;
  causeIds: string[];
  regionId?: string;
  contributionId?: string;
  payload: Record<string, unknown>;
  confidence: number;
  directEffects: string[];
  narrativeHints: string[];
}

export interface UserElementInput {
  contributionId: string;
  category: ElementCategory;
  title: string;
  traits: ElementTraits;
  regionId?: string;
}

export interface SimSpecies {
  id: string;
  name: string;
  population: number;
  carryingCapacity: number;
  growthRate: number;
  diet: "herbivore" | "carnivore" | "omnivore" | "producer";
  size: number;
  strength: number;
  aggression: number;
  adaptability: number;
  reproductionRate: number;
  habitatPreference: import("@planet/shared-types").BiomeId[];
  regionId: string;
}

export interface SimCiv {
  id: string;
  name: string;
  population: number;
  techLevel: number;
  militaryPower: number;
  economyStrength: number;
  aggression: number;
  expansionism: number;
  diplomacy: number;
  foodStock: number;
  regionIds: string[];
  resourceAccess: number;
}

export interface EngineState {
  tick: number;
  year: number;
  tickType: TickType;
  species: SimSpecies[];
  civilizations: SimCiv[];
  goods: MarketGood[];
  wars: Array<{ id: string; attackerId: string; defenderId: string; startedTick: number }>;
  alliances: Array<{ id: string; civIds: string[]; strength: number }>;
}

const YEARS_PER: Record<TickType, number> = {
  day: 1 / 365,
  month: 1 / 12,
  year: 1,
  decade: 10,
};

function hashState(state: EngineState, eventCount: number): string {
  const raw = JSON.stringify({
    tick: state.tick,
    year: state.year,
    eventCount,
    species: state.species.map((s) => [s.id, Math.round(s.population)]),
    civs: state.civilizations.map((c) => [c.id, Math.round(c.population), c.techLevel]),
  });
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export class SimulationTickEngine {
  readonly seed: string;
  readonly causal: CausalGraph = new CausalGraph();
  readonly ecs = new World();
  private rng: SeededRNG;
  private events: WorldEventRecord[] = [];
  private state: EngineState;
  private terrain: PlanetTerrainData;
  private climate: ClimateGrid;
  private regionGraph: Map<string, RegionNode>;
  private eventCounter = 0;
  private snapshots: Array<{ tick: number; state: EngineState; events: WorldEventRecord[]; rngState: number }> = [];

  constructor(seed: string, tickType: TickType = "year", resolution = 32) {
    this.seed = seed;
    this.rng = new SeededRNG(seed);
    this.terrain = new ProceduralPlanetGenerator(seed, resolution).generate();
    this.climate = createClimateGrid(
      this.terrain.resolution,
      this.terrain.resolution,
      this.terrain.temperatureMap,
      this.terrain.moistureMap,
    );
    this.regionGraph = this.buildRegionGraph();
    this.state = this.bootstrapState(tickType);
    const genesis = this.makeEvent("GENESIS", [], {
      seed,
      regions: this.terrain.regions.length,
    }, 1, ["world_created"], ["The world awakens from seed."]);
    this.appendAndApply(genesis);
  }

  getTick(): number {
    return this.state.tick;
  }

  getState(): EngineState {
    return structuredClone(this.state);
  }

  getEvents(): readonly WorldEventRecord[] {
    return this.events;
  }

  getTerrain(): PlanetTerrainData {
    return this.terrain;
  }

  private buildRegionGraph(): Map<string, RegionNode> {
    const map = new Map<string, RegionNode>();
    const regions = this.terrain.regions;
    for (const r of regions) {
      map.set(r.id, { id: r.id, neighbors: [] });
    }
    // 4x4 grid neighbors
    for (const r of regions) {
      const m = /^r(\d+)_(\d+)$/.exec(r.id);
      if (!m) continue;
      const gy = Number(m[1]);
      const gx = Number(m[2]);
      const node = map.get(r.id)!;
      for (const [dy, dx] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const) {
        const nid = `r${gy + dy}_${gx + dx}`;
        if (map.has(nid)) {
          const cost = 1 + Math.abs(r.elevMean - (map.get(nid) ? this.terrain.regions.find((x) => x.id === nid)!.elevMean : 0));
          node.neighbors.push({ id: nid, cost });
        }
      }
    }
    return map;
  }

  private bootstrapState(tickType: TickType): EngineState {
    const landRegions = this.terrain.regions.filter((r) => r.landFraction > 0.3);
    const pickRegion = () =>
      landRegions.length
        ? this.rng.pick(landRegions).id
        : this.terrain.regions[0]!.id;

    const producers: SimSpecies = {
      id: "sp_flora",
      name: "Primordial Flora",
      population: 8000,
      carryingCapacity: 12000,
      growthRate: 0.35,
      diet: "producer",
      size: 0.2,
      strength: 0.1,
      aggression: 0,
      adaptability: 0.7,
      reproductionRate: 0.6,
      habitatPreference: ["plains", "rainforest", "temperate_forest", "swamp", "coast"],
      regionId: pickRegion(),
    };
    const herb: SimSpecies = {
      id: "sp_grazer",
      name: "Grazer",
      population: 2000,
      carryingCapacity: 4000,
      growthRate: 0.22,
      diet: "herbivore",
      size: 0.4,
      strength: 0.3,
      aggression: 0.2,
      adaptability: 0.55,
      reproductionRate: 0.4,
      habitatPreference: ["plains", "steppe", "temperate_forest"],
      regionId: pickRegion(),
    };
    const carn: SimSpecies = {
      id: "sp_hunter",
      name: "Hunter",
      population: 400,
      carryingCapacity: 800,
      growthRate: 0.12,
      diet: "carnivore",
      size: 0.55,
      strength: 0.65,
      aggression: 0.6,
      adaptability: 0.45,
      reproductionRate: 0.25,
      habitatPreference: ["plains", "temperate_forest", "mountain"],
      regionId: pickRegion(),
    };

    const civRegion = pickRegion();
    const civ: SimCiv = {
      id: "civ_first",
      name: "First Folk",
      population: 1200,
      techLevel: 0.15,
      militaryPower: 0.2,
      economyStrength: 0.25,
      aggression: 0.3,
      expansionism: 0.4,
      diplomacy: 0.5,
      foodStock: 500,
      regionIds: [civRegion],
      resourceAccess: 0.5,
    };

    // optional second civ for interaction
    const civ2: SimCiv = {
      id: "civ_second",
      name: "Shore Clans",
      population: 900,
      techLevel: 0.12,
      militaryPower: 0.18,
      economyStrength: 0.22,
      aggression: 0.45,
      expansionism: 0.35,
      diplomacy: 0.4,
      foodStock: 350,
      regionIds: [pickRegion()],
      resourceAccess: 0.4,
    };

    return {
      tick: 0,
      year: 0,
      tickType,
      species: [producers, herb, carn],
      civilizations: [civ, civ2],
      goods: [
        { id: "food", supply: 1000, demand: 800, basePrice: 1 },
        { id: "ore", supply: 200, demand: 150, basePrice: 3 },
        { id: "fuel", supply: 100, demand: 80, basePrice: 5 },
      ],
      wars: [],
      alliances: [],
    };
  }

  private nextEventId(): string {
    this.eventCounter += 1;
    return `evt_${this.seed}_${this.eventCounter}`;
  }

  private makeEvent(
    type: WorldEventType,
    causeIds: string[],
    payload: Record<string, unknown>,
    confidence: number,
    directEffects: string[],
    narrativeHints: string[],
    regionId?: string,
    contributionId?: string,
  ): WorldEventRecord {
    return {
      id: this.nextEventId(),
      type,
      tick: this.state.tick,
      causeIds,
      regionId,
      contributionId,
      payload,
      confidence,
      directEffects,
      narrativeHints,
    };
  }

  private appendAndApply(event: WorldEventRecord): void {
    this.events.push(event);
    this.applyEvent(event);
  }

  applyEvent(event: WorldEventRecord): void {
    this.causal.addNode({
      id: event.id,
      label: `${event.type}@${event.tick}`,
      kind: "event",
      tick: event.tick,
      meta: event.payload,
    });
    for (const c of event.causeIds) {
      this.causal.addCause(c, event.id, event.confidence, "causes");
    }

    switch (event.type) {
      case "SPECIES_CREATED": {
        const sp = event.payload.species as SimSpecies;
        if (sp && !this.state.species.find((s) => s.id === sp.id)) {
          this.state.species.push(sp);
        }
        break;
      }
      case "SPECIES_MUTATED": {
        const id = event.payload.speciesId as string;
        const sp = this.state.species.find((s) => s.id === id);
        if (sp) {
          sp.adaptability = Math.min(0.95, sp.adaptability + 0.05);
          sp.strength = Math.min(0.95, sp.strength + (Number(event.payload.deltaStrength) || 0.02));
        }
        break;
      }
      case "SPECIES_EXTINCT": {
        const id = event.payload.speciesId as string;
        this.state.species = this.state.species.filter((s) => s.id !== id);
        break;
      }
      case "CIVILIZATION_FOUNDED": {
        const civ = event.payload.civilization as SimCiv;
        if (civ && !this.state.civilizations.find((c) => c.id === civ.id)) {
          this.state.civilizations.push(civ);
        }
        break;
      }
      case "TECHNOLOGY_DISCOVERED": {
        const civId = event.payload.civilizationId as string;
        const civ = this.state.civilizations.find((c) => c.id === civId);
        if (civ) civ.techLevel = Math.min(1, civ.techLevel + (Number(event.payload.amount) || 0.05));
        break;
      }
      case "WAR_STARTED": {
        this.state.wars.push({
          id: event.id,
          attackerId: String(event.payload.attackerId),
          defenderId: String(event.payload.defenderId),
          startedTick: event.tick,
        });
        break;
      }
      case "WAR_ENDED": {
        const warId = String(event.payload.warId ?? "");
        this.state.wars = this.state.wars.filter((w) => w.id !== warId);
        break;
      }
      case "ALLIANCE_CREATED": {
        this.state.alliances.push({
          id: event.id,
          civIds: event.payload.civIds as string[],
          strength: Number(event.payload.strength) || 0.5,
        });
        break;
      }
      case "RESOURCE_DISCOVERED": {
        const good = this.state.goods.find((g) => g.id === event.payload.resourceId);
        if (good) good.supply += Number(event.payload.amount) || 50;
        break;
      }
      case "RESOURCE_DEPLETED": {
        const good = this.state.goods.find((g) => g.id === event.payload.resourceId);
        if (good) good.supply = Math.max(0, good.supply - (Number(event.payload.amount) || 30));
        break;
      }
      case "CLIMATE_CHANGED": {
        const delta = Number(event.payload.tempDelta) || 0;
        for (let i = 0; i < this.climate.temperature.length; i++) {
          this.climate.temperature[i] = Math.min(
            1,
            Math.max(0, this.climate.temperature[i]! + delta),
          );
        }
        break;
      }
      case "VOLCANO_ERUPTED": {
        for (let i = 0; i < this.climate.pollution.length; i++) {
          this.climate.pollution[i] = Math.min(1, this.climate.pollution[i]! + 0.05);
        }
        break;
      }
      case "DISEASE_OUTBREAK": {
        const lethality = Number(event.payload.lethality) || 0.1;
        for (const sp of this.state.species) {
          sp.population = Math.max(0, sp.population * (1 - lethality * 0.3));
        }
        break;
      }
      case "MIGRATION_STARTED": {
        const sp = this.state.species.find((s) => s.id === event.payload.speciesId);
        if (sp && event.payload.toRegionId) sp.regionId = String(event.payload.toRegionId);
        break;
      }
      case "USER_ELEMENT_ADDED": {
        // effects applied via scheduled follow-up events
        break;
      }
      default:
        break;
    }
  }

  /**
   * Rebuild state by deterministic re-simulation from seed.
   * Re-injects user elements found in the event log, then runs to max tick.
   */
  rebuildFromEvents(events: WorldEventRecord[]): EngineState {
    const tickType = this.state.tickType;
    const resolution = this.terrain.resolution;
    const maxTick = events.reduce((m, e) => Math.max(m, e.tick), 0);

    this.rng = new SeededRNG(this.seed);
    this.eventCounter = 0;
    this.events = [];
    this.causal.clear();
    this.snapshots = [];
    this.terrain = new ProceduralPlanetGenerator(this.seed, resolution).generate();
    this.climate = createClimateGrid(
      this.terrain.resolution,
      this.terrain.resolution,
      this.terrain.temperatureMap,
      this.terrain.moistureMap,
    );
    this.regionGraph = this.buildRegionGraph();
    this.state = this.bootstrapState(tickType);

    const genesis = this.makeEvent(
      "GENESIS",
      [],
      { seed: this.seed, regions: this.terrain.regions.length },
      1,
      ["world_created"],
      ["The world awakens from seed."],
    );
    this.appendAndApply(genesis);

    // Re-apply user elements that were injected at tick 0 (before ticks ran)
    for (const e of events) {
      if (e.type !== "USER_ELEMENT_ADDED") continue;
      if (e.tick > 0) continue;
      this.injectUserElement({
        contributionId: e.contributionId ?? String(e.payload.contributionId ?? e.id),
        category: e.payload.category as UserElementInput["category"],
        title: String(e.payload.title ?? "element"),
        traits: (e.payload.traits ?? {}) as ElementTraits,
        regionId: e.regionId,
      });
    }

    if (maxTick > 0) this.runTicks(maxTick);

    // Apply late user elements (injected mid-simulation) — rare; include for completeness
    for (const e of events) {
      if (e.type !== "USER_ELEMENT_ADDED") continue;
      if (e.tick === 0) continue;
      // already past; state from re-sim of ticks without mid-inject may diverge —
      // for mid-inject, apply causal payload effects only
      this.applyEvent(e);
    }

    return this.getState();
  }

  snapshot(): { tick: number; stateHash: string; state: EngineState; eventCount: number } {
    const snap = {
      tick: this.state.tick,
      state: structuredClone(this.state),
      events: structuredClone(this.events),
      rngState: this.rng.seedValue,
    };
    this.snapshots.push(snap);
    return {
      tick: this.state.tick,
      stateHash: hashState(this.state, this.events.length),
      state: structuredClone(this.state),
      eventCount: this.events.length,
    };
  }

  restore(snapIndex = -1): void {
    const snap = this.snapshots.at(snapIndex);
    if (!snap) throw new Error("No snapshot available");
    this.state = structuredClone(snap.state);
    this.events = structuredClone(snap.events);
  }

  injectUserElement(element: UserElementInput): WorldEventRecord[] {
    const balance = balanceUserElement(element.traits);
    const genesisId = this.events[0]?.id;
    const causeIds = genesisId ? [genesisId] : [];
    const added = this.makeEvent(
      "USER_ELEMENT_ADDED",
      causeIds,
      {
        title: element.title,
        category: element.category,
        traits: balance.balanced,
        warnings: balance.warnings,
        rejectedFlags: balance.rejected,
      },
      0.9,
      ["user_element_integrated"],
      [`User added ${element.title}`, ...balance.warnings],
      element.regionId,
      element.contributionId,
    );
    this.appendAndApply(added);
    const followUps: WorldEventRecord[] = [added];

    const traits = balance.balanced;
    if (element.category === "creature" || element.category === "plant") {
      const diet =
        element.category === "plant"
          ? "producer"
          : ((traits as { diet?: string }).diet as SimSpecies["diet"]) || "omnivore";
      const sp: SimSpecies = {
        id: `sp_user_${element.contributionId}`,
        name: element.title,
        population: 200,
        carryingCapacity: 2000,
        growthRate: typeof traits.growthRate === "number" ? traits.growthRate : 0.15,
        diet,
        size: typeof traits.size === "number" ? traits.size : 0.4,
        strength: typeof traits.strength === "number" ? traits.strength : 0.4,
        aggression: typeof traits.aggression === "number" ? traits.aggression : 0.3,
        adaptability: typeof traits.adaptability === "number" ? traits.adaptability : 0.5,
        reproductionRate:
          typeof traits.reproductionRate === "number" ? traits.reproductionRate : 0.3,
        habitatPreference: ["plains", "temperate_forest"],
        regionId: element.regionId ?? this.terrain.regions[0]!.id,
      };
      const created = this.makeEvent(
        "SPECIES_CREATED",
        [added.id],
        { species: sp },
        0.85,
        ["population_added"],
        [`${sp.name} enters the biosphere`],
        sp.regionId,
        element.contributionId,
      );
      this.appendAndApply(created);
      followUps.push(created);
    } else if (element.category === "civilization") {
      const civ: SimCiv = {
        id: `civ_user_${element.contributionId}`,
        name: element.title,
        population: 800,
        techLevel: typeof traits.techLevel === "number" ? traits.techLevel : 0.2,
        militaryPower: typeof traits.militaryPower === "number" ? traits.militaryPower : 0.25,
        economyStrength: 0.3,
        aggression: typeof traits.aggression === "number" ? traits.aggression : 0.35,
        expansionism: 0.4,
        diplomacy: 0.45,
        foodStock: 300,
        regionIds: [element.regionId ?? this.terrain.regions[0]!.id],
        resourceAccess: 0.45,
      };
      const founded = this.makeEvent(
        "CIVILIZATION_FOUNDED",
        [added.id],
        { civilization: civ },
        0.85,
        ["civ_added"],
        [`Civilization ${civ.name} founded`],
        civ.regionIds[0],
        element.contributionId,
      );
      this.appendAndApply(founded);
      followUps.push(founded);
    } else if (element.category === "resource") {
      const disc = this.makeEvent(
        "RESOURCE_DISCOVERED",
        [added.id],
        {
          resourceId: "ore",
          amount: typeof traits.abundance === "number" ? traits.abundance * 100 : 50,
          name: element.title,
        },
        0.8,
        ["resource_boost"],
        [`Resource ${element.title} discovered`],
        element.regionId,
        element.contributionId,
      );
      this.appendAndApply(disc);
      followUps.push(disc);
    } else if (element.category === "disease") {
      const outbreak = this.makeEvent(
        "DISEASE_OUTBREAK",
        [added.id],
        {
          name: element.title,
          lethality: typeof traits.lethality === "number" ? traits.lethality : 0.2,
          infectivity: typeof traits.infectivity === "number" ? traits.infectivity : 0.3,
        },
        0.75,
        ["disease_spread"],
        [`Disease ${element.title} emerges`],
        element.regionId,
        element.contributionId,
      );
      this.appendAndApply(outbreak);
      followUps.push(outbreak);
    } else if (element.category === "natural_phenomenon") {
      const vol = this.makeEvent(
        "VOLCANO_ERUPTED",
        [added.id],
        { name: element.title },
        0.7,
        ["ash_cloud"],
        [`Natural event: ${element.title}`],
        element.regionId,
        element.contributionId,
      );
      this.appendAndApply(vol);
      followUps.push(vol);
    } else if (element.category === "invention") {
      const tech = this.makeEvent(
        "TECHNOLOGY_DISCOVERED",
        [added.id],
        {
          civilizationId: this.state.civilizations[0]?.id,
          name: element.title,
          amount: 0.08,
        },
        0.8,
        ["tech_boost"],
        [`Invention ${element.title} discovered`],
        element.regionId,
        element.contributionId,
      );
      this.appendAndApply(tech);
      followUps.push(tech);
    }

    return followUps;
  }

  private climateStepInternal(dt: number): WorldEventRecord[] {
    const out: WorldEventRecord[] = [];
    this.climate = climateStep(this.climate, dt);
    const fireCount = this.climate.fire.reduce((a, b) => a + b, 0);
    const droughtCount = this.climate.drought.reduce((a, b) => a + b, 0);
    if (fireCount > this.climate.fire.length * 0.05 && this.rng.nextFloat() < 0.3) {
      const last = this.events[this.events.length - 1];
      const ev = this.makeEvent(
        "CLIMATE_CHANGED",
        last ? [last.id] : [this.events[0]!.id],
        { tempDelta: 0.01, fireCells: fireCount, droughtCells: droughtCount },
        0.6,
        ["warming"],
        ["Wildfires alter the climate"],
      );
      this.appendAndApply(ev);
      out.push(ev);
    }
    return out;
  }

  private ecologyStepInternal(dt: number): WorldEventRecord[] {
    const out: WorldEventRecord[] = [];
    const web = buildFoodWeb(
      this.state.species.map((s) => ({
        id: s.id,
        diet: s.diet,
        size: s.size,
        aggression: s.aggression,
      })),
    );
    const pops = new Map(this.state.species.map((s) => [s.id, s.population]));

    // Lotka-Volterra for first herbivore-carnivore pair if present
    const prey = this.state.species.find((s) => s.diet === "herbivore");
    const pred = this.state.species.find((s) => s.diet === "carnivore");
    if (prey && pred) {
      const step = lotkaVolterraStep(prey.population, pred.population, {
        preyGrowth: prey.growthRate,
        predationRate: 0.00008,
        predatorEfficiency: 0.0004,
        predatorDeath: 0.08,
        preyCapacity: prey.carryingCapacity,
      }, dt);
      prey.population = step.prey;
      pred.population = step.predator;
      pops.set(prey.id, prey.population);
      pops.set(pred.id, pred.population);
    }

    for (const sp of this.state.species) {
      const region = this.terrain.regions.find((r) => r.id === sp.regionId) ?? this.terrain.regions[0]!;
      const suit = habitatSuitability(
        {
          habitatPreference: sp.habitatPreference,
          adaptability: sp.adaptability,
          size: sp.size,
        },
        {
          biome: region.biome,
          temperature: region.tempMean,
          moisture: region.moistMean,
          elevation: region.elevMean,
          pollution: 0.05,
        },
      );
      sp.carryingCapacity = carryingCapacity(sp.carryingCapacity, suit, region.biome, 1);
      if (!(prey && pred && (sp.id === prey.id || sp.id === pred.id))) {
        const loss = predationPressure(web, pops, sp.id);
        sp.population = populationGrowth(
          {
            count: sp.population,
            carryingCapacity: sp.carryingCapacity,
            growthRate: sp.growthRate,
          },
          dt,
          suit,
          loss,
        );
      }
      // enforce carrying capacity hard cap
      sp.population = Math.min(sp.population, sp.carryingCapacity * 1.05);
      pops.set(sp.id, sp.population);

      if (sp.population < 1 && sp.diet !== "producer") {
        const last = this.events[this.events.length - 1] ?? this.events[0]!;
        const ev = this.makeEvent(
          "SPECIES_EXTINCT",
          [last.id],
          { speciesId: sp.id, name: sp.name },
          0.9,
          ["extinction"],
          [`${sp.name} goes extinct`],
          sp.regionId,
        );
        this.appendAndApply(ev);
        out.push(ev);
      } else if (this.rng.nextFloat() < 0.02 * dt) {
        const last = this.events[this.events.length - 1] ?? this.events[0]!;
        const ev = this.makeEvent(
          "SPECIES_MUTATED",
          [last.id],
          { speciesId: sp.id, deltaStrength: 0.02 },
          0.5,
          ["mutation"],
          [`${sp.name} mutates`],
          sp.regionId,
        );
        this.appendAndApply(ev);
        out.push(ev);
      }
    }
    this.state.species = this.state.species.filter((s) => s.population >= 1 || s.diet === "producer");
    return out;
  }

  private civilizationStepInternal(dt: number): WorldEventRecord[] {
    const out: WorldEventRecord[] = [];
    for (const civ of this.state.civilizations) {
      const relations: CivRelation[] = this.state.civilizations
        .filter((o) => o.id !== civ.id)
        .map((o) => {
          const shared = civ.regionIds.some((r) => o.regionIds.includes(r));
          const path = tradeRouteCost(
            this.regionGraph,
            civ.regionIds[0]!,
            o.regionIds[0]!,
          );
          const alliance = this.state.alliances.find(
            (a) => a.civIds.includes(civ.id) && a.civIds.includes(o.id),
          );
          return {
            otherId: o.id,
            proximity: shared ? 1 : path ? 1 / (1 + path.cost) : 0.1,
            resourceConflict: Math.abs(civ.resourceAccess - o.resourceAccess),
            warHistory: this.state.wars.some(
              (w) =>
                (w.attackerId === civ.id && w.defenderId === o.id) ||
                (w.attackerId === o.id && w.defenderId === civ.id),
            )
              ? 0.5
              : 0,
            allianceStrength: alliance?.strength ?? 0,
            tradeVolume: path ? 1 / (1 + path.cost) : 0,
          };
        });

      const civState: CivState = { ...civ, neighbors: relations.map((r) => r.otherId) };
      const action = chooseAction(civState, relations, this.rng.fork(`civ:${civ.id}:${this.state.tick}`));
      const last = this.events[this.events.length - 1] ?? this.events[0]!;

      if (action === "research") {
        const ev = this.makeEvent(
          "TECHNOLOGY_DISCOVERED",
          [last.id],
          { civilizationId: civ.id, amount: 0.03 * dt },
          0.7,
          ["tech_up"],
          [`${civ.name} advances technology`],
          civ.regionIds[0],
        );
        this.appendAndApply(ev);
        out.push(ev);
      } else if (action === "alliance" && relations[0]) {
        const other = relations[0].otherId;
        if (!this.state.alliances.some((a) => a.civIds.includes(civ.id) && a.civIds.includes(other))) {
          const ev = this.makeEvent(
            "ALLIANCE_CREATED",
            [last.id],
            { civIds: [civ.id, other], strength: 0.5 },
            0.65,
            ["alliance"],
            [`${civ.name} forms an alliance`],
          );
          this.appendAndApply(ev);
          out.push(ev);
        }
      } else if (action === "trade" && relations[0]) {
        const other = this.state.civilizations.find((c) => c.id === relations[0]!.otherId);
        if (other) {
          const route = tradeRouteCost(this.regionGraph, civ.regionIds[0]!, other.regionIds[0]!);
          const ev = this.makeEvent(
            "TRADE_ROUTE_CREATED",
            [last.id],
            {
              from: civ.regionIds[0],
              to: other.regionIds[0],
              cost: route?.cost ?? 10,
            },
            0.7,
            ["trade"],
            [`Trade route from ${civ.name}`],
          );
          this.appendAndApply(ev);
          out.push(ev);
        }
      } else if (action === "war" && relations[0]) {
        const rel = relations[0];
        const p = warProbability(civState, rel);
        if (p > 0.45 && !this.state.wars.some((w) => w.attackerId === civ.id)) {
          const defender = this.state.civilizations.find((c) => c.id === rel.otherId)!;
          const start = this.makeEvent(
            "WAR_STARTED",
            [last.id],
            { attackerId: civ.id, defenderId: defender.id },
            p,
            ["war"],
            [`War: ${civ.name} vs ${defender.name}`],
          );
          this.appendAndApply(start);
          out.push(start);
          const result = resolveWar(
            {
              militaryPower: civ.militaryPower,
              techLevel: civ.techLevel,
              terrainAdvantage: 0.1,
              morale: 0.6,
              population: civ.population,
            },
            {
              militaryPower: defender.militaryPower,
              techLevel: defender.techLevel,
              terrainAdvantage: 0.2,
              morale: 0.55,
              population: defender.population,
            },
            this.rng.fork(`war:${start.id}`),
          );
          civ.population = Math.max(50, civ.population - result.attackerLoss);
          defender.population = Math.max(50, defender.population - result.defenderLoss);
          const end = this.makeEvent(
            "WAR_ENDED",
            [start.id],
            {
              warId: start.id,
              outcome: result.outcome,
              attackerLoss: result.attackerLoss,
              defenderLoss: result.defenderLoss,
            },
            0.8,
            ["war_end"],
            [`War ended: ${result.outcome}`],
          );
          this.appendAndApply(end);
          out.push(end);
        }
      } else if (action === "expand") {
        civ.population = Math.min(civ.population * (1 + 0.02 * dt), civ.population + 200);
        civ.resourceAccess = Math.min(1, civ.resourceAccess + 0.01 * dt);
      } else if (action === "migrate") {
        const target = this.rng.pick(this.terrain.regions);
        const ev = this.makeEvent(
          "MIGRATION_STARTED",
          [last.id],
          { civilizationId: civ.id, toRegionId: target.id, kind: "civilization" },
          0.6,
          ["migration"],
          [`${civ.name} migrates`],
          target.id,
        );
        this.appendAndApply(ev);
        out.push(ev);
        if (!civ.regionIds.includes(target.id)) civ.regionIds.push(target.id);
      }

      // food consumption
      civ.foodStock = Math.max(0, civ.foodStock - civ.population * 0.005 * dt + civ.economyStrength * 20 * dt);
      if (civ.foodStock < civ.population * 0.002) {
        civ.population = Math.max(50, civ.population * (1 - 0.05 * dt));
      } else {
        civ.population += civ.population * 0.01 * dt;
      }
    }
    return out;
  }

  private economyStepInternal(dt: number): WorldEventRecord[] {
    const out: WorldEventRecord[] = [];
    const production: Record<string, number> = {
      food: this.state.species.filter((s) => s.diet === "producer").reduce((a, s) => a + s.population * 0.01, 0),
      ore: 10,
      fuel: 5,
    };
    const consumption: Record<string, number> = {
      food: this.state.civilizations.reduce((a, c) => a + c.population * 0.008, 0),
      ore: this.state.civilizations.reduce((a, c) => a + c.techLevel * 5, 0),
      fuel: this.state.civilizations.reduce((a, c) => a + c.economyStrength * 4, 0),
    };
    this.state.goods = updateMarket(this.state.goods, production, consumption, dt);

    for (const g of this.state.goods) {
      const s = scarcity(g);
      const price = priceFromSupplyDemand(g);
      if (s > 0.85 && this.rng.nextFloat() < 0.25) {
        const last = this.events[this.events.length - 1] ?? this.events[0]!;
        const ev = this.makeEvent(
          "RESOURCE_DEPLETED",
          [last.id],
          { resourceId: g.id, amount: 20, price },
          0.7,
          ["scarcity"],
          [`${g.id} growing scarce`],
        );
        this.appendAndApply(ev);
        out.push(ev);
      } else if (s < 0.2 && this.rng.nextFloat() < 0.1) {
        const last = this.events[this.events.length - 1] ?? this.events[0]!;
        const ev = this.makeEvent(
          "RESOURCE_DISCOVERED",
          [last.id],
          { resourceId: g.id, amount: 40 },
          0.6,
          ["discovery"],
          [`New ${g.id} deposits found`],
        );
        this.appendAndApply(ev);
        out.push(ev);
      }
    }
    return out;
  }

  runTicks(n: number): WorldEventRecord[] {
    const newEvents: WorldEventRecord[] = [];
    const dt = YEARS_PER[this.state.tickType];
    for (let i = 0; i < n; i++) {
      this.state.tick += 1;
      this.state.year += dt;
      // re-seed per tick for determinism from seed+tick
      this.rng = new SeededRNG(`${this.seed}:tick:${this.state.tick}`);
      newEvents.push(...this.climateStepInternal(dt));
      newEvents.push(...this.ecologyStepInternal(dt));
      newEvents.push(...this.civilizationStepInternal(dt));
      newEvents.push(...this.economyStepInternal(dt));
    }
    return newEvents;
  }

  forecast(years: number, monteCarloRuns: number): ForecastResult {
    const ticks = Math.max(1, Math.round(years / YEARS_PER[this.state.tickType]));
    const baseSnap = {
      state: structuredClone(this.state),
      events: structuredClone(this.events),
      eventCounter: this.eventCounter,
    };

    const runs: Array<{ events: WorldEventRecord[]; metrics: Record<string, number> }> = [];

    for (let run = 0; run < monteCarloRuns; run++) {
      this.state = structuredClone(baseSnap.state);
      this.events = structuredClone(baseSnap.events);
      this.eventCounter = baseSnap.eventCounter;
      // perturb RNG via salt
      this.rng = new SeededRNG(`${this.seed}:mc:${run}`);
      const before = this.events.length;
      // temporarily fork seed influence by injecting tiny climate noise via event
      if (run > 0) {
        const last = this.events[this.events.length - 1] ?? this.events[0]!;
        const noiseEv = this.makeEvent(
          "CLIMATE_CHANGED",
          [last.id],
          { tempDelta: (this.rng.nextFloat() - 0.5) * 0.02, monteCarlo: run },
          0.4,
          ["forecast_noise"],
          ["Forecast branch"],
        );
        this.appendAndApply(noiseEv);
      }
      this.runTicks(ticks);
      const produced = this.events.slice(before);
      const metrics = {
        totalPopulation: this.state.species.reduce((a, s) => a + s.population, 0),
        civPopulation: this.state.civilizations.reduce((a, c) => a + c.population, 0),
        techSum: this.state.civilizations.reduce((a, c) => a + c.techLevel, 0),
        wars: produced.filter((e) => e.type === "WAR_STARTED").length,
        extinctions: produced.filter((e) => e.type === "SPECIES_EXTINCT").length,
      };
      runs.push({ events: produced, metrics });
    }

    // restore
    this.state = baseSnap.state;
    this.events = baseSnap.events;
    this.eventCounter = baseSnap.eventCounter;
    this.rng = new SeededRNG(`${this.seed}:tick:${this.state.tick}`);

    const score = (m: Record<string, number>) =>
      m.civPopulation! * 0.001 + m.techSum! * 100 - m.wars! * 50 - m.extinctions! * 80;

    runs.sort((a, b) => score(a.metrics) - score(b.metrics));
    const worst = runs[0]!;
    const best = runs[runs.length - 1]!;
    const mid = runs[Math.floor(runs.length / 2)]!;

    const scores = runs.map((r) => score(r.metrics));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, scores.length);
    const uncertainty = Math.min(1, Math.sqrt(variance) / (Math.abs(mean) + 1));

    const toScenario = (
      label: ForecastScenario["label"],
      run: (typeof runs)[0],
      probability: number,
    ): ForecastScenario => ({
      label,
      events: run.events as unknown as ForecastScenario["events"],
      metrics: run.metrics,
      probability,
    });

    return {
      years,
      monteCarloRuns,
      mostLikely: toScenario("mostLikely", mid, 1 / monteCarloRuns),
      best: toScenario("best", best, 1 / monteCarloRuns),
      worst: toScenario("worst", worst, 1 / monteCarloRuns),
      uncertainty,
    };
  }
}
