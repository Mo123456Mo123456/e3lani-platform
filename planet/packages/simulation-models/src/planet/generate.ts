import { ResourceKind } from "@planet/shared-types";
import { createRng, range, int, chance, pick } from "../rng.js";
import { cellToSphere, cellLat, clamp01, neighbors4, smoothstep } from "../math.js";
import { fbm3, ridged3, worley3 } from "../noise.js";
import { baseFertility, classifyCell } from "./biomes.js";
import { BIOME_ORDER, type PlanetGrid, type ResourceDeposit } from "./types.js";
import { BiomeType } from "@planet/shared-types";

export interface PlanetGenConfig {
  width: number;
  height: number;
  /** Approximate ocean coverage target (0..1). */
  oceanRatio: number;
  plateCount: number;
  depositCount: number;
}

export const DEFAULT_GEN_CONFIG: PlanetGenConfig = {
  width: 96,
  height: 48,
  oceanRatio: 0.62,
  plateCount: 12,
  depositCount: 120,
};

interface Plate {
  x: number;
  y: number;
  z: number;
  driftX: number;
  driftY: number;
  driftZ: number;
}

/**
 * Deterministic procedural planet generation. The same seed always produces
 * the same planet: tectonic plates (voronoi on the sphere), fractal terrain,
 * latitude/altitude climate, wind-driven moisture with rain shadows,
 * downhill river flow and biome classification.
 */
export function generatePlanetGrid(seed: number, config: PlanetGenConfig = DEFAULT_GEN_CONFIG): PlanetGrid {
  const { width, height, plateCount } = config;
  const cellCount = width * height;
  const rng = createRng(seed);

  const elevation = new Float32Array(cellCount);
  const temperature = new Float32Array(cellCount);
  const moisture = new Float32Array(cellCount);
  const biome = new Uint8Array(cellCount);
  const fertility = new Float32Array(cellCount);
  const pollution = new Float32Array(cellCount);
  const river = new Uint8Array(cellCount);
  const ice = new Float32Array(cellCount);
  const volcanic = new Float32Array(cellCount);
  const windDir = new Float32Array(cellCount);

  // --- Tectonic plates: seeded points on the unit sphere -------------------
  const plates: Plate[] = [];
  for (let i = 0; i < plateCount; i++) {
    const theta = range(rng, "plates", 0, Math.PI * 2);
    const phi = Math.acos(range(rng, "plates", -1, 1));
    plates.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
      driftX: range(rng, "plates", -1, 1),
      driftY: range(rng, "plates", -1, 1),
      driftZ: range(rng, "plates", -1, 1),
    });
  }

  // --- Elevation: domain-warped fBm + ridged mountains at plate boundaries -
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cy * width + cx;
      const [sx, sy, sz] = cellToSphere(width, height, cx, cy);

      // Plate assignment + boundary stress (nearest vs second-nearest plate).
      let d1 = Infinity;
      let d2 = Infinity;
      let p1: Plate = plates[0] as Plate;
      for (const p of plates) {
        const d = (sx - p.x) ** 2 + (sy - p.y) ** 2 + (sz - p.z) ** 2;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          p1 = p;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const boundary = 1 - clamp01((d2 - d1) * 4); // 1 near boundaries
      const convergence = Math.abs(
        (p1.driftX * sx + p1.driftY * sy + p1.driftZ * sz),
      );

      const warp = fbm3(seed + 11, sx * 1.7 + 5, sy * 1.7, sz * 1.7, 3) - 0.5;
      let e = fbm3(seed + 23, sx * 2.3 + warp, sy * 2.3, sz * 2.3 - warp, 6);
      const ridge = ridged3(seed + 37, sx * 3.1, sy * 3.1, sz * 3.1, 4);
      e += boundary * ridge * (0.18 + 0.25 * convergence);
      e -= (1 - boundary) * 0.08; // oceanic plate interiors sag
      volcanic[idx] = clamp01(boundary * convergence * 1.4 + (worley3(seed + 91, sx * 2, sy * 2, sz * 2) < 0.28 ? 0.25 : 0));
      elevation[idx] = e;
    }
  }

  // --- Sea level from elevation histogram (target ocean ratio) ------------
  const sorted = Array.from(elevation).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(sorted.length * config.oceanRatio)] ?? 0.5;

  // --- Climate: latitude + altitude temperature, wind-band moisture -------
  for (let cy = 0; cy < height; cy++) {
    const lat = cellLat(height, cy);
    const latFactor = 1 - Math.abs(lat) / 90; // 1 equator, 0 poles
    const band = Math.abs(lat) < 23 ? 0 : Math.abs(lat) < 55 ? 1 : 2;
    for (let cx = 0; cx < width; cx++) {
      const idx = cy * width + cx;
      const above = Math.max(0, elevation[idx]! - seaLevel);
      const [sx, sy, sz] = cellToSphere(width, height, cx, cy);
      const local = fbm3(seed + 53, sx * 4, sy * 4, sz * 4, 3) - 0.5;
      temperature[idx] = latFactor * 1.5 - 0.75 - above * 1.1 + local * 0.22;
      // Prevailing winds: trades blow west near equator, westerlies east mid-lat.
      windDir[idx] = band === 0 ? Math.PI : band === 1 ? 0 : Math.PI;
    }
  }

  // Moisture: pick up over oceans, drop as rain over land; mountains wring the
  // air dry on their lee side (rain shadow). Iterated upwind-to-downwind.
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cy * width + cx;
      moisture[idx] = elevation[idx]! <= seaLevel ? 1 : 0.12;
    }
  }
  const passes = Math.ceil(width / 2);
  for (let pass = 0; pass < passes; pass++) {
    for (let cy = 0; cy < height; cy++) {
      const lat = cellLat(height, cy);
      const eastward = Math.abs(lat) >= 23 && Math.abs(lat) < 55;
      for (let k = 0; k < width; k++) {
        const cx = eastward ? k : width - 1 - k;
        const idx = cy * width + cx;
        const prevX = eastward ? (cx - 1 + width) % width : (cx + 1) % width;
        const prevIdx = cy * width + prevX;
        if (elevation[idx]! <= seaLevel) continue;
        let m = (moisture[prevIdx] ?? 0) * 0.965;
        const prevAbove = Math.max(0, elevation[prevIdx]! - seaLevel);
        const hereAbove = Math.max(0, elevation[idx]! - seaLevel);
        const climb = hereAbove - prevAbove;
        if (climb > 0.02) m *= 0.82; // orographic rainfall on windward side
        if (climb < -0.02) m *= 0.9; // descending air stays dry (rain shadow)
        moisture[idx] = Math.max(moisture[idx]!, clamp01(m));
      }
    }
  }

  // --- Rivers: flow downhill from wet highlands to the sea -----------------
  const riverSources = int(rng, "rivers", 26, 40);
  for (let i = 0; i < riverSources; i++) {
    let idx = int(rng, "rivers", 0, cellCount - 1);
    let guard = width * 2;
    while (guard-- > 0) {
      if (elevation[idx]! <= seaLevel) break;
      if ((moisture[idx] ?? 0) < 0.25 && guard > width) {
        idx = int(rng, "rivers", 0, cellCount - 1);
        continue;
      }
      river[idx] = 1;
      const ns = neighbors4(width, height, idx);
      let next = -1;
      let lowest = elevation[idx]!;
      for (const n of ns) {
        if ((elevation[n] ?? 0) < lowest) {
          lowest = elevation[n]!;
          next = n;
        }
      }
      if (next < 0) break; // lake / local minimum
      idx = next;
      if (elevation[idx]! <= seaLevel) break;
    }
  }

  // --- Biomes, ice, fertility ----------------------------------------------
  const grid: PlanetGrid = {
    width, height, cellCount, elevation, temperature, moisture, biome,
    fertility, pollution, river, ice, volcanic, windDir, seaLevel,
  };
  for (let idx = 0; idx < cellCount; idx++) {
    const b = classifyCell(grid, idx);
    biome[idx] = BIOME_ORDER.indexOf(b);
    ice[idx] = b === BiomeType.Ice ? 0.9 : temperature[idx]! < -0.35 ? 0.5 : 0;
    let f = baseFertility(b);
    if (river[idx] === 1) f = clamp01(f + 0.2);
    if (b === BiomeType.Volcanic) f = clamp01(f + 0.1); // ash enriches soil
    fertility[idx] = f * clamp01(0.6 + 0.4 * (temperature[idx]! + 0.5));
  }

  return grid;
}

/** Place resource deposits according to biome geology/ecology. */
export function generateDeposits(seed: number, grid: PlanetGrid, count: number): ResourceDeposit[] {
  const rng = createRng(seed ^ 0x5f3a);
  const deposits: ResourceDeposit[] = [];
  let id = 1;
  let guard = count * 40;
  while (deposits.length < count && guard-- > 0) {
    const cell = int(rng, "deposits", 0, grid.cellCount - 1);
    const b = BIOME_ORDER[grid.biome[cell] ?? 0] ?? BiomeType.Ocean;
    let kind: ResourceKind | null = null;
    switch (b) {
      case BiomeType.Mountains:
        kind = pick(rng, "deposits", [ResourceKind.MetalOre, ResourceKind.MetalOre, ResourceKind.Stone, ResourceKind.RareEarth, ResourceKind.Gem] as const);
        break;
      case BiomeType.Volcanic:
        kind = pick(rng, "deposits", [ResourceKind.Gem, ResourceKind.RareEarth, ResourceKind.EnergySource] as const);
        break;
      case BiomeType.Desert:
        kind = pick(rng, "deposits", [ResourceKind.EnergySource, ResourceKind.Stone, ResourceKind.Gem] as const);
        break;
      case BiomeType.Rainforest:
      case BiomeType.TemperateForest:
        kind = pick(rng, "deposits", [ResourceKind.Timber, ResourceKind.Medicine, ResourceKind.Food] as const);
        break;
      case BiomeType.Plains:
      case BiomeType.Steppe:
        kind = pick(rng, "deposits", [ResourceKind.FertileLand, ResourceKind.Food, ResourceKind.Water] as const);
        break;
      case BiomeType.Coast:
      case BiomeType.Swamp:
        kind = pick(rng, "deposits", [ResourceKind.Water, ResourceKind.Food, ResourceKind.Medicine] as const);
        break;
      case BiomeType.Tundra:
        kind = chance(rng, "deposits", 0.5) ? ResourceKind.MetalOre : null;
        break;
      default:
        kind = null;
    }
    if (!kind) continue;
    if (deposits.some((d) => d.cell === cell)) continue;
    const mineral = kind === ResourceKind.MetalOre || kind === ResourceKind.RareEarth || kind === ResourceKind.Gem || kind === ResourceKind.Stone;
    deposits.push({
      id: id++,
      cell,
      kind,
      quantity: range(rng, "deposits", 400, 2000),
      regenRate: mineral ? 0 : range(rng, "deposits", 0.005, 0.02),
      extractionRate: range(rng, "deposits", 0.01, 0.05),
      value: kind === ResourceKind.RareEarth || kind === ResourceKind.Gem ? 3 : kind === ResourceKind.EnergySource ? 2.5 : 1,
      depleted: false,
    });
  }
  return deposits;
}

/** Fraction of cells classified as land. */
export function landRatio(grid: PlanetGrid): number {
  let land = 0;
  for (let i = 0; i < grid.cellCount; i++) {
    if ((grid.elevation[i] ?? 0) > grid.seaLevel) land++;
  }
  return land / grid.cellCount;
}

export { smoothstep };
