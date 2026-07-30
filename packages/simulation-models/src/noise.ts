/**
 * Seeded 2D/3D value + simplex-style noise, fBm, ridged, and Worley.
 */

import { SeededRNG } from "./seeded-rng.js";

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function grad2(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function grad3(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class NoiseGenerator {
  private readonly perm: Uint8Array;

  constructor(seed: string | number | SeededRNG) {
    const rng = seed instanceof SeededRNG ? seed.fork("noise") : new SeededRNG(seed).fork("noise");
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates with seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const tmp = p[i]!;
      p[i] = p[j]!;
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }

  private hash2(xi: number, yi: number): number {
    return this.perm[(this.perm[xi & 255]! + yi) & 255]!;
  }

  private hash3(xi: number, yi: number, zi: number): number {
    return this.perm[(this.perm[(this.perm[xi & 255]! + yi) & 255]! + zi) & 255]!;
  }

  /** Classic Perlin-style gradient noise in [-1, 1] */
  noise2D(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = this.hash2(xi, yi);
    const ab = this.hash2(xi, yi + 1);
    const ba = this.hash2(xi + 1, yi);
    const bb = this.hash2(xi + 1, yi + 1);

    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  noise3D(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const aaa = this.hash3(xi, yi, zi);
    const aba = this.hash3(xi, yi + 1, zi);
    const baa = this.hash3(xi + 1, yi, zi);
    const bba = this.hash3(xi + 1, yi + 1, zi);
    const aab = this.hash3(xi, yi, zi + 1);
    const abb = this.hash3(xi, yi + 1, zi + 1);
    const bab = this.hash3(xi + 1, yi, zi + 1);
    const bbb = this.hash3(xi + 1, yi + 1, zi + 1);

    const x1 = lerp(grad3(aaa, xf, yf, zf), grad3(baa, xf - 1, yf, zf), u);
    const x2 = lerp(grad3(aba, xf, yf - 1, zf), grad3(bba, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(grad3(aab, xf, yf, zf - 1), grad3(bab, xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad3(abb, xf, yf - 1, zf - 1), grad3(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w);
  }

  /** Fractal Brownian motion */
  fbm2D(
    x: number,
    y: number,
    octaves = 5,
    lacunarity = 2,
    gain = 0.5,
  ): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / max;
  }

  /** Ridged multifractal */
  ridged2D(
    x: number,
    y: number,
    octaves = 5,
    lacunarity = 2,
    gain = 0.5,
  ): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2D(x * freq, y * freq));
      const ridge = n * n;
      sum += ridge * amp;
      max += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / max;
  }

  /**
   * Worley / cellular noise — returns F1 distance in ~[0, 1].
   */
  worley2D(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let minDist = Infinity;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = xi + ox;
        const cy = yi + oy;
        // feature point from hash
        const h = this.hash2(cx & 255, cy & 255);
        const fx = cx + ((h & 15) / 15);
        const fy = cy + (((h >> 4) & 15) / 15);
        const dx = fx - x;
        const dy = fy - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
    }
    return Math.min(1, minDist);
  }
}

/** Convenience free functions */
const cache = new Map<string, NoiseGenerator>();

function getNoise(seed: string | number | SeededRNG): NoiseGenerator {
  if (seed instanceof SeededRNG) {
    const key = `rng:${seed.seedValue}`;
    let g = cache.get(key);
    if (!g) {
      g = new NoiseGenerator(seed);
      cache.set(key, g);
    }
    return g;
  }
  const key = String(seed);
  let g = cache.get(key);
  if (!g) {
    g = new NoiseGenerator(seed);
    cache.set(key, g);
  }
  return g;
}

export function noise2D(seed: string | number | SeededRNG, x: number, y: number): number {
  return getNoise(seed).noise2D(x, y);
}

export function noise3D(
  seed: string | number | SeededRNG,
  x: number,
  y: number,
  z: number,
): number {
  return getNoise(seed).noise3D(x, y, z);
}

export function fbm2D(
  seed: string | number | SeededRNG,
  x: number,
  y: number,
  octaves = 5,
): number {
  return getNoise(seed).fbm2D(x, y, octaves);
}

export function ridged2D(
  seed: string | number | SeededRNG,
  x: number,
  y: number,
  octaves = 5,
): number {
  return getNoise(seed).ridged2D(x, y, octaves);
}

export function worley2D(seed: string | number | SeededRNG, x: number, y: number): number {
  return getNoise(seed).worley2D(x, y);
}
