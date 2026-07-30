/**
 * Procedural planet terrain generation.
 */

import type { BiomeId, RegionSummary } from "@planet/shared-types";
import { SeededRNG } from "./seeded-rng.js";
import { NoiseGenerator } from "./noise.js";

export type { BiomeId, RegionSummary };

export interface RiverPath {
  points: Array<{ x: number; y: number }>;
  length: number;
}

export interface TectonicPlate {
  id: number;
  centerX: number;
  centerY: number;
  driftX: number;
  driftY: number;
  cells: number;
}

export interface PlanetTerrainData {
  seed: string;
  resolution: number;
  heightMap: Float32Array;
  moistureMap: Float32Array;
  temperatureMap: Float32Array;
  biomeMap: Uint8Array;
  rivers: RiverPath[];
  plates: TectonicPlate[];
  oceanLevel: number;
  regions: RegionSummary[];
}

export const BIOME_LIST: BiomeId[] = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "swamp",
  "steppe",
  "volcanic",
  "ice",
];

export function biomeToId(b: BiomeId): number {
  return BIOME_LIST.indexOf(b);
}

export function idToBiome(id: number): BiomeId {
  return BIOME_LIST[id] ?? "plains";
}

export function classifyBiome(
  lat: number,
  elevation: number,
  temperature: number,
  moisture: number,
  oceanLevel: number,
  volcanic: boolean,
): BiomeId {
  if (elevation < oceanLevel) return "ocean";
  if (elevation < oceanLevel + 0.04) return "coast";
  if (volcanic && elevation > 0.55) return "volcanic";
  if (elevation > 0.72) {
    if (temperature < 0.25) return "ice";
    return "mountain";
  }
  if (temperature < 0.18) return Math.abs(lat) > 0.7 ? "ice" : "tundra";
  if (moisture > 0.7 && temperature > 0.55) return "rainforest";
  if (moisture > 0.55 && temperature > 0.35) return "temperate_forest";
  if (moisture > 0.65 && elevation < oceanLevel + 0.12) return "swamp";
  if (moisture < 0.28 && temperature > 0.45) return "desert";
  if (moisture < 0.42 && temperature > 0.3 && temperature < 0.65) return "steppe";
  return "plains";
}

function idx(x: number, y: number, res: number): number {
  return y * res + x;
}

export class ProceduralPlanetGenerator {
  readonly seed: string;
  readonly resolution: number;
  private readonly rng: SeededRNG;
  private readonly noise: NoiseGenerator;

  constructor(seed: string, resolution = 64) {
    this.seed = seed;
    this.resolution = Math.max(8, resolution);
    this.rng = new SeededRNG(seed);
    this.noise = new NoiseGenerator(this.rng.fork("terrain"));
  }

  generate(): PlanetTerrainData {
    const res = this.resolution;
    const heightMap = new Float32Array(res * res);
    const moistureMap = new Float32Array(res * res);
    const temperatureMap = new Float32Array(res * res);
    const biomeMap = new Uint8Array(res * res);
    const oceanLevel = 0.42;
    const scale = 3.5;

    // Continent mask + height
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const nx = (x / res) * scale;
        const ny = (y / res) * scale;
        const continent = this.noise.fbm2D(nx * 0.6, ny * 0.6, 4);
        const detail = this.noise.fbm2D(nx * 2.2 + 10, ny * 2.2 + 10, 5);
        const ridges = this.noise.ridged2D(nx * 1.5 + 30, ny * 1.5 + 30, 4);
        let h = 0.45 * continent + 0.35 * detail + 0.2 * ridges;
        // soften edges toward poles a bit for circular-ish landmass feel
        const latNorm = (y / (res - 1)) * 2 - 1;
        h *= 1 - 0.08 * latNorm * latNorm;
        heightMap[idx(x, y, res)] = Math.min(1, Math.max(0, (h + 1) / 2));
      }
    }

    // Moisture from noise + ocean proximity
    const oceanDist = this.approxOceanDistance(heightMap, oceanLevel);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = idx(x, y, res);
        const nx = (x / res) * scale;
        const ny = (y / res) * scale;
        const n = (this.noise.fbm2D(nx + 50, ny + 50, 4) + 1) / 2;
        const prox = Math.exp(-oceanDist[i]! * 4);
        moistureMap[i] = Math.min(1, Math.max(0, 0.45 * n + 0.55 * prox));
      }
    }

    // Temperature from latitude + elevation
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = idx(x, y, res);
        const lat = (y / (res - 1)) * 2 - 1; // -1..1
        const base = 1 - Math.abs(lat);
        const elev = heightMap[i]!;
        const cool = Math.max(0, elev - oceanLevel) * 1.2;
        temperatureMap[i] = Math.min(1, Math.max(0, base * 0.85 + 0.15 - cool));
      }
    }

    // Volcanic hotspots via worley
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = idx(x, y, res);
        const nx = (x / res) * 6;
        const ny = (y / res) * 6;
        const volcanic = this.noise.worley2D(nx + 90, ny + 90) < 0.12 && heightMap[i]! > 0.55;
        const lat = (y / (res - 1)) * 2 - 1;
        const biome = classifyBiome(
          lat,
          heightMap[i]!,
          temperatureMap[i]!,
          moistureMap[i]!,
          oceanLevel,
          volcanic,
        );
        biomeMap[i] = biomeToId(biome);
      }
    }

    const plates = this.generatePlates(8);
    const rivers = this.generateRivers(heightMap, oceanLevel, 16);
    const regions = this.summarizeRegions(heightMap, temperatureMap, moistureMap, biomeMap, oceanLevel);

    return {
      seed: this.seed,
      resolution: res,
      heightMap,
      moistureMap,
      temperatureMap,
      biomeMap,
      rivers,
      plates,
      oceanLevel,
      regions,
    };
  }

  private approxOceanDistance(height: Float32Array, oceanLevel: number): Float32Array {
    const res = this.resolution;
    const dist = new Float32Array(res * res);
    dist.fill(1);
    // seed ocean cells
    for (let i = 0; i < height.length; i++) {
      if (height[i]! < oceanLevel) dist[i] = 0;
    }
    // multi-pass approximate Euclidean
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const i = idx(x, y, res);
          let d = dist[i]!;
          if (x > 0) d = Math.min(d, dist[idx(x - 1, y, res)]! + 1 / res);
          if (y > 0) d = Math.min(d, dist[idx(x, y - 1, res)]! + 1 / res);
          dist[i] = d;
        }
      }
      for (let y = res - 1; y >= 0; y--) {
        for (let x = res - 1; x >= 0; x--) {
          const i = idx(x, y, res);
          let d = dist[i]!;
          if (x < res - 1) d = Math.min(d, dist[idx(x + 1, y, res)]! + 1 / res);
          if (y < res - 1) d = Math.min(d, dist[idx(x, y + 1, res)]! + 1 / res);
          dist[i] = d;
        }
      }
    }
    return dist;
  }

  private generatePlates(count: number): TectonicPlate[] {
    const rng = this.rng.fork("plates");
    const res = this.resolution;
    const plates: TectonicPlate[] = [];
    for (let i = 0; i < count; i++) {
      plates.push({
        id: i,
        centerX: rng.nextFloat() * res,
        centerY: rng.nextFloat() * res,
        driftX: rng.nextFloat() * 2 - 1,
        driftY: rng.nextFloat() * 2 - 1,
        cells: 0,
      });
    }
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        let best = 0;
        let bestD = Infinity;
        for (let p = 0; p < plates.length; p++) {
          const dx = x - plates[p]!.centerX;
          const dy = y - plates[p]!.centerY;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        plates[best]!.cells++;
      }
    }
    return plates;
  }

  private generateRivers(
    height: Float32Array,
    oceanLevel: number,
    count: number,
  ): RiverPath[] {
    const res = this.resolution;
    const rng = this.rng.fork("rivers");
    const rivers: RiverPath[] = [];

    for (let r = 0; r < count; r++) {
      // start from high land
      let sx = rng.nextInt(1, res - 2);
      let sy = rng.nextInt(1, res - 2);
      let bestH = height[idx(sx, sy, res)]!;
      for (let tryN = 0; tryN < 20; tryN++) {
        const tx = rng.nextInt(1, res - 2);
        const ty = rng.nextInt(1, res - 2);
        const h = height[idx(tx, ty, res)]!;
        if (h > bestH && h > oceanLevel + 0.1) {
          bestH = h;
          sx = tx;
          sy = ty;
        }
      }
      if (bestH <= oceanLevel + 0.08) continue;

      const points: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
      let cx = sx;
      let cy = sy;
      const visited = new Set<number>();
      for (let step = 0; step < res * 2; step++) {
        const ci = idx(cx, cy, res);
        if (visited.has(ci)) break;
        visited.add(ci);
        if (height[ci]! < oceanLevel) break;

        let nextX = cx;
        let nextY = cy;
        let lowest = height[ci]!;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue;
            const h = height[idx(nx, ny, res)]!;
            if (h < lowest) {
              lowest = h;
              nextX = nx;
              nextY = ny;
            }
          }
        }
        if (nextX === cx && nextY === cy) break;
        cx = nextX;
        cy = nextY;
        points.push({ x: cx, y: cy });
      }
      if (points.length > 3) {
        rivers.push({ points, length: points.length });
      }
    }
    return rivers;
  }

  private summarizeRegions(
    height: Float32Array,
    temp: Float32Array,
    moist: Float32Array,
    biome: Uint8Array,
    oceanLevel: number,
  ): RegionSummary[] {
    const res = this.resolution;
    const grid = 4;
    const regions: RegionSummary[] = [];
    const cell = Math.floor(res / grid);
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        let e = 0, t = 0, m = 0, land = 0, n = 0;
        const counts = new Array(BIOME_LIST.length).fill(0) as number[];
        for (let y = gy * cell; y < Math.min(res, (gy + 1) * cell); y++) {
          for (let x = gx * cell; x < Math.min(res, (gx + 1) * cell); x++) {
            const i = idx(x, y, res);
            e += height[i]!;
            t += temp[i]!;
            m += moist[i]!;
            if (height[i]! >= oceanLevel) land++;
            counts[biome[i]!]!++;
            n++;
          }
        }
        let dominant = 0;
        for (let b = 1; b < counts.length; b++) {
          if (counts[b]! > counts[dominant]!) dominant = b;
        }
        regions.push({
          id: `r${gy}_${gx}`,
          biome: idToBiome(dominant),
          elevMean: e / n,
          tempMean: t / n,
          moistMean: m / n,
          landFraction: land / n,
        });
      }
    }
    return regions;
  }
}
