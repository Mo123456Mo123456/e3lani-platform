/** Seeded hash noise for procedural planet terrain */

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Value in roughly [-1, 1] */
export function noise2D(x: number, y: number, seed = 0): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const s = seed & 255;
  const aa = ((X + s) * 374761393 + (Y + s) * 668265263) & 255;
  const ab = ((X + s) * 374761393 + (Y + 1 + s) * 668265263) & 255;
  const ba = ((X + 1 + s) * 374761393 + (Y + s) * 668265263) & 255;
  const bb = ((X + 1 + s) * 374761393 + (Y + 1 + s) * 668265263) & 255;

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq, seed + i * 17);
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / max;
}

export type BiomeColor = { r: number; g: number; b: number };

export function heightToBiome(h: number, moisture: number): BiomeColor {
  if (h < -0.15) return { r: 0.05, g: 0.18, b: 0.42 }; // deep ocean
  if (h < 0.0) return { r: 0.08, g: 0.35, b: 0.55 }; // shallow
  if (h < 0.08) return { r: 0.75, g: 0.7, b: 0.45 }; // coast
  if (h > 0.55) return { r: 0.85, g: 0.88, b: 0.92 }; // snow/peak
  if (h > 0.4) return { r: 0.45, g: 0.42, b: 0.4 }; // mountain
  if (moisture < -0.2) return { r: 0.78, g: 0.68, b: 0.42 }; // desert
  if (moisture > 0.25) return { r: 0.12, g: 0.42, b: 0.22 }; // rainforest
  if (h < 0.2) return { r: 0.35, g: 0.55, b: 0.22 }; // plains
  return { r: 0.22, g: 0.48, b: 0.28 }; // forest
}

export function latLonFromNormal(nx: number, ny: number, nz: number): { lat: number; lon: number } {
  const lat = Math.asin(Math.max(-1, Math.min(1, ny))) * (180 / Math.PI);
  const lon = Math.atan2(nx, nz) * (180 / Math.PI);
  return { lat, lon };
}
