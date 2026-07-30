import { BiomeType, GovernmentType, WorldEventType } from "@planet/shared-types";
import { createRng, range, int, chance, pick } from "../rng.js";
import { clamp01, neighbors4 } from "../math.js";
import { generatePlanetGrid, generateDeposits, DEFAULT_GEN_CONFIG, type PlanetGenConfig } from "../planet/generate.js";
import { BIOME_ORDER } from "../planet/types.js";
import { habitability } from "../planet/biomes.js";
import { emitEvent } from "./events.js";
import { nextId, relationKey, speciesPopulation, type Civilization, type Species, type WorldState } from "./types.js";
import { civName, cityName, cultureName, languageName, religionName, speciesName, techName } from "./names.js";

export interface WorldCreateConfig extends Partial<PlanetGenConfig> {
  worldId: string;
  name: string;
  seed: number;
  yearsPerTick: number;
  plantSpecies: number;
  animalSpecies: number;
  civilizations: number;
}

export const DEFAULT_WORLD_CONFIG: Omit<WorldCreateConfig, "worldId" | "name" | "seed"> = {
  ...DEFAULT_GEN_CONFIG,
  yearsPerTick: 1,
  plantSpecies: 800,
  animalSpecies: 300,
  civilizations: 12,
};

const PLANT_BIOMES: Partial<Record<BiomeType, number>> = {
  [BiomeType.Rainforest]: 1,
  [BiomeType.TemperateForest]: 0.9,
  [BiomeType.Plains]: 0.75,
  [BiomeType.Swamp]: 0.7,
  [BiomeType.Steppe]: 0.6,
  [BiomeType.Coast]: 0.55,
  [BiomeType.Tundra]: 0.3,
  [BiomeType.Desert]: 0.2,
  [BiomeType.Volcanic]: 0.15,
};

const FAUNA_BIOMES: Partial<Record<BiomeType, number>> = {
  ...PLANT_BIOMES,
  [BiomeType.Ocean]: 0.8,
  [BiomeType.Mountains]: 0.35,
};

/**
 * Create a fully populated world: procedural terrain, resource deposits,
 * plant and animal species distributed by biome suitability, and founding
 * civilizations with cities. Every choice derives from the seed.
 */
export function createWorld(config: WorldCreateConfig): WorldState {
  const merged = { ...DEFAULT_WORLD_CONFIG, ...config };
  const genConfig = {
    width: merged.width ?? DEFAULT_GEN_CONFIG.width,
    height: merged.height ?? DEFAULT_GEN_CONFIG.height,
    oceanRatio: merged.oceanRatio ?? DEFAULT_GEN_CONFIG.oceanRatio,
    plateCount: merged.plateCount ?? DEFAULT_GEN_CONFIG.plateCount,
    depositCount: merged.depositCount ?? DEFAULT_GEN_CONFIG.depositCount,
  };
  const grid = generatePlanetGrid(merged.seed, genConfig);
  const rng = createRng(merged.seed ^ 0x9e37);

  const world: WorldState = {
    id: merged.worldId,
    name: merged.name,
    seed: merged.seed,
    tick: 0,
    yearsPerTick: merged.yearsPerTick ?? 1,
    rng,
    grid,
    species: [],
    civs: [],
    cities: [],
    deposits: generateDeposits(merged.seed, grid, genConfig.depositCount),
    techs: [],
    wars: [],
    alliances: [],
    diseases: [],
    migrations: [],
    tradeRoutes: [],
    laws: [],
    relations: {},
    events: [],
    nextIds: { species: 1, civ: 1, city: 1, tech: 1, war: 1, alliance: 1, disease: 1, migration: 1, trade: 1, law: 1, deposit: 1000 },
    contributionRoots: {},
    era: "genesis",
  };

  emitEvent(world, {
    type: WorldEventType.EraStarted,
    payload: { era: "genesis", name: merged.name },
    importance: 1,
  });

  seedFlora(world, merged.plantSpecies);
  seedFauna(world, merged.animalSpecies);
  seedCivilizations(world, merged.civilizations);
  return world;
}

function suitability(species: Species, world: WorldState, cell: number): number {
  const b = BIOME_ORDER[world.grid.biome[cell] ?? 0] ?? BiomeType.Ocean;
  const table = species.kind === "flora" ? PLANT_BIOMES : FAUNA_BIOMES;
  const biomeFit = table[b] ?? 0;
  if (biomeFit === 0) return 0;
  const temp = world.grid.temperature[cell] ?? 0;
  const tempFit = temp >= 0 ? 1 - (1 - species.heatResistance) * Math.abs(temp - 0.35) : 1 - (1 - species.coldResistance) * Math.abs(temp + 0.35);
  const moisture = world.grid.moisture[cell] ?? 0;
  const waterFit = 1 - Math.abs(moisture - species.waterNeed) * 0.8;
  return clamp01(biomeFit * clamp01(tempFit) * clamp01(waterFit) * 1.4);
}

function seedFlora(world: WorldState, count: number): void {
  for (let i = 0; i < count; i++) {
    const s: Species = {
      id: nextId(world, "species"),
      name: speciesName(world.rng, "flora"),
      kind: "flora",
      diet: "photosynthesis",
      size: range(world.rng, "flora", 0.02, 0.6),
      speed: 0,
      lifespan: range(world.rng, "flora", 0.2, 1),
      reproductionRate: range(world.rng, "flora", 0.2, 0.9),
      intelligence: 0,
      aggression: 0,
      adaptability: range(world.rng, "flora", 0.2, 0.8),
      mutationRate: range(world.rng, "flora", 0.001, 0.02),
      coldResistance: range(world.rng, "flora", 0.1, 0.9),
      heatResistance: range(world.rng, "flora", 0.1, 0.9),
      waterNeed: range(world.rng, "flora", 0.1, 0.9),
      pollutionAbsorption: range(world.rng, "flora", 0, 0.4),
      nightLuminosity: 0,
      toxicity: range(world.rng, "flora", 0, 0.3),
      cells: {},
      prey: [],
      predators: [],
      extinct: false,
      bornTick: 0,
    };
    // Find a suitable home: sample candidate cells, keep the best.
    let bestCell = -1;
    let bestFit = 0;
    for (let t = 0; t < 24; t++) {
      const cell = int(world.rng, "flora", 0, world.grid.cellCount - 1);
      const fit = suitability(s, world, cell);
      if (fit > bestFit) {
        bestFit = fit;
        bestCell = cell;
      }
    }
    if (bestCell < 0 || bestFit < 0.15) continue;
    s.cells[String(bestCell)] = range(world.rng, "flora", 20, 120);
    world.species.push(s);
  }
}

function seedFauna(world: WorldState, count: number): void {
  const flora = world.species.filter((s) => s.kind === "flora" && !s.extinct);
  for (let i = 0; i < count; i++) {
    const roll = world.rng.counters;
    void roll;
    const diet = chance(world.rng, "fauna", 0.62) ? "herbivore" : chance(world.rng, "fauna", 0.7) ? "carnivore" : "omnivore";
    const s: Species = {
      id: nextId(world, "species"),
      name: speciesName(world.rng, "fauna"),
      kind: "fauna",
      diet,
      size: range(world.rng, "fauna", 0.05, 0.95),
      speed: range(world.rng, "fauna", 0.1, 0.9),
      lifespan: range(world.rng, "fauna", 0.1, 0.9),
      reproductionRate: range(world.rng, "fauna", 0.15, 0.85),
      intelligence: range(world.rng, "fauna", 0.05, 0.8),
      aggression: diet === "carnivore" ? range(world.rng, "fauna", 0.4, 0.95) : range(world.rng, "fauna", 0.05, 0.6),
      adaptability: range(world.rng, "fauna", 0.2, 0.9),
      mutationRate: range(world.rng, "fauna", 0.002, 0.03),
      coldResistance: range(world.rng, "fauna", 0.1, 0.9),
      heatResistance: range(world.rng, "fauna", 0.1, 0.9),
      waterNeed: range(world.rng, "fauna", 0.2, 0.9),
      pollutionAbsorption: 0,
      nightLuminosity: 0,
      toxicity: 0,
      cells: {},
      prey: [],
      predators: [],
      extinct: false,
      bornTick: 0,
    };
    let bestCell = -1;
    let bestFit = 0;
    for (let t = 0; t < 24; t++) {
      const cell = int(world.rng, "fauna", 0, world.grid.cellCount - 1);
      const fit = suitability(s, world, cell);
      if (fit > bestFit) {
        bestFit = fit;
        bestCell = cell;
      }
    }
    if (bestCell < 0 || bestFit < 0.15) continue;
    s.cells[String(bestCell)] = range(world.rng, "fauna", 10, 60);

    // Food web: herbivores eat nearby flora; carnivores eat smaller fauna.
    if (diet === "herbivore" || diet === "omnivore") {
      const options = flora.filter((f) => f.cells[String(bestCell)] !== undefined);
      for (const f of options.slice(0, 2)) {
        s.prey.push(f.id);
        f.predators.push(s.id);
      }
    }
    if (diet !== "herbivore") {
      const options = world.species.filter(
        (o) => o.kind === "fauna" && o.diet === "herbivore" && o.size < s.size && o.cells[String(bestCell)] !== undefined,
      );
      for (const p of options.slice(0, 2)) {
        s.prey.push(p.id);
        p.predators.push(s.id);
      }
    }
    world.species.push(s);
  }
}

function seedCivilizations(world: WorldState, count: number): void {
  let founded = 0;
  let guard = count * 200;
  while (founded < count && guard-- > 0) {
    const cell = int(world.rng, "civs", 0, world.grid.cellCount - 1);
    const b = BIOME_ORDER[world.grid.biome[cell] ?? 0] ?? BiomeType.Ocean;
    if (habitability(b) < 0.5) continue;
    if (world.civs.some((c) => Math.abs(c.capitalCell - cell) < world.grid.width)) continue;

    const civ: Civilization = {
      id: nextId(world, "civ"),
      name: civName(world.rng, "civs"),
      population: range(world.rng, "civs", 800, 4000),
      cells: [cell],
      capitalCell: cell,
      techLevel: 0,
      government: pick(world.rng, "civs", [GovernmentType.Tribe, GovernmentType.Tribe, GovernmentType.Monarchy] as const),
      military: range(world.rng, "civs", 0.1, 0.4),
      economy: range(world.rng, "civs", 0.1, 0.4),
      stability: range(world.rng, "civs", 0.5, 0.9),
      happiness: range(world.rng, "civs", 0.4, 0.8),
      education: range(world.rng, "civs", 0.1, 0.4),
      health: range(world.rng, "civs", 0.3, 0.7),
      pollutionOutput: 0.02,
      foodSecurity: 0.7,
      aggression: range(world.rng, "civs", 0.1, 0.8),
      expansionism: range(world.rng, "civs", 0.3, 0.9),
      curiosity: range(world.rng, "civs", 0.2, 0.9),
      culture: cultureName(world.rng, "civs"),
      language: languageName(world.rng, "civs"),
      religion: religionName(world.rng, "civs"),
      stockpiles: { food: 500 },
      fallen: false,
      foundedTick: world.tick,
      memory: { grievances: [], pastAllies: [], notableEvents: [] },
    };
    world.civs.push(civ);
    for (const other of world.civs) {
      if (other.id !== civ.id) world.relations[relationKey(other.id, civ.id)] = 0;
    }
    emitEvent(world, {
      type: WorldEventType.CivilizationFounded,
      cellIndex: cell,
      civIds: [civ.id],
      payload: { name: civ.name, culture: civ.culture, language: civ.language },
      importance: 0.8,
    });

    const cityCount = int(world.rng, "civs", 2, 4);
    for (let c = 0; c < cityCount; c++) {
      const cityCell = c === 0 ? cell : pickNeighborLand(world, cell) ?? cell;
      world.cities.push({
        id: nextId(world, "city"),
        name: c === 0 ? civ.name + " Prime" : cityName(world.rng, "civs"),
        civId: civ.id,
        cell: cityCell,
        population: Math.round(civ.population / cityCount),
        health: civ.health,
        foundedTick: world.tick,
        fallen: false,
      });
      if (!civ.cells.includes(cityCell)) civ.cells.push(cityCell);
      emitEvent(world, {
        type: WorldEventType.CityCreated,
        cellIndex: cityCell,
        civIds: [civ.id],
        payload: { name: world.cities[world.cities.length - 1]?.name },
        importance: 0.5,
      });
    }
    civ.cells.sort((a, b) => a - b);
    founded++;
  }
}

function pickNeighborLand(world: WorldState, cell: number): number | null {
  const options = neighbors4(world.grid.width, world.grid.height, cell).filter(
    (n) => (world.grid.elevation[n] ?? 0) > world.grid.seaLevel,
  );
  if (options.length === 0) return null;
  return pick(world.rng, "civs", options);
}

/** Discoverable tech for a civilization at a given tier. */
export function ensureTech(world: WorldState, tier: number, civId: number): void {
  if (world.techs.some((t) => t.tier === tier)) return;
  const tech = { id: nextId(world, "tech"), name: techName(tier), tier, discoveredBy: civId, discoveredTick: world.tick };
  world.techs.push(tech);
  emitEvent(world, {
    type: WorldEventType.TechnologyDiscovered,
    civIds: [civId],
    payload: { name: tech.name, tier },
    importance: Math.min(0.4 + tier * 0.02, 0.9),
  });
}

export { speciesPopulation };
