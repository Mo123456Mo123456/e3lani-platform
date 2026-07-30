import type { WorldState } from "./world-state.js";

export interface PathNode {
  regionIndex: number;
  cost: number;
}

/**
 * Dijkstra over region neighbor graph.
 * Oceans blocked unless allowOcean.
 */
export function shortestPath(
  state: WorldState,
  fromRegionId: string,
  toRegionId: string,
  opts?: { allowOcean?: boolean; riskWeight?: number },
): { path: string[]; cost: number } | null {
  const allowOcean = opts?.allowOcean ?? false;
  const riskWeight = opts?.riskWeight ?? 0.3;
  const indexById = new Map(state.regions.map((r) => [r.id, r.index]));
  const start = indexById.get(fromRegionId);
  const goal = indexById.get(toRegionId);
  if (start === undefined || goal === undefined) return null;

  const dist = new Array(state.regions.length).fill(Infinity) as number[];
  const prev = new Array(state.regions.length).fill(-1) as number[];
  dist[start] = 0;
  const pq: PathNode[] = [{ regionIndex: start, cost: 0 }];

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const cur = pq.shift()!;
    if (cur.cost !== dist[cur.regionIndex]) continue;
    if (cur.regionIndex === goal) break;
    const region = state.regions[cur.regionIndex]!;
    for (const ni of region.neighbors) {
      const next = state.regions[ni]!;
      if (!allowOcean && next.biome === "ocean") continue;
      const terrain =
        next.biome === "mountain" ? 1.8 : next.biome === "desert" ? 1.4 : next.biome === "swamp" ? 1.5 : 1;
      const risk = next.pollution * riskWeight + (next.temperature > 0.85 ? 0.3 : 0);
      const step = terrain + risk;
      const alt = cur.cost + step;
      if (alt < dist[ni]!) {
        dist[ni] = alt;
        prev[ni] = cur.regionIndex;
        pq.push({ regionIndex: ni, cost: alt });
      }
    }
  }

  if (!Number.isFinite(dist[goal]!)) return null;
  const pathIdx: number[] = [];
  for (let at = goal; at !== -1; at = prev[at]!) pathIdx.push(at);
  pathIdx.reverse();
  return {
    path: pathIdx.map((i) => state.regions[i]!.id),
    cost: dist[goal]!,
  };
}
