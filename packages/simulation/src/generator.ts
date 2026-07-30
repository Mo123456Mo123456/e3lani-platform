import type { BiomeType, PlantTraits, ResourceKind, SpeciesTraits, WorldEvent } from "@kawkab/shared-types";
import { SIMULATION_DEFAULTS } from "@kawkab/config";
import { PlanetGrid } from "./grid.js";
import { SimplexNoise2D, fbm, ridged } from "./noise.js";
import { RngStream, deterministicId, fnv1a, hashCombine } from "./rng.js";
import type {
  CellState,
  CivStateInternal,
  EngineConfig,
  PlantStateInternal,
  SpeciesStateInternal,
  TechNode,
  WorldState,
} from "./types.js";

const LAND_BIOMES: BiomeType[] = ["plains", "rainforest", "temperate_forest", "desert", "mountains", "tundra", "swamp", "steppe", "volcanic"];

const CIV_NAMES = [
  "أوروك", "نمرود", "سيدون", "تadmor", "أكد", "ماري", "إيبلا", "دلمون",
  "مجان", "سبأ", "حِمْير", "نبط", "تدمر", "أوبار", "معد", "ثمود",
];
const CIV_SUFFIX = ["يا", "ية", "ون", "ا", ""];
const SYL_A = ["ka", "ra", "mu", "sha", "ti", "or", "bel", "zar", "nu", "il", "qa", "sen", "dro", "vel", "ash", "om"];
const SYL_B = ["ri", "os", "an", "eth", "ur", "ia", "on", "ak", "is", "ar", "un", "ol"];
const SPECIES_PREFIX = ["Astra", "Bronto", "Cyra", "Duna", "Ery", "Falo", "Glim", "Heso", "Ixo", "Jawa", "Kryo", "Luma", "Mono", "Nym", "Ost", "Pyro", "Qua", "Rho", "Syla", "Ther", "Ulv", "Vex", "Wadi", "Xan", "Yara", "Zeph"];
const SPECIES_SUFFIX = ["dus", "rax", "moth", "pede", "horn", "fin", "wing", "tail", "fang", "shell", "mane", "claw", "beak", "scale", "fur", "thorn"];
const PLANT_PREFIX = ["Lumi", "Sola", "Aqua", "Terra", "Venti", "Pyra", "Cryo", "Electra", "Magna", "Umbra", "Flora", "Sylva", "Herba", "Cortex", "Radix", "Spina"];
const PLANT_SUFFIX = ["flora", "arbor", "vitae", "lux", "moss", "reed", "bloom", "fern", "vine", "root", "leaf", "thorn", "sap", "cone", "kelp", "grass"];

function genName(rng: RngStream, partsA: readonly string[], partsB: readonly string[]): string {
  return `${rng.pick(partsA)}${rng.pick(partsB)}${rng.chance(0.4) ? rng.pick(partsB) : ""}`;
}

/** The 50-node deterministic technology tree. */
export function buildTechTree(): TechNode[] {
  const t = (
    key: string, name: string, era: TechNode["era"], prereqKeys: string[], cost: number,
    effects: TechNode["effects"],
  ): TechNode => ({ key, name, era, prereqKeys, cost, effects });
  return [
    t("fire", "Fire", "stone", [], 0.05, { science: 0.05 }),
    t("stone_tools", "Stone Tools", "stone", [], 0.05, { military: 0.02 }),
    t("agriculture", "Agriculture", "stone", ["fire"], 0.15, { farming: 0.3 }),
    t("animal_husbandry", "Animal Husbandry", "stone", ["agriculture"], 0.1, { farming: 0.15 }),
    t("pottery", "Pottery", "stone", ["fire"], 0.05, {}),
    t("weaving", "Weaving", "stone", [], 0.05, {}),
    t("mining", "Mining", "bronze", ["stone_tools"], 0.1, { industry: 0.1 }),
    t("bronze_working", "Bronze Working", "bronze", ["mining"], 0.15, { military: 0.1 }),
    t("writing", "Writing", "bronze", ["agriculture"], 0.15, { science: 0.15 }),
    t("wheel", "The Wheel", "bronze", ["bronze_working"], 0.1, { logistics: 0.15 }),
    t("sailing", "Sailing", "bronze", ["weaving"], 0.15, { seafaring: 0.3 }),
    t("irrigation", "Irrigation", "bronze", ["agriculture"], 0.1, { farming: 0.15 }),
    t("iron_working", "Iron Working", "iron", ["bronze_working"], 0.15, { military: 0.15 }),
    t("currency", "Currency", "iron", ["writing"], 0.1, { industry: 0.1 }),
    t("mathematics", "Mathematics", "iron", ["writing"], 0.15, { science: 0.1 }),
    t("architecture", "Architecture", "iron", ["bronze_working"], 0.15, { industry: 0.1 }),
    t("herbal_medicine", "Herbal Medicine", "iron", ["agriculture"], 0.1, { medicine: 0.2 }),
    t("philosophy", "Philosophy", "iron", ["writing"], 0.1, { science: 0.1 }),
    t("engineering", "Engineering", "classical", ["mathematics", "architecture"], 0.2, { industry: 0.15 }),
    t("navigation", "Navigation", "classical", ["sailing", "mathematics"], 0.15, { seafaring: 0.2 }),
    t("steel", "Steel", "classical", ["iron_working"], 0.15, { military: 0.1 }),
    t("universities", "Universities", "classical", ["philosophy", "writing"], 0.2, { science: 0.15 }),
    t("aqueducts", "Aqueducts", "classical", ["engineering"], 0.15, { medicine: 0.1 }),
    t("paper", "Paper", "classical", ["writing"], 0.1, { science: 0.05 }),
    t("gunpowder", "Gunpowder", "medieval", ["steel"], 0.2, { military: 0.2 }),
    t("printing_press", "Printing Press", "medieval", ["paper"], 0.15, { science: 0.15 }),
    t("compass", "Compass", "medieval", ["navigation"], 0.1, { seafaring: 0.15 }),
    t("banking", "Banking", "medieval", ["currency"], 0.15, { industry: 0.1 }),
    t("optics", "Optics", "medieval", ["universities"], 0.15, { science: 0.1 }),
    t("castle_engineering", "Castle Engineering", "medieval", ["architecture"], 0.15, { military: 0.1 }),
    t("steam_engine", "Steam Engine", "industrial", ["engineering", "steel"], 0.25, { industry: 0.25 }),
    t("railroad", "Railroad", "industrial", ["steam_engine"], 0.2, { logistics: 0.25 }),
    t("electricity", "Electricity", "industrial", ["steam_engine", "optics"], 0.25, { energy: 0.25 }),
    t("germ_theory", "Germ Theory", "industrial", ["herbal_medicine", "universities"], 0.2, { medicine: 0.25 }),
    t("telegraph", "Telegraph", "industrial", ["electricity"], 0.15, { science: 0.1 }),
    t("oil_refining", "Oil Refining", "industrial", ["steam_engine"], 0.2, { energy: 0.15 }),
    t("assembly_line", "Assembly Line", "industrial", ["railroad"], 0.2, { industry: 0.2 }),
    t("flight", "Flight", "atomic", ["assembly_line"], 0.2, { logistics: 0.2 }),
    t("antibiotics", "Antibiotics", "atomic", ["germ_theory"], 0.2, { medicine: 0.25 }),
    t("electronics", "Electronics", "atomic", ["telegraph"], 0.2, { science: 0.15 }),
    t("nuclear_power", "Nuclear Power", "atomic", ["oil_refining", "electronics"], 0.25, { energy: 0.2 }),
    t("rocketry", "Rocketry", "atomic", ["flight", "gunpowder"], 0.2, { military: 0.15 }),
    t("computers", "Computers", "atomic", ["electronics"], 0.25, { science: 0.2 }),
    t("internet", "Internet", "information", ["computers"], 0.2, { science: 0.2 }),
    t("renewable_energy", "Renewable Energy", "information", ["electricity", "computers"], 0.2, { energy: 0.2 }),
    t("genetic_engineering", "Genetic Engineering", "information", ["antibiotics", "computers"], 0.2, { medicine: 0.2 }),
    t("ai_systems", "AI Systems", "information", ["internet"], 0.25, { science: 0.2 }),
    t("spaceflight", "Spaceflight", "information", ["rocketry", "computers"], 0.2, { logistics: 0.15 }),
    t("fusion_power", "Fusion Power", "fusion", ["nuclear_power", "ai_systems"], 0.3, { energy: 0.3 }),
    t("terraforming", "Terraforming", "fusion", ["fusion_power", "genetic_engineering"], 0.3, { science: 0.3 }),
  ];
}

interface Plate {
  cx: number;
  cy: number;
  continental: boolean;
  driftX: number;
  driftY: number;
}

export interface GeneratedWorld {
  state: WorldState;
  genesisEvents: WorldEvent[];
}

export function generateWorld(seed: string, config?: Partial<EngineConfig>): GeneratedWorld {
  const cfg: EngineConfig = {
    gridWidth: config?.gridWidth ?? SIMULATION_DEFAULTS.gridWidth,
    gridHeight: config?.gridHeight ?? SIMULATION_DEFAULTS.gridHeight,
    seaLevel: config?.seaLevel ?? SIMULATION_DEFAULTS.seaLevel,
    snapshotInterval: config?.snapshotInterval ?? SIMULATION_DEFAULTS.snapshotInterval,
    yearsPerTick: config?.yearsPerTick ?? 1,
  };
  const grid = new PlanetGrid(cfg.gridWidth, cfg.gridHeight);
  const rng = new RngStream(seed, "genesis");
  const elevNoise = new SimplexNoise2D(hashCombine(fnv1a(seed), 1));
  const moistNoise = new SimplexNoise2D(hashCombine(fnv1a(seed), 2));
  const tempNoise = new SimplexNoise2D(hashCombine(fnv1a(seed), 3));

  // ---- tectonic plates -------------------------------------------------
  const plateCount = 8 + rng.int(6);
  const plates: Plate[] = [];
  for (let p = 0; p < plateCount; p++) {
    plates.push({
      cx: rng.range(0, grid.width),
      cy: rng.range(0, grid.height),
      continental: rng.chance(0.45),
      driftX: rng.spread(),
      driftY: rng.spread(),
    });
  }
  const plateOf = new Array<number>(grid.size);
  for (let i = 0; i < grid.size; i++) {
    const x = grid.x(i);
    const y = grid.y(i);
    let best = Infinity;
    let bestP = 0;
    for (let p = 0; p < plateCount; p++) {
      const pl = plates[p]!;
      let dx = Math.abs(x - pl.cx);
      dx = Math.min(dx, grid.width - dx);
      const d = dx * dx + (y - pl.cy) * (y - pl.cy) * 2.2;
      if (d < best) {
        best = d;
        bestP = p;
      }
    }
    plateOf[i] = bestP;
  }

  // ---- elevation --------------------------------------------------------
  const cells: CellState[] = new Array(grid.size);
  const boundaryPairs = new Map<string, boolean>(); // "a<b" -> convergent
  const pairRng = (a: number, b: number) => new RngStream(hashCombine(fnv1a(seed), 1000 + a * 64 + b), "plates");

  for (let i = 0; i < grid.size; i++) {
    const x = grid.x(i);
    const y = grid.y(i);
    const plate = plates[plateOf[i]!]!;
    const nx = (x / grid.width) * 4;
    const ny = (y / grid.height) * 4;
    let e = fbm(elevNoise, nx, ny, 5) * 0.6 + ridged(elevNoise, nx * 1.7, ny * 1.7, 4) * 0.4 - 0.18;
    e += plate.continental ? 0.16 : -0.18;

    // plate boundaries: convergent → mountains/trenches + volcanism
    let boundary = 0;
    let volcanic = false;
    for (const nb of grid.neighbors(i)) {
      const other = plateOf[nb]!;
      if (other === plateOf[i]) continue;
      const a = Math.min(plateOf[i]!, other);
      const b = Math.max(plateOf[i]!, other);
      const key = `${a}<${b}`;
      if (!boundaryPairs.has(key)) {
        const pa = plates[a]!;
        const pb = plates[b]!;
        const approaching = (pa.driftX - pb.driftX) * (pb.cx - pa.cx) + (pa.driftY - pb.driftY) * (pb.cy - pa.cy) < 0;
        boundaryPairs.set(key, pairRng(a, b).chance(0.5) || approaching);
      }
      if (boundaryPairs.get(key)) {
        boundary = 1;
        if (pairRng(a, b).chance(0.35)) volcanic = true;
      }
    }
    if (boundary) e += 0.28 * Math.abs(fbm(elevNoise, nx * 3, ny * 3, 3));

    cells[i] = {
      index: i,
      elevation: Math.max(-1, Math.min(1, e)),
      isOcean: e <= cfg.seaLevel,
      isVolcanic: volcanic,
      hasIce: false,
      temperature: 0,
      moisture: 0,
      fertility: 0,
      pollution: 0,
      biome: "ocean",
      river: 0,
      flowTo: -1,
      plateId: plateOf[i]!,
      ownerCivId: null,
      cityId: null,
      population: 0,
      plantCoverage: 0,
      resources: [],
      storm: 0,
      droughtTicks: 0,
      fire: 0,
    };
  }

  // ---- climate: temperature + moisture ----------------------------------
  for (const c of cells) {
    const lat = Math.abs(grid.lat(c.index));
    const tNoise = fbm(tempNoise, c.index % grid.width / 20, Math.floor(c.index / grid.width) / 20, 3) * 3.5;
    let temp = 33 - lat * 0.62 - Math.max(0, c.elevation) * 30 + tNoise;
    if (c.isOcean) temp = Math.max(-2, temp * 0.85 + 4); // oceans moderate
    c.temperature = temp;
    c.hasIce = temp < -8 || lat > 80;

    const band = lat < 12 ? 0.75 : lat < 28 ? 0.32 : lat < 45 ? 0.6 : lat < 60 ? 0.5 : 0.35;
    let m = band + fbm(moistNoise, (c.index % grid.width) / 14, Math.floor(c.index / grid.height) / 14 + 7, 4) * 0.35;
    // coastal boost
    if (!c.isOcean) {
      for (const nb of grid.neighbors(c.index)) if (cells[nb]!.isOcean) { m += 0.18; break; }
      // rain shadow: walk upwind
      const latAbs = lat;
      const windDir = latAbs < 30 ? 1 : latAbs < 60 ? -1 : 1; // trades blow from east
      let cx = grid.x(c.index);
      const cy = grid.y(c.index);
      for (let step = 0; step < 4; step++) {
        cx += windDir;
        const up = cells[grid.index(cx, cy)]!;
        if (!up.isOcean && up.elevation > c.elevation + 0.12) {
          m -= 0.12 * (4 - step) * 0.4;
          break;
        }
      }
    }
    c.moisture = Math.max(0, Math.min(1, c.isOcean ? 1 : m));
  }

  // ---- rivers: downhill flow accumulation --------------------------------
  const landCells = cells.filter((c) => !c.isOcean).sort((a, b) => b.elevation - a.elevation);
  for (const c of landCells) {
    const nbs = grid.neighbors(c.index);
    let lowest = -1;
    let lowestE = c.elevation + (fnv1a(`${seed}:tie:${c.index}`) % 1000) / 1e7;
    for (const nb of nbs) {
      const n = cells[nb]!;
      const e = n.elevation + (fnv1a(`${seed}:tie:${nb}`) % 1000) / 1e7;
      if (e < lowestE) {
        lowestE = e;
        lowest = nb;
      }
    }
    c.flowTo = lowest;
  }
  for (const c of landCells) {
    let accum = 1;
    let cur = c.index;
    // flow accumulation: push upstream credit downstream (bounded walk)
    let guard = 0;
    while (cur !== -1 && guard++ < 64) {
      const down = cells[cur]!.flowTo;
      if (down === -1 || cells[down]!.isOcean) break;
      accum += 1;
      cur = down;
    }
    c.river = Math.min(1, Math.log2(1 + accum) / 9);
  }

  // ---- biome classification ----------------------------------------------
  for (const c of cells) {
    if (c.isOcean) {
      c.biome = "ocean";
      c.fertility = 0.3;
    } else if (c.hasIce && c.moisture < 0.3) {
      c.biome = "ice";
      c.fertility = 0.02;
    } else if (c.temperature < -2) {
      c.biome = "tundra";
      c.fertility = 0.15;
    } else if (c.elevation > 0.5) {
      c.biome = "mountains";
      c.fertility = 0.2;
    } else if (c.isVolcanic && c.elevation > 0.25) {
      c.biome = "volcanic";
      c.fertility = 0.35;
    } else if (c.moisture < 0.18 && c.temperature > 16) {
      c.biome = "desert";
      c.fertility = 0.08;
    } else if (c.moisture < 0.38) {
      c.biome = "steppe";
      c.fertility = 0.42;
    } else if (c.moisture > 0.8 && c.elevation < 0.12 && c.temperature > 10) {
      c.biome = "swamp";
      c.fertility = 0.55;
    } else if (c.temperature > 21 && c.moisture > 0.62) {
      c.biome = "rainforest";
      c.fertility = 0.7;
    } else if (c.moisture > 0.45 && c.temperature > 5) {
      c.biome = "temperate_forest";
      c.fertility = 0.68;
    } else {
      c.biome = "plains";
      c.fertility = 0.6;
    }
    // coast: land next to ocean stays its biome but beaches matter for cities
    c.fertility = Math.max(0, Math.min(1, c.fertility + c.river * 0.2 + (c.isVolcanic ? 0.1 : 0)));
    c.plantCoverage = LAND_BIOMES.includes(c.biome) ? c.fertility * c.moisture : 0;
  }

  // ---- resources -----------------------------------------------------------
  const resRng = rng.fork("resources");
  const place = (c: CellState, kind: ResourceKind, chance: number, amount: [number, number], renewal = 0) => {
    if (resRng.chance(chance)) {
      c.resources.push({ kind, amount: resRng.range(amount[0], amount[1]), renewalRate: renewal, discovered: false });
    }
  };
  for (const c of cells) {
    switch (c.biome) {
      case "mountains":
        place(c, "iron", 0.3, [0.3, 0.9]);
        place(c, "copper", 0.25, [0.3, 0.8]);
        place(c, "gold", 0.08, [0.2, 0.6]);
        place(c, "stone", 0.5, [0.4, 1]);
        break;
      case "desert":
        place(c, "oil", 0.12, [0.3, 0.9]);
        place(c, "solar", 0.6, [0.5, 1], 1);
        break;
      case "plains":
        place(c, "grain", 0.55, [0.4, 1], 0.9);
        break;
      case "steppe":
        place(c, "grain", 0.3, [0.3, 0.8], 0.8);
        place(c, "uranium", 0.02, [0.2, 0.5]);
        break;
      case "rainforest":
      case "temperate_forest":
        place(c, "timber", 0.55, [0.4, 1], 0.7);
        place(c, "spice", 0.1, [0.2, 0.7], 0.6);
        break;
      case "tundra":
        place(c, "oil", 0.08, [0.3, 0.8]);
        place(c, "uranium", 0.03, [0.3, 0.7]);
        break;
      case "volcanic":
        place(c, "crystal", 0.15, [0.2, 0.7]);
        place(c, "geothermal", 0.4, [0.5, 1], 1);
        break;
      case "swamp":
        place(c, "coal", 0.2, [0.3, 0.8]);
        break;
      case "ocean": {
        const coastal = grid.neighbors(c.index).some((n) => !cells[n]!.isOcean);
        if (coastal) place(c, "fish", 0.5, [0.4, 1], 0.85);
        break;
      }
      default:
        break;
    }
    if (!c.isOcean && c.river > 0.05) place(c, "fresh_water", 0.9, [0.5, 1], 1);
    if (!c.isOcean && c.moisture > 0.5 && (c.biome === "plains" || c.biome === "steppe")) place(c, "wind", 0.3, [0.4, 0.9], 1);
  }

  // ---- flora catalogue ------------------------------------------------------
  const floraRng = rng.fork("flora");
  const biomeHistogram = new Map<BiomeType, number>();
  for (const c of cells) biomeHistogram.set(c.biome, (biomeHistogram.get(c.biome) ?? 0) + 1);
  const plants = new Map<string, PlantStateInternal>();
  const plantBiomePool: BiomeType[] = ["rainforest", "temperate_forest", "plains", "steppe", "desert", "swamp", "tundra", "volcanic", "mountains"];
  for (let i = 0; i < SIMULATION_DEFAULTS.initialPlants; i++) {
    const traits: PlantTraits = {
      size: floraRng.next(),
      growthRate: floraRng.next(),
      waterNeed: floraRng.next(),
      heatResistance: floraRng.next(),
      coldResistance: floraRng.next(),
      pollutionAbsorption: floraRng.next() * 0.4,
      energyStorage: floraRng.next() * 0.5,
      luminosity: floraRng.chance(0.05) ? floraRng.range(0.3, 0.9) : 0,
      toxicity: floraRng.chance(0.15) ? floraRng.next() * 0.6 : 0,
      spreadRate: floraRng.next(),
    };
    const biome = floraRng.pick(plantBiomePool);
    const biomes: BiomeType[] = [biome];
    if (floraRng.chance(0.3)) biomes.push(floraRng.pick(plantBiomePool));
    const coverage = Math.floor((biomeHistogram.get(biome) ?? 0) * floraRng.range(0.1, 0.6));
    const id = deterministicId("pl", seed, "flora", i);
    plants.set(id, {
      id,
      name: `${genName(floraRng, PLANT_PREFIX, PLANT_SUFFIX)}`,
      originContributionId: null,
      biomes,
      traits,
      createdTick: -4500,
      extinct: false,
      cells: new Set<number>(),
      estimatedCoverage: coverage,
    });
  }

  // ---- fauna + food web -------------------------------------------------------
  const faunaRng = rng.fork("fauna");
  const species = new Map<string, SpeciesStateInternal>();
  const speciesPops = new Map<string, Map<number, number>>();
  const sizeClasses = [
    { size: [0.02, 0.1], diet: "plants" as const, repro: [0.7, 1] },
    { size: [0.08, 0.25], diet: "plants" as const, repro: [0.5, 0.9] },
    { size: [0.2, 0.5], diet: "omnivore" as const, repro: [0.3, 0.6] },
    { size: [0.45, 0.75], diet: "meat" as const, repro: [0.2, 0.4] },
    { size: [0.7, 0.98], diet: "meat" as const, repro: [0.1, 0.25] },
  ];
  const speciesIds: string[] = [];
  for (let i = 0; i < SIMULATION_DEFAULTS.initialSpecies; i++) {
    const sc = faunaRng.pick(sizeClasses);
    const aquatic = faunaRng.chance(0.25);
    const traits: SpeciesTraits = {
      size: faunaRng.range(sc.size[0], sc.size[1]),
      lifespan: faunaRng.range(0.1, 0.9),
      reproductionRate: faunaRng.range(sc.repro[0], sc.repro[1]),
      heatResistance: faunaRng.next(),
      coldResistance: faunaRng.next(),
      waterNeed: aquatic ? 1 : faunaRng.next(),
      intelligence: faunaRng.next() * 0.7,
      aggression: sc.diet === "meat" ? faunaRng.range(0.5, 1) : faunaRng.next() * 0.5,
      mobility: faunaRng.next(),
      adaptability: faunaRng.next(),
      mutationRate: 0.05 + faunaRng.next() * 0.2,
    };
    const homeBiome: BiomeType = aquatic ? "ocean" : faunaRng.pick(LAND_BIOMES.filter((b) => b !== "volcanic"));
    const id = deterministicId("sp", seed, "fauna", i);
    speciesIds.push(id);
    species.set(id, {
      id,
      name: `${genName(faunaRng, SPECIES_PREFIX, SPECIES_SUFFIX)}`,
      parentId: null,
      originContributionId: null,
      homeBiome,
      traits,
      diet: aquatic && sc.diet === "meat" ? "meat" : sc.diet,
      preyIds: [],
      createdTick: -6000,
      extinct: false,
      extinctTick: null,
    });
  }
  // food web: carnivores/omnivores prey on smaller species
  for (const sp of species.values()) {
    if (sp.diet === "plants") continue;
    const smaller = speciesIds.filter((id) => {
      const other = species.get(id)!;
      return other.id !== sp.id && other.traits.size < sp.traits.size * 0.8 && (sp.homeBiome === "ocean") === (other.homeBiome === "ocean");
    });
    faunaRng.shuffle(smaller);
    sp.preyIds = smaller.slice(0, 1 + faunaRng.int(3));
  }
  // initial populations: origin in home biome, short expansion walk
  const byBiome = new Map<BiomeType, number[]>();
  for (const c of cells) {
    const arr = byBiome.get(c.biome) ?? [];
    arr.push(c.index);
    byBiome.set(c.biome, arr);
  }
  for (const sp of species.values()) {
    const pool = byBiome.get(sp.homeBiome);
    if (!pool || pool.length === 0) continue;
    const pops = new Map<number, number>();
    const origin = pool[faunaRng.int(pool.length)]!;
    let frontier = [origin];
    const base = 500 + faunaRng.int(5000);
    pops.set(origin, base);
    const steps = 3 + faunaRng.int(6);
    for (let s = 0; s < steps; s++) {
      const next: number[] = [];
      for (const f of frontier) {
        for (const nb of grid.neighbors(f)) {
          const cell = cells[nb]!;
          if (cell.biome !== sp.homeBiome || pops.has(nb) || !faunaRng.chance(0.6)) continue;
          pops.set(nb, base * faunaRng.range(0.3, 0.8));
          next.push(nb);
        }
      }
      frontier = next;
    }
    speciesPops.set(sp.id, pops);
  }

  // ---- civilizations ------------------------------------------------------------
  const civRng = rng.fork("civs");
  const candidates = cells
    .filter((c) => !c.isOcean && c.fertility > 0.5 && Math.abs(grid.lat(c.index)) < 60)
    .map((c) => ({ c, score: c.fertility + c.river * 0.4 + (grid.neighbors(c.index).some((n) => cells[n]!.isOcean) ? 0.25 : 0) + civRng.range(0, 0.15) }))
    .sort((a, b) => b.score - a.score);
  const civs = new Map<string, CivStateInternal>();
  const cities = new Map<string, import("./types.js").CityStateInternal>();
  const chosen: number[] = [];
  const civCount = Math.min(SIMULATION_DEFAULTS.initialCivilizations, candidates.length);
  const namePool = civRng.shuffle([...CIV_NAMES]);
  for (let i = 0; i < civCount; i++) {
    const pick = candidates.find(({ c }) => chosen.every((o) => grid.distance(o, c.index) >= 7));
    if (!pick) break;
    chosen.push(pick.c.index);
    const id = deterministicId("cv", seed, "civ", i);
    const rawName = namePool[i % namePool.length]!;
    const name = i < namePool.length ? rawName : `${rawName}${civRng.pick(CIV_SUFFIX)}`;
    const hue = Math.floor(civRng.range(30, 52)); // golden band
    const color = `hsl(${hue + i * 22}, 70%, ${45 + (i % 4) * 8}%)`;
    const cityId = deterministicId("ct", seed, "capital", i);
    const civ: CivStateInternal = {
      id,
      name,
      color,
      foundedTick: 0,
      population: 800 + civRng.int(4200),
      territory: new Set<number>(),
      cityIds: [cityId],
      capitalCityId: cityId,
      techKeys: new Set(["fire", "stone_tools", "weaving"]),
      techEra: "stone",
      government: civRng.pick(["tribe", "chiefdom", "chiefdom", "monarchy"] as const),
      military: civRng.range(0.2, 0.5),
      stability: civRng.range(0.5, 0.9),
      happiness: civRng.range(0.4, 0.8),
      health: civRng.range(0.4, 0.8),
      education: civRng.range(0.05, 0.2),
      economy: civRng.range(0.2, 0.5),
      foodSecurity: civRng.range(0.5, 0.9),
      aggression: civRng.next(),
      innovation: civRng.next(),
      pollutionPerCapita: 0.02,
      stockpiles: { grain: civRng.range(0.4, 0.9) },
      relations: {},
      memory: [],
      researchProgress: 0,
      actionCooldowns: {},
      extinct: false,
      cultureName: `${name} culture`,
      languageName: `${name}i`,
      languageFamily: `family-${i % 4}`,
    };
    // claim initial territory: BFS over decent land
    const queue: Array<[number, number]> = [[pick.c.index, 0]];
    const seen = new Set<number>([pick.c.index]);
    while (queue.length > 0) {
      const [cur, d] = queue.shift()!;
      const cell = cells[cur]!;
      if (!cell.isOcean && cell.fertility > 0.25 && d <= 2) {
        civ.territory.add(cur);
        cell.ownerCivId = id;
        cell.population = Math.floor(civ.population / 8);
        for (const nb of grid.neighbors(cur)) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push([nb, d + 1]);
          }
        }
      }
    }
    cities.set(cityId, {
      id: cityId,
      name: `${name} City`,
      civId: id,
      cellIndex: pick.c.index,
      population: civ.population,
      foundedTick: 0,
      isCapital: true,
      health: 0.7,
      prosperity: 0.5,
    });
    pick.c.cityId = cityId;
    civs.set(id, civ);
  }
  // initial relations
  for (const a of civs.values()) {
    for (const b of civs.values()) {
      if (a.id === b.id) continue;
      a.relations[b.id] = civRng.range(-0.2, 0.4);
    }
  }

  const state: WorldState = {
    seed,
    tick: 0,
    simYear: 0,
    gridWidth: cfg.gridWidth,
    gridHeight: cfg.gridHeight,
    cells,
    species,
    speciesPops,
    plants,
    civs,
    cities,
    techTree: buildTechTree(),
    tradeRoutes: new Map(),
    alliances: new Map(),
    wars: new Map(),
    diseases: new Map(),
    migrations: new Map(),
    laws: { warProbabilityMultiplier: 1, climateSensitivityMultiplier: 1 },
    phenomena: [],
    globalTempAnomaly: 0,
    volcanicAerosol: 0,
    pendingContributions: [],
  };

  // ---- genesis history (negative ticks on the timeline) ------------------------
  const genesisEvents: WorldEvent[] = [];
  const hist = (
    tick: number, simYear: number, type: WorldEvent["type"], title: string, summary: string,
    magnitude: number, causeIds: string[], data: WorldEvent["data"] = {},
  ): WorldEvent => {
    const ev: WorldEvent = {
      id: deterministicId("ev", seed, tick, type),
      tick, simYear, type, title, summary,
      region: null, actorIds: [], causeIds, contributionId: null,
      confidence: 1, magnitude, data,
    };
    genesisEvents.push(ev);
    return ev;
  };
  const e1 = hist(-10000, -10000, "PLANET_FORMED", "Planet formed", "The protoplanet cooled and a solid crust emerged.", 1, []);
  const e2 = hist(-8200, -8200, "OCEANS_FORMED", "Oceans formed", "Cometary ice and volcanic vapour condensed into the first oceans.", 0.95, [e1.id], { oceanFraction: cells.filter((c) => c.isOcean).length / cells.length });
  const e3 = hist(-6300, -6300, "LIFE_EMERGED", "Life emerged", "Self-replicating chemistry appeared in shallow warm seas.", 0.98, [e2.id]);
  const e4 = hist(-4600, -4600, "PLANTS_SPREAD", "Plants spread", `${plants.size} plant lineages colonised the continents.`, 0.8, [e3.id], { plantCount: plants.size });
  for (const civ of civs.values()) {
    const city = cities.get(civ.cityIds[0]!)!;
    const ev = hist(0, 0, "CIVILIZATION_FOUNDED", `${civ.name} founded`, `The people of ${civ.name} settled ${city.name}.`, 0.6, [e4.id], { civId: civ.id });
    ev.region = { lat: grid.lat(city.cellIndex), lon: grid.lon(city.cellIndex), index: city.cellIndex };
    ev.actorIds = [civ.id, city.id];
    const ce = hist(0, 0, "CITY_CREATED", `${city.name} built`, `${city.name} became the first city of ${civ.name}.`, 0.4, [ev.id], { cityId: city.id });
    ce.region = ev.region;
    ce.actorIds = [city.id];
  }

  return { state, genesisEvents };
}
