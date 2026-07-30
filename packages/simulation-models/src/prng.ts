const UINT32_MAX = 0x1_0000_0000;

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.between(min, max + 1));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0)
      throw new Error("Cannot pick from an empty collection");
    return values[
      Math.min(values.length - 1, Math.floor(this.next() * values.length))
    ]!;
  }

  fork(label: string): SeededRandom {
    return new SeededRandom(`${this.state}:${label}`);
  }
}

function fade(value: number): number {
  return value * value * (3 - 2 * value);
}

function lattice(seed: number, x: number, y: number, z: number): number {
  let hash =
    seed ^
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 2147483647);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff;
}

export function valueNoise3D(
  seed: number,
  x: number,
  y: number,
  z: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const tz = fade(z - z0);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const samples = Array.from({ length: 8 }, (_, index) =>
    lattice(
      seed,
      x0 + (index & 1),
      y0 + ((index >> 1) & 1),
      z0 + ((index >> 2) & 1),
    ),
  );

  const bottom = lerp(
    lerp(samples[0]!, samples[1]!, tx),
    lerp(samples[2]!, samples[3]!, tx),
    ty,
  );
  const top = lerp(
    lerp(samples[4]!, samples[5]!, tx),
    lerp(samples[6]!, samples[7]!, tx),
    ty,
  );
  return lerp(bottom, top, tz);
}

export function fractalNoise3D(
  seed: number,
  x: number,
  y: number,
  z: number,
  octaves = 5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      valueNoise3D(
        seed + octave * 1013,
        x * frequency,
        y * frequency,
        z * frequency,
      ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }

  return total / normalization;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
