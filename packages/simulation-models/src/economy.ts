import { clamp } from "./rng.js";

export type ResourceNode = {
  id: string;
  name: string;
  regionId: string;
  quantity: number;
  regenRate: number;
  extractRate: number;
  value: number;
  environmentalImpact: number;
  controllerCivId?: string;
};

export type CityNode = {
  id: string;
  civilizationId: string;
  regionId: string;
  name: string;
  demand: number;
  supply: number;
};

export type TradeEdge = {
  fromCityId: string;
  toCityId: string;
  distance: number;
  risk: number;
  cost: number;
};

/** Dijkstra shortest path on an adjacency list */
export function dijkstra(
  nodes: string[],
  edges: Array<{ from: string; to: string; weight: number }>,
  start: string,
  goal: string,
): { path: string[]; cost: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const q = new Set(nodes);
  for (const n of nodes) {
    dist.set(n, Infinity);
    prev.set(n, null);
  }
  dist.set(start, 0);

  while (q.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of q) {
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null || best === Infinity) break;
    q.delete(u);
    if (u === goal) break;
    for (const e of edges) {
      if (e.from !== u || !q.has(e.to)) continue;
      const alt = best + e.weight;
      if (alt < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, alt);
        prev.set(e.to, u);
      }
    }
  }

  if ((dist.get(goal) ?? Infinity) === Infinity) return null;
  const path: string[] = [];
  let cur: string | null = goal;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return { path, cost: dist.get(goal)! };
}

export function buildTradeRoutes(
  cities: CityNode[],
  distanceFn: (a: CityNode, b: CityNode) => number,
  riskFn: (a: CityNode, b: CityNode) => number,
): TradeEdge[] {
  const edges: TradeEdge[] = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const a = cities[i]!;
      const b = cities[j]!;
      if (a.civilizationId === b.civilizationId) continue;
      const distance = distanceFn(a, b);
      const risk = riskFn(a, b);
      const cost = distance * (1 + risk);
      if (cost < 40) {
        edges.push({ fromCityId: a.id, toCityId: b.id, distance, risk, cost });
        edges.push({ fromCityId: b.id, toCityId: a.id, distance, risk, cost });
      }
    }
  }
  return edges;
}

export function stepResourceEconomy(resources: ResourceNode[], demandPressure: number): ResourceNode[] {
  return resources.map((r) => {
    const extracted = Math.min(r.quantity, r.extractRate * demandPressure);
    const quantity = Math.max(0, r.quantity - extracted + r.regenRate);
    return {
      ...r,
      quantity,
      value: clamp(r.value * (1 + (1 - quantity / Math.max(1, r.quantity + extracted)) * 0.05), 0.1, 10),
    };
  });
}
