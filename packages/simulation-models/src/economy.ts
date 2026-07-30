/**
 * Economy: supply/demand pricing, Dijkstra trade routes, scarcity.
 */

export interface MarketGood {
  id: string;
  supply: number;
  demand: number;
  basePrice: number;
}

export interface RegionNode {
  id: string;
  neighbors: Array<{ id: string; cost: number }>;
}

export function priceFromSupplyDemand(good: MarketGood): number {
  const supply = Math.max(0.01, good.supply);
  const demand = Math.max(0.01, good.demand);
  const ratio = demand / supply;
  // isoelastic-ish curve
  return good.basePrice * Math.pow(ratio, 0.6);
}

export function scarcity(good: MarketGood): number {
  return Math.min(1, Math.max(0, 1 - good.supply / Math.max(0.01, good.demand)));
}

export interface TradePath {
  nodes: string[];
  cost: number;
}

/** Dijkstra shortest path on region graph */
export function tradeRouteCost(
  graph: Map<string, RegionNode>,
  fromId: string,
  toId: string,
): TradePath | null {
  if (!graph.has(fromId) || !graph.has(toId)) return null;
  if (fromId === toId) return { nodes: [fromId], cost: 0 };

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(fromId, 0);

  while (true) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null) break;
    if (u === toId) break;
    visited.add(u);
    const node = graph.get(u);
    if (!node) continue;
    for (const n of node.neighbors) {
      if (visited.has(n.id)) continue;
      const alt = best + n.cost;
      if (alt < (dist.get(n.id) ?? Infinity)) {
        dist.set(n.id, alt);
        prev.set(n.id, u);
      }
    }
  }

  if (!dist.has(toId)) return null;
  const nodes: string[] = [];
  let cur: string | undefined = toId;
  while (cur) {
    nodes.unshift(cur);
    cur = prev.get(cur);
  }
  return { nodes, cost: dist.get(toId)! };
}

export function updateMarket(
  goods: MarketGood[],
  production: Record<string, number>,
  consumption: Record<string, number>,
  dt: number,
): MarketGood[] {
  return goods.map((g) => {
    const prod = production[g.id] ?? 0;
    const cons = consumption[g.id] ?? 0;
    const supply = Math.max(0, g.supply + (prod - cons) * dt);
    const demand = Math.max(0.01, g.demand * (0.95 + 0.1 * scarcity({ ...g, supply })));
    return { ...g, supply, demand, basePrice: g.basePrice };
  });
}

export function deliveredPrice(good: MarketGood, routeCost: number, tariff = 0.05): number {
  return priceFromSupplyDemand(good) * (1 + tariff) + routeCost * 0.1;
}
