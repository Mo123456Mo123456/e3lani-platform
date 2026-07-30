/**
 * Seeded procedural noise: 3D simplex (for seamless sampling on a sphere),
 * fractal Brownian motion, ridged multifractal, and 2D Worley (cellular).
 * All generators derive their permutation tables from a seed — no globals.
 */
import { createRng, hashString } from "./rng.js";

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

export class Simplex3 {
  private readonly perm: Uint8Array;
  private readonly permMod12: Uint8Array;

  constructor(seed: string | number) {
    const rng = createRng(typeof seed === "number" ? seed : hashString(seed));
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = p[i] as number;
      p[i] = p[j] as number;
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255] as number;
      this.permMod12[i] = (this.perm[i] as number) % 12;
    }
  }

  /** noise value in [-1, 1] */
  noise(xin: number, yin: number, zin: number): number {
    const F3 = 1 / 3;
    const G3 = 1 / 6;
    const perm = this.perm;
    const permMod12 = this.permMod12;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let n = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const g = (permMod12[ii + (perm[jj + (perm[kk] as number)] as number)] as number) * 3;
      t0 *= t0;
      n += t0 * t0 * (GRAD3[g]! * x0 + GRAD3[g + 1]! * y0 + GRAD3[g + 2]! * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const g = (permMod12[ii + i1 + (perm[jj + j1 + (perm[kk + k1] as number)] as number)] as number) * 3;
      t1 *= t1;
      n += t1 * t1 * (GRAD3[g]! * x1 + GRAD3[g + 1]! * y1 + GRAD3[g + 2]! * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const g = (permMod12[ii + i2 + (perm[jj + j2 + (perm[kk + k2] as number)] as number)] as number) * 3;
      t2 *= t2;
      n += t2 * t2 * (GRAD3[g]! * x2 + GRAD3[g + 1]! * y2 + GRAD3[g + 2]! * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const g = (permMod12[ii + 1 + (perm[jj + 1 + (perm[kk + 1] as number)] as number)] as number) * 3;
      t3 *= t3;
      n += t3 * t3 * (GRAD3[g]! * x3 + GRAD3[g + 1]! * y3 + GRAD3[g + 2]! * z3);
    }
    return 32 * n;
  }

  /** fractal Brownian motion, output roughly [-1, 1] */
  fbm(x: number, y: number, z: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** ridged multifractal, output [0, 1] — sharp mountain-like crests */
  ridged(x: number, y: number, z: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.noise(x * freq, y * freq, z * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

/**
 * Seeded 2D Worley (cellular) noise — distance to nearest feature point.
 * Used for plate/region approximations. Output normalized [0, 1].
 */
export class Worley2 {
  private readonly rngSeed: number;
  constructor(seed: string | number) {
    this.rngSeed = typeof seed === "number" ? seed : hashString(seed);
  }

  private featurePoint(cx: number, cy: number): [number, number] {
    const rng = createRng(hashString(`${this.rngSeed}:${cx}:${cy}`));
    return [cx + rng.next(), cy + rng.next()];
  }

  /** F1 distance normalized to ~[0,1] */
  noise(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let minDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const [px, py] = this.featurePoint(xi + dx, yi + dy);
        const d = Math.hypot(px - x, py - y);
        if (d < minDist) minDist = d;
      }
    }
    return Math.min(1, minDist / Math.SQRT2);
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
