import { SeededRng, fade, lerp, clamp } from "./rng.js";

/** Simplex-like value noise over a 2D lattice with seeded permutation */
export class Noise2D {
  private perm: number[];

  constructor(rng: SeededRng) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    this.perm = [...p, ...p];
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = this.perm[this.perm[X]! + Y]!;
    const ab = this.perm[this.perm[X]! + Y + 1]!;
    const ba = this.perm[this.perm[X + 1]! + Y]!;
    const bb = this.perm[this.perm[X + 1]! + Y + 1]!;
    const x1 = lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

export type GeneratedCell = {
  x: number;
  y: number;
  lat: number;
  lon: number;
  height: number;
  moisture: number;
  temperature: number;
  biome: string;
  fertility: number;
  isOcean: boolean;
};

export type GeneratedWorld = {
  seed: string;
  width: number;
  height: number;
  cells: GeneratedCell[];
  regionCount: number;
};

function classifyBiome(
  height: number,
  moisture: number,
  temperature: number,
): string {
  if (height < 0.28) return "ocean";
  if (height < 0.32) return "coast";
  if (temperature < 0.18) return height > 0.72 ? "ice" : "tundra";
  if (height > 0.78) return temperature > 0.65 ? "volcanic" : "mountain";
  if (moisture < 0.22 && temperature > 0.55) return "desert";
  if (moisture > 0.72 && temperature > 0.55) return "rainforest";
  if (moisture > 0.55) return "temperate_forest";
  if (moisture > 0.45 && temperature < 0.45) return "wetland";
  if (moisture < 0.4) return "steppe";
  return "plains";
}

/**
 * Procedural planet grid generation from a fixed seed.
 * Re-running with the same seed yields identical cells.
 */
export function generateWorld(seed: string, width = 64, height = 32): GeneratedWorld {
  const rng = new SeededRng(seed);
  const heightNoise = new Noise2D(rng.fork("height"));
  const moistNoise = new Noise2D(rng.fork("moisture"));
  const tempNoise = new Noise2D(rng.fork("temperature"));

  const cells: GeneratedCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      const lat = 90 - (y / (height - 1)) * 180;
      const lon = (x / (width - 1)) * 360 - 180;

      let h =
        0.55 * heightNoise.fbm(nx * 3.2, ny * 3.2, 6) +
        0.25 * heightNoise.fbm(nx * 8, ny * 8, 3) +
        0.2;
      // Continental shelf bias
      h = clamp(h * 0.85 + 0.08, 0, 1);

      const moisture = clamp(
        0.5 + 0.5 * moistNoise.fbm(nx * 4, ny * 4, 4) + (h < 0.32 ? 0.2 : 0),
        0,
        1,
      );
      const latitudeFactor = 1 - Math.abs(lat) / 90;
      const temperature = clamp(
        latitudeFactor * 0.75 +
          0.2 * tempNoise.fbm(nx * 2, ny * 2, 3) -
          Math.max(0, h - 0.55) * 0.6,
        0,
        1,
      );

      const biome = classifyBiome(h, moisture, temperature);
      const fertility = clamp(
        moisture * 0.55 + (1 - Math.abs(temperature - 0.55)) * 0.35 + (h > 0.32 && h < 0.65 ? 0.15 : 0),
        0,
        1,
      );

      cells.push({
        x,
        y,
        lat,
        lon,
        height: h,
        moisture,
        temperature,
        biome,
        fertility,
        isOcean: biome === "ocean",
      });
    }
  }

  return {
    seed,
    width,
    height,
    cells,
    regionCount: cells.filter((c) => !c.isOcean).length,
  };
}

/** Approximate river flow: water flows downhill from high moisture cells */
export function approximateRivers(
  world: GeneratedWorld,
  maxRivers = 40,
): Array<{ path: Array<{ x: number; y: number }> }> {
  const rng = new SeededRng(`${world.seed}:rivers`);
  const land = world.cells.filter((c) => !c.isOcean && c.height > 0.4);
  const rivers: Array<{ path: Array<{ x: number; y: number }> }> = [];
  const index = (x: number, y: number) => y * world.width + x;

  for (let i = 0; i < maxRivers && land.length > 0; i++) {
    const start = rng.pick(land);
    const path: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
    let current = start;
    for (let step = 0; step < 80; step++) {
      const neighbors = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]
        .map(([dx, dy]) => {
          const nx = current.x + dx!;
          const ny = current.y + dy!;
          if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) return null;
          return world.cells[index(nx, ny)]!;
        })
        .filter((c): c is GeneratedCell => !!c);

      neighbors.sort((a, b) => a.height - b.height);
      const next = neighbors[0];
      if (!next || next.height >= current.height) break;
      path.push({ x: next.x, y: next.y });
      current = next;
      if (current.isOcean) break;
    }
    if (path.length > 3) rivers.push({ path });
  }
  return rivers;
}
