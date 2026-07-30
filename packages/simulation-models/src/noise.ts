import { hashSeed, type Seed } from "./prng.js";

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function latticeValue(
  seed: Seed,
  x: number,
  y: number,
  z: number,
): number {
  return hashSeed(`${String(seed)}:${x}:${y}:${z}`) / 4_294_967_295;
}

/** Trilinear value noise in [0, 1]. */
export function valueNoise3D(
  seed: Seed,
  x: number,
  y: number,
  z: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const xAmount = smooth(x - x0);
  const yAmount = smooth(y - y0);
  const zAmount = smooth(z - z0);

  const c000 = latticeValue(seed, x0, y0, z0);
  const c100 = latticeValue(seed, x0 + 1, y0, z0);
  const c010 = latticeValue(seed, x0, y0 + 1, z0);
  const c110 = latticeValue(seed, x0 + 1, y0 + 1, z0);
  const c001 = latticeValue(seed, x0, y0, z0 + 1);
  const c101 = latticeValue(seed, x0 + 1, y0, z0 + 1);
  const c011 = latticeValue(seed, x0, y0 + 1, z0 + 1);
  const c111 = latticeValue(seed, x0 + 1, y0 + 1, z0 + 1);

  const z0y0 = interpolate(c000, c100, xAmount);
  const z0y1 = interpolate(c010, c110, xAmount);
  const z1y0 = interpolate(c001, c101, xAmount);
  const z1y1 = interpolate(c011, c111, xAmount);

  return interpolate(
    interpolate(z0y0, z0y1, yAmount),
    interpolate(z1y0, z1y1, yAmount),
    zAmount,
  );
}

/** Multi-octave value noise normalized to [-1, 1]. */
export function fractalNoise3D(
  seed: Seed,
  x: number,
  y: number,
  z: number,
  octaves = 5,
  persistence = 0.5,
  lacunarity = 2,
): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      valueNoise3D(
        `${String(seed)}:${octave}`,
        x * frequency,
        y * frequency,
        z * frequency,
      ) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return (total / amplitudeTotal) * 2 - 1;
}
