/**
 * Deterministic seeded PRNG (Mulberry32).
 * Same seed + same call sequence => identical results.
 */
export class SeededRng {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inclusive integer range */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Cannot pick from empty array");
    return items[this.int(0, items.length - 1)]!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Derive a child RNG from a label for independent subsystems */
  fork(label: string): SeededRng {
    return new SeededRng(`${this.state}:${label}:${hashString(label)}`);
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Value noise helpers for procedural generation */
export function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
