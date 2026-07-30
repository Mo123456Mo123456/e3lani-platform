import { SeededRandom } from "./rng.js";

/** Value noise with smooth interpolation — deterministic from seed */
export class FractalNoise {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    const rng = new SeededRandom(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
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

  /** 2D Perlin-like noise in [-1, 1] */
  noise2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const aa = this.perm[X + this.perm[Y]!]!;
    const ab = this.perm[X + this.perm[Y + 1]!]!;
    const ba = this.perm[X + 1 + this.perm[Y]!]!;
    const bb = this.perm[X + 1 + this.perm[Y + 1]!]!;
    const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return this.lerp(x1, x2, v);
  }

  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Worley-like cellular noise [0,1] */
  worley(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let minDist = 1e9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const h = this.perm[(cx * 57 + cy * 131) & 255]!;
        const px = cx + h / 255;
        const py = cy + this.perm[(h + 17) & 255]! / 255;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < minDist) minDist = d;
      }
    }
    return Math.sqrt(minDist);
  }
}
