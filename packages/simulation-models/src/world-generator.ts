import type {
  Biome,
  CivilizationState,
  PlanetRegion,
  SpeciesState,
  WorldState,
} from "@planet/shared-types";
import { SeededRandom, fractalNoise2D, hashSeed, worleyNoise2D } from "./random.js";

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));
const round = (value: number, precision = 5) => Number(value.toFixed(precision));

export function deterministicId(label: string): string {
  const parts = [0, 1, 2, 3].map((index) =>
    hashSeed(`${label}:${index}`).toString(16).padStart(8, "0"),
  );
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

function classifyBiome(
  elevation: number,
  temperature: number,
  moisture: number,
  volcanic: number,
  coastDistance: number,
): Biome {
  if (elevation < 0.42) return "ocean";
  if (coastDistance < 0.035) return "coast";
  if (temperature < 0.13) return elevation > 0.68 ? "ice" : "tundra";
  if (elevation > 0.8) return volcanic > 0.72 ? "volcanic" : "mountain";
  if (moisture < 0.2 && temperature > 0.55) return "desert";
  if (moisture < 0.31) return "steppe";
  if (moisture > 0.8 && elevation < 0.55) return "wetland";
  if (moisture > 0.7 && temperature > 0.61) return "rainforest";
  if (moisture > 0.5) return "temperate_forest";
  return "plains";
}

function nearestOceanDistance(
  elevations: readonly number[],
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  for (let radius = 0; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = (x + dx + width) % width;
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        if ((elevations[ny * width + nx] ?? 1) < 0.42) return radius / 4;
      }
    }
  }
  return 1;
}

function generateRegions(seed: string, width: number, height: number): PlanetRegion[] {
  const numericSeed = hashSeed(seed);
  const elevations: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const longitude = x / width;
      const latitude = y / (height - 1);
      const continental = fractalNoise2D(numericSeed, longitude * 3.1, latitude * 2.2, 6);
      const ridges = 1 - Math.abs(worleyNoise2D(numericSeed + 41, longitude * 8, latitude * 5) * 2 - 1);
      const polarOceanBias = Math.abs(latitude - 0.5) * 0.08;
      elevations.push(clamp(continental * 0.83 + ridges * 0.17 - polarOceanBias));
    }
  }

  return elevations.map((elevation, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const latitude = 90 - (y / (height - 1)) * 180;
    const longitude = (x / width) * 360 - 180;
    const normalizedLatitude = Math.abs(latitude) / 90;
    const oceanDistance = nearestOceanDistance(elevations, x, y, width, height);
    const prevailingWindOffset = latitude >= 0 ? -1 : 1;
    const windwardElevation =
      elevations[y * width + ((x + prevailingWindOffset + width) % width)] ?? elevation;
    const rainShadow = clamp((elevation - windwardElevation) * 1.8);
    const oceanHumidity = 1 - oceanDistance;
    const noiseMoisture = fractalNoise2D(
      numericSeed + 10_007,
      (x / width) * 5,
      (y / height) * 4,
      4,
    );
    const temperature = clamp(
      1 - normalizedLatitude * 0.92 - Math.max(0, elevation - 0.48) * 0.7,
    );
    const moisture = clamp(noiseMoisture * 0.55 + oceanHumidity * 0.45 - rainShadow);
    const rainfall = clamp(moisture * (0.45 + temperature * 0.55));
    const volcanic = worleyNoise2D(
      numericSeed + 20_011,
      (x / width) * 9,
      (y / height) * 5,
    );
    const surfaceWater = clamp(
      rainfall * 0.66 + Math.max(0, 0.62 - elevation) * 0.3 + oceanHumidity * 0.16,
    );
    const fertility = clamp(
      moisture * 0.48 + temperature * 0.28 + (1 - Math.abs(elevation - 0.55)) * 0.24,
    );
    const biome = classifyBiome(
      elevation,
      temperature,
      moisture,
      volcanic,
      oceanDistance / 28,
    );
    const isLand = biome !== "ocean";
    const resourceNoise = fractalNoise2D(
      numericSeed + 30_013,
      (x / width) * 13,
      (y / height) * 8,
      3,
    );

    return {
      id: deterministicId(`${seed}:region:${index}`),
      index,
      latitude: round(latitude, 3),
      longitude: round(longitude, 3),
      elevation: round(elevation),
      temperature: round(temperature),
      moisture: round(moisture),
      rainfall: round(rainfall),
      fertility: round(fertility),
      surfaceWater: round(surfaceWater),
      vegetation: round(isLand ? fertility * moisture : 0),
      pollution: 0,
      population: 0,
      biome,
      resources: {
        water: round(surfaceWater),
        biomass: round(isLand ? fertility * 0.8 : 0.22),
        minerals: round(isLand ? resourceNoise * (0.4 + elevation * 0.6) : 0.08),
        energy: round(isLand ? volcanic * 0.35 + (1 - moisture) * 0.3 : 0.18),
      },
    };
  });
}

const civilizationNames = [
  "أورين",
  "تالاسا",
  "ميراف",
  "نوفارا",
  "أزال",
  "سيرين",
  "كوان",
  "إيلارا",
  "فارون",
  "لوميرا",
  "أركاد",
  "نيراس",
] as const;

function seedCivilizations(seed: string, regions: PlanetRegion[]): CivilizationState[] {
  const random = new SeededRandom(`${seed}:civilizations`);
  const habitable = regions
    .filter(
      (region) =>
        !["ocean", "ice", "volcanic", "mountain"].includes(region.biome) &&
        region.surfaceWater > 0.3,
    )
    .sort((left, right) => right.fertility - left.fertility);
  const civilizations: CivilizationState[] = [];
  const used = new Set<string>();

  for (let index = 0; index < civilizationNames.length; index += 1) {
    const candidates = habitable.filter((region) => !used.has(region.id));
    const region = candidates[Math.min(candidates.length - 1, index * 3 + random.integer(0, 2))];
    if (!region) break;
    used.add(region.id);
    const population = random.integer(24_000, 180_000);
    region.population = population;
    civilizations.push({
      id: deterministicId(`${seed}:civilization:${index}`),
      name: civilizationNames[index] as string,
      regionId: region.id,
      population,
      food: round(0.45 + region.fertility * 0.45),
      economy: round(random.between(0.22, 0.58)),
      technology: round(random.between(0.12, 0.42)),
      military: round(random.between(0.15, 0.52)),
      stability: round(random.between(0.48, 0.86)),
      pollution: round(random.between(0.01, 0.08)),
      aggression: round(random.between(0.08, 0.72)),
      innovation: round(random.between(0.22, 0.76)),
      memory: [],
    });
  }
  return civilizations;
}

function seedSpecies(seed: string, regions: PlanetRegion[]): SpeciesState[] {
  const random = new SeededRandom(`${seed}:species`);
  const habitable = regions.filter((region) => !["ocean", "ice", "volcanic"].includes(region.biome));
  return Array.from({ length: 300 }, (_, index) => {
    const region = random.pick(habitable);
    const trophicLevel = random.integer(1, 4);
    const carryingCapacity = Math.round(
      (4_000 + region.fertility * 96_000) / Math.max(1, trophicLevel * 0.72),
    );
    return {
      id: deterministicId(`${seed}:species:${index}`),
      name: `Species ${String(index + 1).padStart(3, "0")}`,
      regionId: region.id,
      population: Math.round(carryingCapacity * random.between(0.2, 0.72)),
      carryingCapacity,
      reproductionRate: round(random.between(0.03, 0.32)),
      adaptability: round(random.between(0.12, 0.9)),
      heatResistance: round(random.between(0.08, 0.94)),
      coldResistance: round(random.between(0.08, 0.94)),
      waterNeed: round(random.between(0.1, 0.92)),
      trophicLevel,
    };
  });
}

export interface WorldGenerationOptions {
  seed: string;
  planetId?: string;
  width?: number;
  height?: number;
  startingYear?: number;
}

export function generateWorld(options: WorldGenerationOptions): WorldState {
  const width = options.width ?? 48;
  const height = options.height ?? 24;
  if (width < 12 || height < 6) throw new Error("World grid must be at least 12×6");
  const regions = generateRegions(options.seed, width, height);
  const civilizations = seedCivilizations(options.seed, regions);
  const species = seedSpecies(options.seed, regions);
  return {
    planetId: options.planetId ?? deterministicId(`${options.seed}:planet`),
    seed: options.seed,
    version: 1,
    tick: 0,
    year: options.startingYear ?? 0,
    tickYears: 1,
    regions,
    civilizations,
    species,
  };
}
