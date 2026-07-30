import { SeededRng } from "./rng.js";

/** Value noise + fractal Brownian motion for procedural height/moisture/temp. */
export class FractalNoise {
  private readonly grads: Float64Array;
  private readonly size: number;

  constructor(seed: number, size = 256) {
    this.size = size;
    const rng = new SeededRng(seed);
    this.grads = new Float64Array(size * size);
    for (let i = 0; i < this.grads.length; i++) {
      this.grads[i] = rng.next() * 2 - 1;
    }
  }

  private sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = this.at(x0, y0);
    const n10 = this.at(x0 + 1, y0);
    const n01 = this.at(x0, y0 + 1);
    const n11 = this.at(x0 + 1, y0 + 1);
    const ix0 = n00 * (1 - sx) + n10 * sx;
    const ix1 = n01 * (1 - sx) + n11 * sx;
    return ix0 * (1 - sy) + ix1 * sy;
  }

  private at(x: number, y: number): number {
    const s = this.size;
    const xi = ((x % s) + s) % s;
    const yi = ((y % s) + s) % s;
    return this.grads[yi * s + xi]!;
  }

  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
