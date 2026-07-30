import { neighbors4 } from "../math.js";
import type { PlanetGrid } from "../planet/types.js";

export interface PathOptions {
  /** Extra traversal cost per cell (terrain, danger). Defaults to land-only routing. */
  cost?: (cell: number) => number;
  /** Whether ocean cells may be crossed (sea routes). */
  allowOcean?: boolean;
  maxIterations?: number;
}

/**
 * A* over the planet grid (4-neighbourhood, longitudinal wrap).
 * Used for trade routes, migrations and army movements — routes must never
 * cross impossible terrain unless explicitly allowed.
 */
export function findPath(grid: PlanetGrid, start: number, goal: number, opts: PathOptions = {}): number[] | null {
  if (start === goal) return [start];
  const w = grid.width;
  const passable = (cell: number): boolean => {
    const land = (grid.elevation[cell] ?? 0) > grid.seaLevel;
    return opts.allowOcean ? true : land;
  };
  if (!passable(start) || !passable(goal)) return null;

  const heuristic = (cell: number): number => {
    const ax = cell % w;
    const ay = Math.floor(cell / w);
    const bx = goal % w;
    const by = Math.floor(goal / w);
    const dx = Math.min(Math.abs(ax - bx), w - Math.abs(ax - bx));
    const dy = Math.abs(ay - by);
    return dx + dy;
  };

  const open = new Set<number>([start]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[start, 0]]);
  const fScore = new Map<number, number>([[start, heuristic(start)]]);
  const maxIter = opts.maxIterations ?? grid.cellCount * 4;

  let iter = 0;
  while (open.size > 0 && iter++ < maxIter) {
    let current = -1;
    let best = Infinity;
    for (const cell of open) {
      const f = fScore.get(cell) ?? Infinity;
      if (f < best) {
        best = f;
        current = cell;
      }
    }
    if (current === goal) {
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current) as number;
        path.unshift(current);
      }
      return path;
    }
    open.delete(current);
    for (const n of neighbors4(grid.width, grid.height, current)) {
      if (!passable(n)) continue;
      const stepCost = 1 + (opts.cost ? opts.cost(n) : 0);
      const tentative = (gScore.get(current) ?? Infinity) + stepCost;
      if (tentative < (gScore.get(n) ?? Infinity)) {
        cameFrom.set(n, current);
        gScore.set(n, tentative);
        fScore.set(n, tentative + heuristic(n));
        open.add(n);
      }
    }
  }
  return null;
}
