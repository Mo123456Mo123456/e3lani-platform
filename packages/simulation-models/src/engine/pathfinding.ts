/**
 * A* pathfinding over the planet grid. Cost is biome movement cost plus
 * optional per-cell risk. Used for migrations, trade routes and armies, so
 * impossible crossings (e.g. ocean for terrestrial walkers) never happen.
 */
import type { PlanetGrid } from "../worldgen/planet";
import { BIOME_MOVE_COST } from "../worldgen/biomes";

export interface PathOptions {
  /** additional cost per cell index (risk, borders...) */
  extraCost?: (cell: number) => number;
  /** hard filter — returning false forbids the cell */
  passable?: (cell: number) => boolean;
  maxIterations?: number;
}

function heuristic(a: number, b: number, grid: PlanetGrid): number {
  const ca = grid.cells[a]!;
  const cb = grid.cells[b]!;
  const dLat = Math.abs(ca.lat - cb.lat);
  let dLon = Math.abs(ca.lon - cb.lon);
  if (dLon > 180) dLon = 360 - dLon;
  return Math.hypot(dLat, dLon);
}

/** Returns the ordered cell path (including start and goal), or null. */
export function findPath(
  grid: PlanetGrid,
  start: number,
  goal: number,
  options: PathOptions = {},
): number[] | null {
  if (start === goal) return [start];
  const passable =
    options.passable ??
    ((cell: number) => grid.cells[cell]!.height >= grid.seaLevel);
  if (!passable(start) || !passable(goal)) return null;
  const extra = options.extraCost ?? (() => 0);
  const maxIterations = options.maxIterations ?? 20000;

  const gScore = new Map<number, number>([[start, 0]]);
  const cameFrom = new Map<number, number>();
  // small binary-heap-free open list: sorted array is fine at this scale
  const open: Array<{ cell: number; f: number }> = [
    { cell: start, f: heuristic(start, goal, grid) },
  ];
  const closed = new Set<number>();
  let iterations = 0;

  while (open.length > 0 && iterations++ < maxIterations) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    if (current.cell === goal) {
      const path = [goal];
      let cursor = goal;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.push(cursor);
      }
      return path.reverse();
    }
    closed.add(current.cell);
    const g = gScore.get(current.cell) ?? Infinity;
    for (const n of grid.neighbors[current.cell]!) {
      if (closed.has(n) || !passable(n)) continue;
      const stepCost =
        BIOME_MOVE_COST[grid.cells[n]!.biome] + extra(n) + 0.01;
      const tentative = g + stepCost;
      if (tentative < (gScore.get(n) ?? Infinity)) {
        gScore.set(n, tentative);
        cameFrom.set(n, current.cell);
        const f = tentative + heuristic(n, goal, grid);
        const existing = open.find((e) => e.cell === n);
        if (existing) existing.f = f;
        else open.push({ cell: n, f });
      }
    }
  }
  return null;
}

/** BFS expansion through allowed cells — used for habitat spread. */
export function floodFill(
  grid: PlanetGrid,
  start: number,
  passable: (cell: number) => boolean,
  maxCells: number,
): number[] {
  const out: number[] = [];
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0 && out.length < maxCells) {
    const cell = queue.shift()!;
    if (!passable(cell)) continue;
    out.push(cell);
    for (const n of grid.neighbors[cell]!) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return out;
}
