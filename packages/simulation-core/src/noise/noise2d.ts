import { SeededRandom } from "../rng/seeded-random.js";

/** Simplex-like value noise with fractal FBM — deterministic from seed */
export class Noise2D {
  private readonly perm: number[];

  constructor(rng: SeededRandom) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    this.perm = [...p, ...p];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** Classic Perlin noise in [-1, 1] */
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const aa = this.perm[this.perm[X]! + Y]!;
    const ab = this.perm[this.perm[X]! + Y + 1]!;
    const ba = this.perm[this.perm[X + 1]! + Y]!;
    const bb = this.perm[this.perm[X + 1]! + Y + 1]!;
    const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = this.lerp(
      this.grad(ab, xf, yf - 1),
      this.grad(bb, xf - 1, yf - 1),
      u,
    );
    return this.lerp(x1, x2, v);
  }

  /** Fractal Brownian Motion */
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

  /** Worley / cellular noise (distance to nearest feature point) */
  worley(x: number, y: number, scale = 1): number {
    const sx = x * scale;
    const sy = y * scale;
    const xi = Math.floor(sx);
    const yi = Math.floor(sy);
    let minD = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const h = this.hash2(cx, cy);
        const fx = cx + (h % 1000) / 1000;
        const fy = cy + (Math.floor(h / 1000) % 1000) / 1000;
        const d = (fx - sx) ** 2 + (fy - sy) ** 2;
        if (d < minD) minD = d;
      }
    }
    return Math.sqrt(minD);
  }

  private hash2(x: number, y: number): number {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return (n ^ (n >> 16)) >>> 0;
  }
}
