import type { SimRegion } from "./world-state.js";

export interface GraphNode {
  id: string;
  neighbors: Array<{ id: string; cost: number }>;
}

export function buildRegionGraph(regions: SimRegion[], size: number): Map<string, GraphNode> {
  const byCoord = new Map(regions.map((r) => [`${r.x},${r.y}`, r]));
  const graph = new Map<string, GraphNode>();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const r of regions) {
    const neighbors: Array<{ id: string; cost: number }> = [];
    for (const [dx, dy] of dirs) {
      const n = byCoord.get(`${r.x + dx},${r.y + dy}`);
      if (!n) continue;
      if (n.biome === "ocean" && r.biome !== "ocean" && r.biome !== "coast") continue;
      const risk =
        n.biome === "volcanic" || n.biome === "mountain" ? 2.5 : n.biome === "desert" ? 1.6 : 1;
      neighbors.push({ id: n.id, cost: risk + Math.abs(n.elevation - r.elevation) });
    }
    graph.set(r.id, { id: r.id, neighbors });
  }
  void size;
  return graph;
}

/** Dijkstra shortest path for trade / migration / army movement. */
export function dijkstra(
  graph: Map<string, GraphNode>,
  startId: string,
  goalId: string,
): { path: string[]; cost: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq: Array<{ id: string; cost: number }> = [{ id: startId, cost: 0 }];
  dist.set(startId, 0);
  prev.set(startId, null);

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const current = pq.shift()!;
    if (current.id === goalId) break;
    if ((dist.get(current.id) ?? Infinity) < current.cost) continue;
    const node = graph.get(current.id);
    if (!node) continue;
    for (const edge of node.neighbors) {
      const next = current.cost + edge.cost;
      if (next < (dist.get(edge.id) ?? Infinity)) {
        dist.set(edge.id, next);
        prev.set(edge.id, current.id);
        pq.push({ id: edge.id, cost: next });
      }
    }
  }

  if (!dist.has(goalId)) return null;
  const path: string[] = [];
  let cur: string | null = goalId;
  while (cur) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();
  return { path, cost: dist.get(goalId)! };
}
