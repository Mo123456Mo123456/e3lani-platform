import type { Biome, CausalLink, SimulationState, WorldEvent } from "@kawkab/shared-types";

export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Cannot pick from an empty list");
    return items[this.int(0, items.length - 1)] as T;
  }
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class PerlinNoise {
  private perm: number[];

  constructor(seed: string) {
    const rng = new SeededRandom(seed);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = p.length - 1; i > 0; i -= 1) {
      const j = rng.int(0, i);
      [p[i], p[j]] = [p[j] as number, p[i] as number];
    }
    this.perm = [...p, ...p];
  }

  noise2D(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = this.perm[this.perm[xi] as number + yi] as number;
    const ab = this.perm[this.perm[xi] as number + yi + 1] as number;
    const ba = this.perm[this.perm[xi + 1] as number + yi] as number;
    const bb = this.perm[this.perm[xi + 1] as number + yi + 1] as number;
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return (lerp(x1, x2, v) + 1) / 2;
  }

  octave2D(x: number, y: number, octaves = 4, persistence = 0.5): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let max = 0;
    for (let i = 0; i < octaves; i += 1) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return clamp01(total / max);
  }
}

export const SimplexNoise = PerlinNoise;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function classifyBiome(height: number, moisture: number, temperature: number, volcanic = false): Biome {
  if (height < 0.28) return "deep_ocean";
  if (height < 0.36) return "shallow_ocean";
  if (height < 0.4) return "beach";
  if (volcanic && height > 0.72) return "volcanic";
  if (height > 0.82) return temperature < 0.35 ? "ice_cap" : "mountain";
  if (temperature < 0.18) return "ice_cap";
  if (temperature < 0.32) return moisture > 0.45 ? "taiga" : "tundra";
  if (moisture < 0.18) return "desert";
  if (moisture < 0.34) return temperature > 0.62 ? "savanna" : "grassland";
  if (moisture > 0.78) return temperature > 0.58 ? "rainforest" : "wetland";
  return temperature > 0.58 ? "temperate_forest" : "grassland";
}

export interface PopulationInput {
  population: number;
  preyPopulation?: number;
  predatorPopulation?: number;
  growthRate: number;
  predationRate?: number;
  predatorEfficiency?: number;
  mortalityRate?: number;
  carryingCapacity: number;
}

export function updatePopulation(input: PopulationInput): number {
  const prey = input.preyPopulation ?? input.population;
  const predators = input.predatorPopulation ?? 0;
  const predationRate = input.predationRate ?? 0.0002;
  const mortality = input.mortalityRate ?? 0.03;
  const efficiency = input.predatorEfficiency ?? 0.02;
  const logistic = input.growthRate * input.population * (1 - input.population / Math.max(1, input.carryingCapacity));
  const predation = predationRate * prey * predators;
  const predatorSupport = efficiency * predation;
  const next = input.population + logistic - predation - mortality * predators + predatorSupport;
  return Math.max(0, Math.min(input.carryingCapacity, Math.round(next)));
}

export interface WarScoreInput {
  resourceScarcity: number;
  borderFriction: number;
  culturalDistance: number;
  recentWarMemory: number;
  tradeDependency: number;
  stability: number;
}

export function scoreWarProbability(input: WarScoreInput): number {
  const pressure = input.resourceScarcity * 0.32 + input.borderFriction * 0.22 + input.culturalDistance * 0.18 + input.recentWarMemory * 0.16;
  const dampening = input.tradeDependency * 0.18 + input.stability * 0.24;
  return clamp01(pressure - dampening + 0.08);
}

export interface WeightedEdge {
  to: string;
  cost: number;
}

export type WeightedGraph = Record<string, WeightedEdge[]>;

export function dijkstra(graph: WeightedGraph, start: string, goal: string): { distance: number; path: string[] } {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | undefined>();
  const queue = new Set<string>(Object.keys(graph));
  queue.add(start);
  queue.add(goal);
  for (const node of queue) distances.set(node, node === start ? 0 : Number.POSITIVE_INFINITY);

  while (queue.size > 0) {
    let current: string | undefined;
    for (const node of queue) {
      if (!current || (distances.get(node) ?? Infinity) < (distances.get(current) ?? Infinity)) current = node;
    }
    if (!current || current === goal) break;
    queue.delete(current);
    for (const edge of graph[current] ?? []) {
      const nextDistance = (distances.get(current) ?? Infinity) + edge.cost;
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, current);
        queue.add(edge.to);
      }
    }
  }

  const distance = distances.get(goal) ?? Infinity;
  if (!Number.isFinite(distance)) return { distance, path: [] };
  const path: string[] = [];
  let node: string | undefined = goal;
  while (node) {
    path.unshift(node);
    node = previous.get(node);
  }
  return { distance, path };
}

export class CausalGraph {
  readonly events = new Map<string, WorldEvent>();
  readonly links: CausalLink[] = [];

  addEvent(event: WorldEvent): void {
    if (event.causeEventIds.length === 0) throw new Error(`Event ${event.id} has no cause`);
    this.events.set(event.id, event);
    for (const causeId of event.causeEventIds) {
      this.links.push({ id: `${causeId}->${event.id}`, fromEventId: causeId, toEventId: event.id, reason: event.description, weight: 1 });
    }
  }

  causesOf(eventId: string): WorldEvent[] {
    return this.links
      .filter((link) => link.toEventId === eventId)
      .map((link) => this.events.get(link.fromEventId))
      .filter((event): event is WorldEvent => Boolean(event));
  }
}

export interface DeterministicTickRunner {
  readonly seed: string;
  runTick(state: SimulationState): SimulationState;
}

export function checksum(value: unknown): string {
  const text = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}
