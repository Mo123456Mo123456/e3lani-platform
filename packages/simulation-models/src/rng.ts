/**
 * Deterministic seeded random streams.
 *
 * The whole engine derives randomness from these streams only — `Math.random`
 * and time-based entropy are forbidden inside simulation code. Streams can be
 * forked by label so each subsystem consumes an independent, reproducible
 * sequence.
 */

/** xmur3 string hash -> 32bit seed. */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** FNV-1a hex digest — portable stable hashing for state fingerprints. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function fingerprint(value: unknown): string {
  return stableHash(stableStringify(value));
}

export interface Rng {
  /** uniform float in [0, 1) */
  next(): number;
  /** uniform float in [min, max) */
  range(min: number, max: number): number;
  /** uniform integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** true with probability p */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** approximately standard normal via Box–Muller */
  gaussian(): number;
  /** deterministic child stream */
  fork(label: string): Rng;
  /** shuffle copy (Fisher–Yates) */
  shuffled<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, deterministic across JS engines. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const api: Rng = {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error("pick() from empty array");
      return items[Math.floor(next() * items.length)] as T;
    },
    gaussian: () => {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork: (label) => createRng(hashString(`${seed}:${label}:${state}`)),
    shuffled: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i] as T;
        copy[i] = copy[j] as T;
        copy[j] = tmp;
      }
      return copy;
    },
  };
  return api;
}

export function rngFromString(seed: string): Rng {
  return createRng(hashString(seed));
}
