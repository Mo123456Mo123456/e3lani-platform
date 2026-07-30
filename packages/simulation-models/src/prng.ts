export type Seed = string | number;

/** FNV-1a with explicit 32-bit multiplication for cross-runtime stability. */
export function hashSeed(seed: Seed): number {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashHex(value: string): string {
  return hashSeed(value).toString(16).padStart(8, "0");
}

/**
 * Mulberry32 seeded generator. All operations are integer/IEEE-754 operations,
 * so a seed yields the same sequence in browsers and Node.js.
 */
export class SeededRandom {
  readonly seed: string;
  private state: number;

  constructor(seed: Seed) {
    this.seed = String(seed);
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  range(minimum: number, maximum: number): number {
    if (!(maximum >= minimum)) {
      throw new RangeError("maximum must be greater than or equal to minimum");
    }
    return minimum + (maximum - minimum) * this.next();
  }

  integer(minimum: number, maximumInclusive: number): number {
    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximumInclusive) ||
      maximumInclusive < minimum
    ) {
      throw new RangeError("integer bounds are invalid");
    }
    return Math.floor(this.range(minimum, maximumInclusive + 1));
  }

  chance(probability: number): boolean {
    if (probability < 0 || probability > 1 || !Number.isFinite(probability)) {
      throw new RangeError("probability must be in [0, 1]");
    }
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("cannot pick from an empty collection");
    }
    return items[this.integer(0, items.length - 1)] as T;
  }

  fork(label: Seed): SeededRandom {
    return new SeededRandom(`${this.seed}:${String(label)}`);
  }
}
