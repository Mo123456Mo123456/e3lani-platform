/** Shared seeded RNG + lightweight biome helpers used by TS services/tests */

export class SeededRng {
  private state: number;

  constructor(seed: string) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    this.state = h >>> 0 || 1;
  }

  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }
}

export function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Value noise via seeded hash — deterministic for same seed+coords */
export function valueNoise2D(seed: string, x: number, y: number): number {
  const rng = new SeededRng(`${seed}:${Math.floor(x)}:${Math.floor(y)}`);
  const n00 = rng.next();
  const n10 = new SeededRng(`${seed}:${Math.floor(x) + 1}:${Math.floor(y)}`).next();
  const n01 = new SeededRng(`${seed}:${Math.floor(x)}:${Math.floor(y) + 1}`).next();
  const n11 = new SeededRng(`${seed}:${Math.floor(x) + 1}:${Math.floor(y) + 1}`).next();
  const fx = fade(x - Math.floor(x));
  const fy = fade(y - Math.floor(y));
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

export function fractalNoise(
  seed: string,
  x: number,
  y: number,
  octaves = 4,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(`${seed}:${i}`, x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export type Biome =
  | "ocean"
  | "coast"
  | "plains"
  | "rainforest"
  | "temperate_forest"
  | "desert"
  | "mountain"
  | "tundra"
  | "wetland"
  | "steppe"
  | "volcanic"
  | "ice";

export function classifyBiome(
  lat: number,
  elevation: number,
  temperature: number,
  moisture: number,
): Biome {
  if (elevation < 0.28) return "ocean";
  if (elevation < 0.34) return "coast";
  if (Math.abs(lat) > 70) return "ice";
  if (Math.abs(lat) > 58 && temperature < 0.35) return "tundra";
  if (elevation > 0.78) return elevation > 0.9 && moisture < 0.35 ? "volcanic" : "mountain";
  if (temperature > 0.7 && moisture < 0.28) return "desert";
  if (temperature > 0.65 && moisture > 0.7) return "rainforest";
  if (moisture > 0.65 && temperature > 0.4) return "temperate_forest";
  if (moisture > 0.7) return "wetland";
  if (moisture < 0.4 && temperature > 0.45) return "steppe";
  return "plains";
}

/** Lotka–Volterra inspired discrete step */
export function predatorPreyStep(
  prey: number,
  predator: number,
  opts: { alpha: number; beta: number; gamma: number; delta: number },
): { prey: number; predator: number } {
  const { alpha, beta, gamma, delta } = opts;
  const nextPrey = prey + prey * (alpha - beta * predator);
  const nextPredator = predator + predator * (delta * prey - gamma);
  return {
    prey: Math.max(0, nextPrey),
    predator: Math.max(0, nextPredator),
  };
}
