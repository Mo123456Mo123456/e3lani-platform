/**
 * Procedural planet generation.
 *
 * Pipeline (every stage seeded, fully reproducible):
 *   1. continental base  — fbm simplex sampled on the unit sphere
 *   2. mountain ridges   — ridged multifractal
 *   3. tectonic plates   — Worley regions; boundaries raise mountains/volcanoes
 *   4. sea level split   — ocean / coastal water / land
 *   5. temperature       — latitude gradient + noise − altitude lapse
 *   6. moisture          — ocean distance + noise + orographic rain shadow
 *   7. rivers            — downhill flow from humid highlands to the sea
 *   8. biome classify    — pure function of the physical drivers
 *   9. resource deposits — biome-weighted seeded placement
 */
import type { Biome, PlanetCell, ResourceDeposit, ResourceType } from "@planet/shared-types";
import { Simplex3, Worley2, clamp, clamp01 } from "../noise.js";
import { rngFromString, type Rng } from "../rng.js";
import { BIOME_FERTILITY, classifyBiome } from "./biomes.js";

export interface WorldgenConfig {
  seed: string;
  latBands: number;
  lonBands: number;
  seaLevel: number;
  riverCount: number;
  /** approximate fraction of land cells carrying a deposit */
  resourceDensity: number;
}

export const DEFAULT_WORLDGEN: WorldgenConfig = {
  seed: "planet-genesis-prime",
  latBands: 48,
  lonBands: 96,
  seaLevel: 0,
  riverCount: 26,
  resourceDensity: 0.03,
};

export interface PlanetGrid {
  seed: string;
  latBands: number;
  lonBands: number;
  seaLevel: number;
  cells: PlanetCell[];
  /** precomputed 8-neighborhood with longitude wrap */
  neighbors: number[][];
  /** tectonic plate id per cell */
  plates: number[];
}

export function cellIndexAt(grid: PlanetGrid, lat: number, lon: number): number {
  const la = clamp(Math.floor(((lat + 90) / 180) * grid.latBands), 0, grid.latBands - 1);
  let lo = Math.floor(((lon + 180) / 360) * grid.lonBands) % grid.lonBands;
  if (lo < 0) lo += grid.lonBands;
  return la * grid.lonBands + lo;
}

export function neighborsOf(grid: PlanetGrid, index: number): number[] {
  return grid.neighbors[index] ?? [];
}

function buildNeighbors(latBands: number, lonBands: number): number[][] {
  const out: number[][] = new Array(latBands * lonBands);
  for (let la = 0; la < latBands; la++) {
    for (let lo = 0; lo < lonBands; lo++) {
      const idx = la * lonBands + lo;
      const list: number[] = [];
      for (let dLa = -1; dLa <= 1; dLa++) {
        for (let dLo = -1; dLo <= 1; dLo++) {
          if (dLa === 0 && dLo === 0) continue;
          const nLa = la + dLa;
          if (nLa < 0 || nLa >= latBands) continue; // poles do not wrap
          const nLo = (lo + dLo + lonBands) % lonBands;
          list.push(nLa * lonBands + nLo);
        }
      }
      out[idx] = list;
    }
  }
  return out;
}

/** Prevailing upwind direction (east = +1, west = -1) by latitude band. */
function upwindLonDirection(lat: number): number {
  const abs = Math.abs(lat);
  if (abs < 30) return +1; // trade winds blow from the east
  if (abs < 60) return -1; // westerlies
  return +1; // polar easterlies
}

const RESOURCE_TABLE: ReadonlyArray<{
  biomes: Biome[];
  type: ResourceType;
  chance: number;
  qty: [number, number];
  renew: number;
  value: number;
}> = [
  { biomes: ["mountains"], type: "iron", chance: 0.5, qty: [300, 900], renew: 0, value: 0.6 },
  { biomes: ["mountains"], type: "copper", chance: 0.35, qty: [200, 700], renew: 0, value: 0.55 },
  { biomes: ["mountains", "volcanic"], type: "gold", chance: 0.22, qty: [60, 220], renew: 0, value: 0.95 },
  { biomes: ["volcanic"], type: "crystal", chance: 0.3, qty: [40, 160], renew: 0, value: 0.9 },
  { biomes: ["mountains", "steppe"], type: "coal", chance: 0.3, qty: [250, 800], renew: 0, value: 0.5 },
  { biomes: ["desert", "swamp", "tundra"], type: "oil", chance: 0.26, qty: [200, 700], renew: 0, value: 0.85 },
  { biomes: ["tundra", "mountains"], type: "uranium", chance: 0.1, qty: [30, 120], renew: 0, value: 1 },
  { biomes: ["temperate_forest", "rainforest"], type: "timber", chance: 0.55, qty: [150, 500], renew: 0.02, value: 0.4 },
  { biomes: ["plains", "steppe"], type: "grain", chance: 0.5, qty: [200, 600], renew: 0.08, value: 0.45 },
  { biomes: ["plains", "swamp"], type: "fertile_soil", chance: 0.4, qty: [150, 500], renew: 0.03, value: 0.55 },
  { biomes: ["ocean", "coast"], type: "fish", chance: 0.45, qty: [200, 700], renew: 0.06, value: 0.35 },
  { biomes: ["plains", "temperate_forest", "steppe", "swamp"], type: "fresh_water", chance: 0.35, qty: [200, 800], renew: 0.1, value: 0.5 },
];

export function generatePlanet(config: Partial<WorldgenConfig> = {}): PlanetGrid {
  const cfg: WorldgenConfig = { ...DEFAULT_WORLDGEN, ...config };
  const { latBands, lonBands } = cfg;
  const base = new Simplex3(`${cfg.seed}:base`);
  const ridge = new Simplex3(`${cfg.seed}:ridge`);
  const moistN = new Simplex3(`${cfg.seed}:moist`);
  const tempN = new Simplex3(`${cfg.seed}:temp`);
  const plates = new Worley2(`${cfg.seed}:plates`);
  const rng = rngFromString(`${cfg.seed}:placement`);

  const count = latBands * lonBands;
  const cells: PlanetCell[] = new Array(count);
  const plateIds: number[] = new Array(count);

  const dLat = 180 / latBands;
  const dLon = 360 / lonBands;

  // --- 1–3: height, plates -------------------------------------------------
  for (let la = 0; la < latBands; la++) {
    const lat = -90 + (la + 0.5) * dLat;
    const latRad = (lat * Math.PI) / 180;
    for (let lo = 0; lo < lonBands; lo++) {
      const lon = -180 + (lo + 0.5) * dLon;
      const lonRad = (lon * Math.PI) / 180;
      const x = Math.cos(latRad) * Math.cos(lonRad);
      const y = Math.cos(latRad) * Math.sin(lonRad);
      const z = Math.sin(latRad);
      const idx = la * lonBands + lo;

      const continent = base.fbm(x * 1.6, y * 1.6, z * 1.6, 5);
      const mountain = ridge.ridged(x * 3.1, y * 3.1, z * 3.1, 4);

      // tectonic plate id + boundary proximity
      const plateNoise = plates.noise(x * 2.2 + 10, y * 2.2 + z * 1.1 + 10);
      const plateId = Math.floor(plateNoise * 14);
      plateIds[idx] = plateId;

      let height = continent * 0.75 + mountain * 0.42 - 0.1;
      // polar squash keeps ice caps plausible
      height -= Math.pow(Math.abs(lat) / 90, 6) * 0.08;

      const temperature = 0;
      cells[idx] = {
        index: idx,
        lat,
        lon,
        height,
        temperature,
        moisture: 0,
        biome: "ocean",
        fertility: 0,
        pollution: 0,
        river: false,
        volcanic: false,
        ownerId: null,
        resources: [],
      };
    }
  }

  const neighbors = buildNeighbors(latBands, lonBands);

  // --- plate boundaries: volcanic hotspots + mountain uplift ---------------
  for (let idx = 0; idx < count; idx++) {
    const cell = cells[idx]!;
    let boundary = false;
    for (const n of neighbors[idx]!) {
      if (plateIds[n] !== plateIds[idx]) {
        boundary = true;
        break;
      }
    }
    if (boundary && cell.height > -0.05) {
      cell.height += 0.12;
      if (cell.height > 0.15) {
        cell.volcanic = rng.chance(0.16);
      }
    }
  }

  // --- 4–6: temperature & moisture ----------------------------------------
  const distToOcean = computeOceanDistance(cells, neighbors);
  for (let idx = 0; idx < count; idx++) {
    const cell = cells[idx]!;
    const latRad = (cell.lat * Math.PI) / 180;
    const lonRad = (cell.lon * Math.PI) / 180;
    const x = Math.cos(latRad) * Math.cos(lonRad);
    const y = Math.cos(latRad) * Math.sin(lonRad);
    const z = Math.sin(latRad);

    const latFactor = 1 - Math.pow(Math.abs(cell.lat) / 90, 1.25);
    let temperature = latFactor + tempN.fbm(x * 2.4, y * 2.4, z * 2.4, 3) * 0.16;
    temperature -= Math.max(0, cell.height) * 0.38; // altitude lapse
    cell.temperature = clamp01(temperature);

    if (cell.height < cfg.seaLevel) {
      cell.moisture = 1;
      continue;
    }
    const oceanInfluence = clamp01(1 - distToOcean[idx]! / 10);
    let moisture =
      oceanInfluence * 0.55 +
      clamp01(0.5 + moistN.fbm(x * 2.8, y * 2.8, z * 2.8, 4) * 0.6) * 0.45;

    // orographic rain shadow: sample upwind along longitude
    const dir = upwindLonDirection(cell.lat);
    let upwindPeak = -Infinity;
    let cursor = idx;
    for (let step = 0; step < 5; step++) {
      const la = Math.floor(cursor / lonBands);
      const lo = ((cursor % lonBands) + dir + lonBands) % lonBands;
      cursor = la * lonBands + lo;
      upwindPeak = Math.max(upwindPeak, cells[cursor]!.height);
    }
    if (upwindPeak > cell.height && upwindPeak > 0.35) {
      moisture *= clamp01(1 - (upwindPeak - cell.height) * 0.8);
    }
    cell.moisture = clamp01(moisture);
  }

  // --- 7: rivers ------------------------------------------------------------
  carveRivers(cells, neighbors, rng, cfg);

  // --- 8–9: biomes, fertility, resources ------------------------------------
  const depositTarget = Math.round(
    cells.filter((c) => c.height >= cfg.seaLevel).length * cfg.resourceDensity,
  );
  let deposits = 0;
  const shuffled = rng.shuffled(cells.map((c) => c.index));
  for (const idx of shuffled) {
    const cell = cells[idx]!;
    const coastalWater =
      cell.height < cfg.seaLevel &&
      neighbors[idx]!.some((n) => cells[n]!.height >= cfg.seaLevel);
    cell.biome = classifyBiome({
      height: cell.height,
      latitude: cell.lat,
      temperature: cell.temperature,
      moisture: cell.moisture,
      volcanic: cell.volcanic,
      coastalWater,
      river: cell.river,
    });
    cell.fertility = clamp01(
      BIOME_FERTILITY[cell.biome] + (cell.river ? 0.25 : 0) + cell.moisture * 0.1,
    );
    if (deposits < depositTarget) {
      const deposit = rollDeposit(cell.biome, rng, idx, deposits);
      if (deposit) {
        cell.resources.push(deposit);
        deposits++;
      }
    }
  }

  return {
    seed: cfg.seed,
    latBands,
    lonBands,
    seaLevel: cfg.seaLevel,
    cells,
    neighbors,
    plates: plateIds,
  };
}

function computeOceanDistance(
  cells: PlanetCell[],
  neighbors: number[][],
): number[] {
  const dist = new Array<number>(cells.length).fill(Infinity);
  let frontier: number[] = [];
  for (const cell of cells) {
    if (cell.height < 0) {
      dist[cell.index] = 0;
      frontier.push(cell.index);
    }
  }
  let d = 0;
  while (frontier.length > 0 && d < 24) {
    d++;
    const next: number[] = [];
    for (const idx of frontier) {
      for (const n of neighbors[idx]!) {
        if (dist[n] === Infinity) {
          dist[n] = d;
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  for (let i = 0; i < dist.length; i++) if (dist[i] === Infinity) dist[i] = 24;
  return dist;
}

function carveRivers(
  cells: PlanetCell[],
  neighbors: number[][],
  rng: Rng,
  cfg: WorldgenConfig,
): void {
  const candidates = cells
    .filter((c) => c.height > 0.28 && c.moisture > 0.5)
    .sort((a, b) => b.height - a.height);
  const wanted = Math.min(cfg.riverCount, candidates.length);
  const used = new Set<number>();
  for (let i = 0; i < wanted; i++) {
    const start = rng.pick(candidates).index;
    if (used.has(start)) continue;
    used.add(start);
    let cursor = start;
    for (let step = 0; step < 42; step++) {
      const cell = cells[cursor]!;
      if (cell.height < cfg.seaLevel) break;
      cell.river = true;
      cell.moisture = clamp01(cell.moisture + 0.2);
      let lowest = cursor;
      for (const n of neighbors[cursor]!) {
        if (cells[n]!.height < cells[lowest]!.height) lowest = n;
      }
      if (lowest === cursor) break; // local basin — river ends in a lake
      cursor = lowest;
    }
  }
}

function rollDeposit(biome: Biome, rng: Rng, cell: number, seq: number): ResourceDeposit | null {
  for (const row of RESOURCE_TABLE) {
    if (!row.biomes.includes(biome)) continue;
    if (!rng.chance(row.chance * 0.35)) continue;
    return {
      id: `res-${cell}-${seq}`,
      type: row.type,
      quantity: Math.round(rng.range(row.qty[0], row.qty[1])),
      renewRate: row.renew,
      value: row.value,
      discovered: false,
    };
  }
  return null;
}
