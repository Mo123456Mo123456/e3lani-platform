import { fnv1a, mix32 } from "./hash.js";

/**
 * Deterministic, fully serializable RNG.
 *
 * Instead of a hidden mutable state (like mulberry32 closures), every draw is a
 * pure function of (seed, stream, counter). The counter table is part of the
 * world state, so snapshots and replays reproduce identical sequences.
 * Separate named streams ("climate", "ecology", ...) guarantee that adding a
 * draw in one system never perturbs the randomness of another.
 */
export interface RngState {
  seed: number;
  counters: Record<string, number>;
}

export function createRng(seed: number): RngState {
  return { seed, counters: {} };
}

function draw(state: RngState, stream: string): number {
  const n = state.counters[stream] ?? 0;
  state.counters[stream] = n + 1;
  const h = mix32(state.seed ^ mix32(fnv1a(stream) + n * 0x9e3779b9));
  return h / 4294967296;
}

/** Uniform float in [0, 1). */
export function random(state: RngState, stream: string): number {
  return draw(state, stream);
}

/** Uniform float in [min, max). */
export function range(state: RngState, stream: string, min: number, max: number): number {
  return min + draw(state, stream) * (max - min);
}

/** Uniform integer in [min, max]. */
export function int(state: RngState, stream: string, min: number, max: number): number {
  return Math.floor(range(state, stream, min, max + 1 - 1e-9));
}

/** True with probability p. */
export function chance(state: RngState, stream: string, p: number): boolean {
  return draw(state, stream) < p;
}

/** Pick a deterministic element from a non-empty array. */
export function pick<T>(state: RngState, stream: string, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() from empty array");
  return items[Math.floor(draw(state, stream) * items.length * 0.999999)] as T;
}

/** Gaussian-ish variable in [-1, 1] via sum of uniforms (central limit). */
export function gauss(state: RngState, stream: string): number {
  return (draw(state, stream) + draw(state, stream) + draw(state, stream)) / 1.5 - 1;
}

/** Deterministic shuffle (Fisher–Yates driven by the seeded stream). */
export function shuffle<T>(state: RngState, stream: string, items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(draw(state, stream) * (i + 1) * 0.999999);
    const a = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = a;
  }
  return arr;
}
