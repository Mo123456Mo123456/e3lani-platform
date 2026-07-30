const UINT32_MAX = 4_294_967_296;

export function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX;
  }

  between(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.next();
  }

  integer(minimum: number, maximum: number): number {
    return Math.floor(this.between(minimum, maximum + 1));
  }

  chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0)
      throw new Error("Cannot pick from an empty collection");
    return values[Math.floor(this.next() * values.length)] as T;
  }

  fork(label: string): SeededRandom {
    return new SeededRandom(`${this.state}:${label}`);
  }
}

function fade(value: number): number {
  return value * value * (3 - 2 * value);
}

function lattice(seed: number, x: number, y: number): number {
  let hash = seed ^ Math.imul(x, 374_761_393) ^ Math.imul(y, 668_265_263);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0) / UINT32_MAX;
}

export function valueNoise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const a = lattice(seed, x0, y0);
  const b = lattice(seed, x0 + 1, y0);
  const c = lattice(seed, x0, y0 + 1);
  const d = lattice(seed, x0 + 1, y0 + 1);
  const upper = a + (b - a) * tx;
  const lower = c + (d - c) * tx;
  return upper + (lower - upper) * ty;
}

export function fractalNoise2D(
  seed: number,
  x: number,
  y: number,
  octaves = 5,
  persistence = 0.52,
): number {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value +=
      valueNoise2D(seed + octave * 1_013, x * frequency, y * frequency) *
      amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / normalization;
}

export function worleyNoise2D(seed: number, x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  let minimum = Number.POSITIVE_INFINITY;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const px =
        cellX + offsetX + lattice(seed, cellX + offsetX, cellY + offsetY);
      const py =
        cellY +
        offsetY +
        lattice(seed + 7_919, cellX + offsetX, cellY + offsetY);
      minimum = Math.min(minimum, Math.hypot(x - px, y - py));
    }
  }
  return Math.min(1, minimum);
}
