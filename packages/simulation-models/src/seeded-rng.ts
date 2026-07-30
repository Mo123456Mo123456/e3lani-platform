/**
 * Deterministic PRNG: Mulberry32 + xorshift mixing.
 * Same seed always yields the same sequence.
 */

function hashSeed(seed: string | number): number {
  if (typeof seed === "number") {
    return (seed >>> 0) || 1;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) || 1;
}

export class SeededRNG {
  private state: number;
  readonly seedValue: number;
  readonly seedSource: string | number;

  constructor(seed: string | number) {
    this.seedSource = seed;
    this.seedValue = hashSeed(seed);
    this.state = this.seedValue;
  }

  /** Mulberry32 step */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Float in [0, 1) */
  nextFloat(): number {
    return this.next() / 4294967296;
  }

  /** Inclusive integer range [min, max] */
  nextInt(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Cannot pick from empty array");
    return arr[this.nextInt(0, arr.length - 1)]!;
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** Independent child RNG derived from current seed + salt */
  fork(salt: string | number): SeededRNG {
    const mixed = `${this.seedValue}:${String(salt)}`;
    return new SeededRNG(mixed);
  }

  /** Gaussian approx via Box-Muller, mean 0 std 1 */
  nextGaussian(): number {
    const u1 = Math.max(1e-12, this.nextFloat());
    const u2 = this.nextFloat();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

export function createRng(seed: string | number): SeededRNG {
  return new SeededRNG(seed);
}
