import type {
  BiomeType,
  CivilizationState,
  RegionCell,
  SpeciesState,
  WorldState,
} from "@living-planet/shared-types";
import { createSeededRandom, deterministicId, fractalNoise } from "./random.js";

const REGION_NAMES_AR = [
  "سهول النور",
  "غابات أزورا",
  "ساحل المرجان",
  "جبال السحاب",
  "صحراء الياقوت",
  "دلتا الحياة",
  "هضبة الرياح",
  "جزر الشفق",
  "وادي الزمرد",
  "تندرا القمر",
  "حوض الأمطار",
  "أراضي الفجر",
];

const REGION_NAMES_EN = [
  "Lumen Plains",
  "Azura Forest",
  "Coral Coast",
  "Cloud Mountains",
  "Ruby Desert",
  "Living Delta",
  "Wind Plateau",
  "Aurora Isles",
  "Emerald Valley",
  "Moon Tundra",
  "Rain Basin",
  "Dawn Lands",
];

const CIVILIZATIONS = [
  ["اتحاد السهول", "Plains Union"],
  ["ممالك أزورا", "Azura Kingdoms"],
  ["جمهورية المرجان", "Coral Republic"],
  ["حماة القمم", "Peak Wardens"],
  ["قبائل الشفق", "Aurora Tribes"],
  ["رابطة الزمرد", "Emerald League"],
  ["مدن النهر", "River Cities"],
  ["أمة الرياح", "Wind Nation"],
  ["حلف الجنوب", "Southern Accord"],
  ["إمارات الرمال", "Sand Emirates"],
  ["مجلس الجزر", "Isles Council"],
  ["مستعمرة الفجر", "Dawn Colony"],
] as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function classifyBiome(
  elevation: number,
  temperature: number,
  moisture: number,
  volcanic: number,
): BiomeType {
  if (elevation < 0.42) return "ocean";
  if (elevation < 0.47) return "coast";
  if (temperature < 0.12) return "ice";
  if (volcanic > 0.83 && elevation > 0.67) return "volcanic";
  if (elevation > 0.76) return "mountain";
  if (temperature < 0.28) return "tundra";
  if (moisture < 0.18 && temperature > 0.55) return "desert";
  if (moisture < 0.32) return "steppe";
  if (moisture > 0.82 && elevation < 0.57) return "wetland";
  if (moisture > 0.69 && temperature > 0.62) return "rainforest";
  if (moisture > 0.5) return "temperate_forest";
  return "plains";
}

function createRegions(seed: string, count: number): RegionCell[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * index;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const latitude = Math.asin(y) * (180 / Math.PI);
    const longitude = Math.atan2(z, x) * (180 / Math.PI);
    const continental = fractalNoise(seed, longitude / 80 + 2.3, latitude / 80 + 1.7, 6);
    const ridges = Math.abs(fractalNoise(`${seed}:ridges`, longitude / 28, latitude / 28, 4));
    const elevation = clamp(0.49 + continental * 0.42 + ridges * 0.14);
    const latitudeHeat = 1 - Math.abs(latitude) / 90;
    const temperature = clamp(latitudeHeat * 0.9 - Math.max(0, elevation - 0.55) * 0.8);
    const windMoisture = fractalNoise(`${seed}:moisture`, longitude / 55, latitude / 55, 5);
    const oceanic = elevation < 0.47 ? 0.45 : Math.max(0, 0.56 - elevation) * 1.4;
    const moisture = clamp(0.45 + windMoisture * 0.38 + oceanic - ridges * 0.12);
    const volcanic = clamp(
      Math.abs(fractalNoise(`${seed}:plates`, longitude / 22, latitude / 22, 3)),
    );
    const biome = classifyBiome(elevation, temperature, moisture, volcanic);
    const isHabitable = biome !== "ocean" && biome !== "ice" && biome !== "volcanic";
    const fertility = isHabitable
      ? clamp(moisture * 0.56 + temperature * 0.3 + (1 - Math.abs(elevation - 0.54)) * 0.14)
      : 0.03;
    const water = clamp(moisture * 0.72 + (biome === "coast" ? 0.25 : 0));
    const carryingCapacity = Math.round(
      isHabitable ? 50_000 + fertility * water * 1_700_000 : 4_000,
    );
    const namingIndex = index % REGION_NAMES_AR.length;

    return {
      id: deterministicId(seed, "region", index),
      index,
      nameAr: `${REGION_NAMES_AR[namingIndex]} ${Math.floor(index / REGION_NAMES_AR.length) + 1}`,
      nameEn: `${REGION_NAMES_EN[namingIndex]} ${Math.floor(index / REGION_NAMES_EN.length) + 1}`,
      latitude,
      longitude,
      elevation,
      temperature,
      moisture,
      fertility,
      water,
      pollution: 0.015,
      population: 0,
      carryingCapacity,
      biome,
      resourceRichness: clamp(
        0.25 +
          Math.abs(fractalNoise(`${seed}:resources`, longitude / 34, latitude / 34, 4)) * 0.75,
      ),
    };
  });
}

function createCivilizations(seed: string, regions: RegionCell[]): CivilizationState[] {
  const candidates = regions
    .filter((region) => region.carryingCapacity > 120_000)
    .sort(
      (left, right) =>
        right.fertility * right.resourceRichness - left.fertility * left.resourceRichness,
    );

  return CIVILIZATIONS.map(([nameAr, nameEn], index) => {
    const random = createSeededRandom(`${seed}:civilization:${index}`);
    const capital = candidates[(index * 7) % candidates.length]!;
    const nearby = regions
      .filter(
        (region) =>
          region.biome !== "ocean" &&
          Math.abs(region.latitude - capital.latitude) < 24 &&
          Math.abs(region.longitude - capital.longitude) < 32,
      )
      .slice(0, 3);
    const regionIds = Array.from(new Set([capital.id, ...nearby.map((region) => region.id)]));
    const population = Math.round(random.between(190_000, 2_700_000));
    const id = deterministicId(seed, "civilization", index);
    for (const region of regions) {
      if (regionIds.includes(region.id) && !region.ownerCivilizationId) {
        region.ownerCivilizationId = id;
        region.population = Math.min(
          Math.round(population / regionIds.length),
          region.carryingCapacity,
        );
      }
    }
    return {
      id,
      nameAr,
      nameEn,
      regionIds,
      population,
      technology: random.between(0.28, 0.83),
      economy: random.between(0.32, 0.78),
      military: random.between(0.2, 0.72),
      stability: random.between(0.45, 0.9),
      health: random.between(0.45, 0.86),
      education: random.between(0.33, 0.82),
      pollution: random.between(0.05, 0.38),
      aggression: random.between(0.12, 0.7),
      food: random.between(0.38, 0.88),
      resources: random.between(0.3, 0.9),
      allies: [],
      rivals: [],
    };
  });
}

function createSpecies(seed: string, regions: RegionCell[]): SpeciesState[] {
  const habitable = regions.filter((region) => region.biome !== "ocean" && region.biome !== "ice");
  const speciesCount = 1_100;
  return Array.from({ length: speciesCount }, (_, index) => {
    const random = createSeededRandom(`${seed}:species:${index}`);
    const kind = index < 800 ? "plant" : "creature";
    const home = random.pick(habitable);
    const carryingCapacity =
      kind === "plant" ? random.integer(18_000, 2_000_000) : random.integer(800, 180_000);
    return {
      id: deterministicId(seed, "species", index),
      nameAr: kind === "plant" ? `نبات أزوري ${index + 1}` : `مخلوق أزوري ${index - 799}`,
      nameEn: kind === "plant" ? `Azuran plant ${index + 1}` : `Azuran creature ${index - 799}`,
      kind,
      regionIds: [home.id],
      population: Math.round(carryingCapacity * random.between(0.18, 0.72)),
      carryingCapacity,
      traits: {
        size: random.next(),
        growthRate: random.between(0.1, 0.8),
        waterNeed: random.next(),
        pollutionAbsorption: kind === "plant" ? random.between(0.04, 0.46) : 0,
        nightLuminosity: random.chance(0.03) ? random.between(0.25, 0.8) : 0,
        coldResistance: random.next(),
        heatResistance: random.next(),
        reproductionRate: random.between(0.08, 0.73),
        aggression: kind === "creature" ? random.next() : 0,
        intelligence: kind === "creature" ? random.between(0.04, 0.7) : 0.02,
        energyYield: random.between(0.02, 0.5),
        diseaseResistance: random.next(),
      },
    };
  });
}

export interface WorldGenerationOptions {
  planetId?: string;
  regionCount?: number;
  startYear?: number;
  tickYears?: number;
}

export function generateWorld(seed: string, options: WorldGenerationOptions = {}): WorldState {
  if (seed.trim().length < 3) {
    throw new Error("A seed of at least three characters is required");
  }
  const regions = createRegions(seed, options.regionCount ?? 240);
  const civilizations = createCivilizations(seed, regions);
  const species = createSpecies(seed, regions);
  return {
    planetId: options.planetId ?? deterministicId(seed, "planet", 0),
    seed,
    version: 0,
    tick: 0,
    year: options.startYear ?? 2347,
    tickYears: options.tickYears ?? 1,
    paused: false,
    climate: {
      meanTemperature: 14.2,
      seaLevel: 0,
      emissions: civilizations.reduce((total, civ) => total + civ.pollution, 0) * 0.06,
      vegetation: 0.68,
    },
    regions,
    civilizations,
    species,
    lastEventSequence: 0,
  };
}
