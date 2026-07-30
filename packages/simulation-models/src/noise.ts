import { deterministicUuid } from "./random";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export function fractalNoise3(
  point: Point3,
  seed: string,
  octaves = 5,
  lacunarity = 2.05,
  persistence = 0.52,
): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      valueNoise3(
        point.x * frequency,
        point.y * frequency,
        point.z * frequency,
        `${seed}:${octave}`,
      ) * amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / normalization;
}

export function ridgeNoise3(point: Point3, seed: string): number {
  return 1 - Math.abs(fractalNoise3(point, seed) * 2 - 1);
}

function valueNoise3(x: number, y: number, z: number, seed: string): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const tz = smooth(z - z0);

  const c000 = lattice(x0, y0, z0, seed);
  const c100 = lattice(x0 + 1, y0, z0, seed);
  const c010 = lattice(x0, y0 + 1, z0, seed);
  const c110 = lattice(x0 + 1, y0 + 1, z0, seed);
  const c001 = lattice(x0, y0, z0 + 1, seed);
  const c101 = lattice(x0 + 1, y0, z0 + 1, seed);
  const c011 = lattice(x0, y0 + 1, z0 + 1, seed);
  const c111 = lattice(x0 + 1, y0 + 1, z0 + 1, seed);

  const x00 = mix(c000, c100, tx);
  const x10 = mix(c010, c110, tx);
  const x01 = mix(c001, c101, tx);
  const x11 = mix(c011, c111, tx);
  return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
}

function lattice(x: number, y: number, z: number, seed: string): number {
  const uuid = deterministicUuid(seed, `${x},${y},${z}`).replaceAll("-", "");
  return Number.parseInt(uuid.slice(0, 8), 16) / 0xffff_ffff;
}

function smooth(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function mix(left: number, right: number, ratio: number): number {
  return left * (1 - ratio) + right * ratio;
}
