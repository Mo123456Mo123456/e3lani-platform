export interface SeededRandom {
  next(): number;
  between(min: number, max: number): number;
  integer(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  fork(label: string): SeededRandom;
}

function xmur3(value: string): () => number {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: string): SeededRandom {
  const seedFactory = xmur3(seed);
  const generate = mulberry32(seedFactory());

  return {
    next: generate,
    between(min, max) {
      return min + (max - min) * generate();
    },
    integer(min, max) {
      return Math.floor(min + generate() * (max - min + 1));
    },
    chance(probability) {
      return generate() < Math.max(0, Math.min(1, probability));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty collection");
      }
      return items[Math.floor(generate() * items.length)]!;
    },
    fork(label) {
      return createSeededRandom(`${seed}:${label}`);
    },
  };
}

export function deterministicId(seed: string, namespace: string, index: number): string {
  const random = createSeededRandom(`${seed}:${namespace}:${index}`);
  const bytes = Array.from({ length: 16 }, () => random.integer(0, 255));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function stableNoise(seed: string, x: number, y: number, octave = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const sample = (sx: number, sy: number) =>
    createSeededRandom(`${seed}:${octave}:${sx}:${sy}`).next() * 2 - 1;
  const top = sample(xi, yi) * (1 - smooth(xf)) + sample(xi + 1, yi) * smooth(xf);
  const bottom = sample(xi, yi + 1) * (1 - smooth(xf)) + sample(xi + 1, yi + 1) * smooth(xf);
  return top * (1 - smooth(yf)) + bottom * smooth(yf);
}

export function fractalNoise(seed: string, x: number, y: number, octaves = 5): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += stableNoise(seed, x * frequency, y * frequency, octave) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / normalization;
}
