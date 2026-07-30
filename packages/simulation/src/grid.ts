/**
 * Equirectangular planetary grid with x-wrap. All simulation systems operate
 * on cell indices; renderers map the same grid onto the 3D sphere texture.
 */

export class PlanetGrid {
  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  get size(): number {
    return this.width * this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + ((x % this.width) + this.width) % this.width;
  }

  x(index: number): number {
    return index % this.width;
  }

  y(index: number): number {
    return Math.floor(index / this.width);
  }

  lat(index: number): number {
    return 90 - ((this.y(index) + 0.5) / this.height) * 180;
  }

  lon(index: number): number {
    return ((this.x(index) + 0.5) / this.width) * 360 - 180;
  }

  /** nearest cell for a geographic coordinate */
  fromLatLon(lat: number, lon: number): number {
    const y = Math.min(this.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * this.height)));
    const x = Math.min(this.width - 1, Math.max(0, Math.floor(((lon + 180) / 360) * this.width)));
    return this.index(x, y);
  }

  /** 8-connected neighbours, wrapping east/west, clamped at poles */
  neighbors(index: number): number[] {
    const x = this.x(index);
    const y = this.y(index);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= this.height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        out.push(this.index(x + dx, ny));
      }
    }
    return out;
  }

  /** great-circle-ish distance in "cell units" (for supply ranges and travel cost) */
  distance(a: number, b: number): number {
    const lat1 = (this.lat(a) * Math.PI) / 180;
    const lat2 = (this.lat(b) * Math.PI) / 180;
    let dLon = Math.abs(this.x(a) - this.x(b));
    dLon = Math.min(dLon, this.width - dLon);
    const dLat = Math.abs(this.y(a) - this.y(b));
    const meanLat = (lat1 + lat2) / 2;
    return Math.sqrt(dLat * dLat + (dLon * Math.cos(meanLat)) ** 2);
  }
}

export interface PathOptions {
  /** return false to forbid entering the cell */
  passable: (index: number) => boolean;
  /** extra movement cost for entering the cell (>=0) */
  cost?: (index: number) => number;
  maxIterations?: number;
}

/**
 * A* over the grid. Deterministic: ties broken by lowest f then insertion
 * order of the open list (array scan, no heuristic randomness).
 */
export function findPath(grid: PlanetGrid, start: number, goal: number, opts: PathOptions): number[] | null {
  if (start === goal) return [start];
  if (!opts.passable(goal)) return null;
  const cost = opts.cost ?? (() => 1);
  const maxIter = opts.maxIterations ?? grid.size * 4;
  const g = new Map<number, number>([[start, 0]]);
  const cameFrom = new Map<number, number>();
  const open: Array<{ i: number; f: number }> = [{ i: start, f: grid.distance(start, goal) }];
  const closed = new Set<number>();
  let iter = 0;

  while (open.length > 0 && iter++ < maxIter) {
    let bestPos = 0;
    for (let k = 1; k < open.length; k++) if (open[k]!.f < open[bestPos]!.f) bestPos = k;
    const { i: current } = open.splice(bestPos, 1)[0]!;
    if (current === goal) {
      const path = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)!;
        path.unshift(c);
      }
      return path;
    }
    if (closed.has(current)) continue;
    closed.add(current);
    const gCur = g.get(current)!;
    for (const nb of grid.neighbors(current)) {
      if (closed.has(nb) || !opts.passable(nb)) continue;
      const tentative = gCur + 1 + cost(nb);
      if (tentative < (g.get(nb) ?? Infinity)) {
        g.set(nb, tentative);
        cameFrom.set(nb, current);
        open.push({ i: nb, f: tentative + grid.distance(nb, goal) });
      }
    }
  }
  return null;
}
