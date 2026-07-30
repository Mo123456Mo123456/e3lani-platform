import {
  WorldConfigSchema,
  WorldStateSchema,
  type BiomeId,
  type ResourcePotential,
  type WorldConfig,
  type WorldState,
} from "@kawkab/shared-types";

import { fractalNoise3D } from "./noise.js";
import { hashHex, type Seed } from "./prng.js";

export const DEFAULT_WORLD_CONFIG: Readonly<WorldConfig> = {
  rows: 18,
  columns: 36,
  ticksPerYear: 12,
};

export interface WorldGenerationOptions {
  rows?: number;
  columns?: number;
  ticksPerYear?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function classifyBiome(
  elevation: number,
  temperatureC: number,
  moisture: number,
): BiomeId {
  if (elevation < -0.12) return temperatureC < -12 ? "ICE" : "OCEAN";
  if (elevation < -0.03) return temperatureC < -10 ? "ICE" : "COAST";
  if (elevation > 0.68) return temperatureC < -8 ? "ICE" : "MOUNTAIN";
  if (temperatureC < -14) return "ICE";
  if (temperatureC < -5) return "TUNDRA";
  if (temperatureC < 7 && moisture > 0.35) return "TAIGA";
  if (moisture < 0.18) return "DESERT";
  if (temperatureC > 19 && moisture > 0.72) return "RAINFOREST";
  if (moisture > 0.8) return "WETLAND";
  if (moisture > 0.53) return "FOREST";
  if (temperatureC > 18 && moisture < 0.42) return "SAVANNA";
  return "GRASSLAND";
}

export function biomeHabitability(biome: BiomeId): number {
  const values: Record<BiomeId, number> = {
    OCEAN: 0,
    COAST: 0.74,
    ICE: 0.02,
    TUNDRA: 0.16,
    TAIGA: 0.42,
    GRASSLAND: 0.82,
    SAVANNA: 0.56,
    DESERT: 0.12,
    FOREST: 0.7,
    RAINFOREST: 0.62,
    WETLAND: 0.5,
    MOUNTAIN: 0.2,
  };
  return values[biome];
}

function resourcePotential(
  seed: string,
  x: number,
  y: number,
  z: number,
  elevation: number,
  moisture: number,
  biome: BiomeId,
): ResourcePotential {
  const mineralNoise = fractalNoise3D(`${seed}:minerals`, x * 3, y * 3, z * 3);
  const energyNoise = fractalNoise3D(`${seed}:energy`, x * 2, y * 2, z * 2);
  const habitability = biomeHabitability(biome);
  const isWater = biome === "OCEAN" || biome === "COAST";

  return {
    water: round(clamp(isWater ? 0.95 : moisture * 0.9, 0, 1)),
    minerals: round(
      clamp(0.3 + mineralNoise * 0.3 + Math.max(0, elevation) * 0.4, 0, 1),
    ),
    biomass: round(clamp(habitability * 0.7 + moisture * 0.3, 0, 1)),
    fertility: round(
      clamp(
        habitability * 0.75 +
          (biome === "GRASSLAND" || biome === "WETLAND" ? 0.2 : 0),
        0,
        1,
      ),
    ),
    energy: round(
      clamp(0.45 + energyNoise * 0.3 + (isWater ? 0.1 : 0), 0, 1),
    ),
  };
}

function regionId(row: number, column: number): string {
  return `region:${row}:${column}`;
}

function neighborIds(
  row: number,
  column: number,
  rows: number,
  columns: number,
): string[] {
  const neighbors = new Set<string>();
  const wrappedWest = (column - 1 + columns) % columns;
  const wrappedEast = (column + 1) % columns;
  neighbors.add(regionId(row, wrappedWest));
  neighbors.add(regionId(row, wrappedEast));

  for (const adjacentRow of [row - 1, row + 1]) {
    if (adjacentRow < 0 || adjacentRow >= rows) continue;
    neighbors.add(regionId(adjacentRow, wrappedWest));
    neighbors.add(regionId(adjacentRow, column));
    neighbors.add(regionId(adjacentRow, wrappedEast));
  }
  return [...neighbors].sort();
}

/**
 * Generates a simplified latitude/longitude globe. Sampling noise in 3D
 * spherical coordinates avoids a discontinuity at the ±180° longitude seam.
 */
export function generateWorld(
  seed: Seed,
  options: WorldGenerationOptions = {},
): WorldState {
  const seedText = String(seed);
  if (seedText.length === 0) {
    throw new RangeError("seed cannot be empty");
  }

  const config = WorldConfigSchema.parse({
    ...DEFAULT_WORLD_CONFIG,
    ...options,
  });
  const regions: WorldState["regions"] = [];

  for (let row = 0; row < config.rows; row += 1) {
    const latitude = -90 + ((row + 0.5) * 180) / config.rows;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const cosLatitude = Math.cos(latitudeRadians);

    for (let column = 0; column < config.columns; column += 1) {
      const longitude =
        -180 + ((column + 0.5) * 360) / config.columns;
      const longitudeRadians = (longitude * Math.PI) / 180;
      const x = cosLatitude * Math.cos(longitudeRadians);
      const y = Math.sin(latitudeRadians);
      const z = cosLatitude * Math.sin(longitudeRadians);

      const continental = fractalNoise3D(
        `${seedText}:continents`,
        x * 1.35,
        y * 1.35,
        z * 1.35,
        5,
        0.52,
      );
      const terrainDetail = fractalNoise3D(
        `${seedText}:terrain`,
        x * 4,
        y * 4,
        z * 4,
        3,
        0.45,
      );
      const elevation = round(clamp(continental * 0.82 + terrainDetail * 0.18, -1, 1));
      const temperatureNoise = fractalNoise3D(
        `${seedText}:temperature`,
        x * 2,
        y * 2,
        z * 2,
        3,
      );
      const temperatureC = round(
        clamp(
          29 -
            Math.abs(latitude) * 0.64 -
            Math.max(0, elevation) * 31 +
            temperatureNoise * 4,
          -70,
          55,
        ),
      );
      const moistureNoise = fractalNoise3D(
        `${seedText}:moisture`,
        x * 2.4,
        y * 2.4,
        z * 2.4,
        4,
      );
      const moisture = round(
        clamp(
          0.5 +
            moistureNoise * 0.38 -
            Math.max(0, temperatureC - 32) * 0.008,
          0,
          1,
        ),
      );
      const biome = classifyBiome(elevation, temperatureC, moisture);
      const potential = resourcePotential(
        seedText,
        x,
        y,
        z,
        elevation,
        moisture,
        biome,
      );
      const areaWeight = round(Math.max(0.01, cosLatitude));
      const carryingCapacity =
        biome === "OCEAN" || biome === "ICE"
          ? 0
          : Math.round(
              1_000_000 *
                areaWeight *
                biomeHabitability(biome) *
                (0.35 + potential.fertility * 0.65),
            );

      regions.push({
        id: regionId(row, column),
        row,
        column,
        latitude: round(latitude),
        longitude: round(longitude),
        areaWeight,
        neighborIds: neighborIds(
          row,
          column,
          config.rows,
          config.columns,
        ),
        elevation,
        temperatureC,
        moisture,
        biome,
        resourcePotential: potential,
        carryingCapacity,
        population: 0,
        pollution: 0,
      });
    }
  }

  const globalMeanTemperatureC =
    regions.reduce((total, region) => total + region.temperatureC, 0) /
    regions.length;
  const globalMeanMoisture =
    regions.reduce((total, region) => total + region.moisture, 0) /
    regions.length;

  return WorldStateSchema.parse({
    version: 1,
    id: `world:${hashHex(seedText)}`,
    seed: seedText,
    tick: 0,
    eventCount: 0,
    config,
    climate: {
      globalMeanTemperatureC: round(globalMeanTemperatureC),
      globalMeanMoisture: round(globalMeanMoisture),
      atmosphericCarbonPpm: 280,
      seaLevelMeters: 0,
    },
    regions,
    species: [],
    plants: [],
    resources: [],
    civilizations: [],
    technologies: [],
  });
}
