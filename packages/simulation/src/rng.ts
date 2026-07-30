/**
 * Deterministic randomness. Everything stochastic in the engine flows through
 * RngStream forks, so a world can be replayed bit-exactly from (seed, ops).
 *
 * Forks derive from the stream's BASE seed, not its draw counter — this keeps
 * sub-streams stable no matter how many numbers were already drawn.
 */

export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashCombine(...nums: number[]): number {
  let h = 0x811c9dc5;
  for (const n of nums) {
    h ^= n >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

export function seedFromString(seed: string): number {
  return fnv1a(seed.normalize("NFC"));
}

export class RngStream {
  private state: number;
  private baseSeed: number;

  constructor(seed: number | string, label = "") {
    const base = typeof seed === "string" ? seedFromString(seed) : seed >>> 0;
    this.baseSeed = label ? hashCombine(base, fnv1a(label)) : base;
    this.state = this.baseSeed || 0x9e3779b9;
  }

  /** [0, 1) — mulberry32 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** uniform integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }
    return items;
  }

  /** deterministic gaussian-ish in [-1,1] */
  spread(): number {
    return this.next() + this.next() - 1;
  }

  fork(label: string): RngStream {
    const child = new RngStream(0);
    child.baseSeed = hashCombine(this.baseSeed, fnv1a(label)) || 0x9e3779b9;
    child.state = child.baseSeed;
    return child;
  }
}

/** Short deterministic id, e.g. ev_3fa9c21b */
export function deterministicId(prefix: string, ...parts: Array<string | number>): string {
  return `${prefix}_${hashCombine(...parts.map((p) => (typeof p === "number" ? p >>> 0 : fnv1a(p)))).toString(16)}`;
}
