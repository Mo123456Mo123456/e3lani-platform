import { mix32 } from "./hash.js";
import { lerp, smoothstep } from "./math.js";

/**
 * Procedural noise toolkit. Everything is a pure function of coordinates and
 * seed — no permutation tables in memory, no hidden state — so planet
 * generation is reproducible bit-for-bit from the seed alone.
 */

function latticeHash(seed: number, x: number, y: number, z: number): number {
  let h = seed >>> 0;
  h = mix32(h ^ mix32(x));
  h = mix32(h ^ mix32(y));
  h = mix32(h ^ mix32(z));
  return h / 4294967296;
}

/** Trilinear value noise on the integer lattice. */
export function valueNoise3(seed: number, x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smoothstep(0, 1, x - x0);
  const ty = smoothstep(0, 1, y - y0);
  const tz = smoothstep(0, 1, z - z0);

  const c000 = latticeHash(seed, x0, y0, z0);
  const c100 = latticeHash(seed, x0 + 1, y0, z0);
  const c010 = latticeHash(seed, x0, y0 + 1, z0);
  const c110 = latticeHash(seed, x0 + 1, y0 + 1, z0);
  const c001 = latticeHash(seed, x0, y0, z0 + 1);
  const c101 = latticeHash(seed, x0 + 1, y0, z0 + 1);
  const c011 = latticeHash(seed, x0, y0 + 1, z0 + 1);
  const c111 = latticeHash(seed, x0 + 1, y0 + 1, z0 + 1);

  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

/** Fractal Brownian motion over value noise, output in [0, 1]. */
export function fbm3(
  seed: number,
  x: number,
  y: number,
  z: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(seed + i * 101, x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal — sharp mountain-like features, output in [0, 1]. */
export function ridged3(seed: number, x: number, y: number, z: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise3(seed + i * 733, x * freq, y * freq, z * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Worley (cellular) noise: distance to nearest feature point, in [0, ~1]. */
export function worley3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let minDist = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const cz = zi + dz;
        const px = cx + latticeHash(seed, cx, cy, cz);
        const py = cy + latticeHash(seed + 31, cx, cy, cz);
        const pz = cz + latticeHash(seed + 57, cx, cy, cz);
        const d = Math.sqrt((px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2);
        if (d < minDist) minDist = d;
      }
    }
  }
  return minDist;
}
