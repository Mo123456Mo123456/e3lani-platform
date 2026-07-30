/**
 * Simplified climate cellular automata on a grid.
 */

export interface ClimateGrid {
  width: number;
  height: number;
  temperature: Float32Array;
  moisture: Float32Array;
  pollution: Float32Array;
  fire: Uint8Array;
  drought: Uint8Array;
  flood: Uint8Array;
}

export interface ClimateThresholds {
  fireTemp: number;
  fireMoistureMax: number;
  droughtMoisture: number;
  floodMoisture: number;
  pollutionDiffuse: number;
}

export const DEFAULT_CLIMATE_THRESHOLDS: ClimateThresholds = {
  fireTemp: 0.72,
  fireMoistureMax: 0.28,
  droughtMoisture: 0.18,
  floodMoisture: 0.88,
  pollutionDiffuse: 0.15,
};

export function createClimateGrid(
  width: number,
  height: number,
  temp: Float32Array,
  moist: Float32Array,
): ClimateGrid {
  const n = width * height;
  return {
    width,
    height,
    temperature: new Float32Array(temp),
    moisture: new Float32Array(moist),
    pollution: new Float32Array(n),
    fire: new Uint8Array(n),
    drought: new Uint8Array(n),
    flood: new Uint8Array(n),
  };
}

function ixy(x: number, y: number, w: number): number {
  return y * w + x;
}

/** Diffuse a field with Neumann neighborhood */
function diffuse(field: Float32Array, w: number, h: number, rate: number): Float32Array {
  const next = new Float32Array(field.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ixy(x, y, w);
      let sum = field[i]!;
      let count = 1;
      if (x > 0) {
        sum += field[ixy(x - 1, y, w)]!;
        count++;
      }
      if (x < w - 1) {
        sum += field[ixy(x + 1, y, w)]!;
        count++;
      }
      if (y > 0) {
        sum += field[ixy(x, y - 1, w)]!;
        count++;
      }
      if (y < h - 1) {
        sum += field[ixy(x, y + 1, w)]!;
        count++;
      }
      const avg = sum / count;
      next[i] = field[i]! * (1 - rate) + avg * rate;
    }
  }
  return next;
}

export function climateStep(
  grid: ClimateGrid,
  dt: number,
  thresholds: ClimateThresholds = DEFAULT_CLIMATE_THRESHOLDS,
  solarForcing = 0,
): ClimateGrid {
  const { width: w, height: h } = grid;
  const temp = new Float32Array(grid.temperature.length);
  const moist = new Float32Array(grid.moisture.length);

  // mild global forcing + local evaporation coupling
  for (let i = 0; i < temp.length; i++) {
    const t = grid.temperature[i]! + solarForcing * dt * 0.01;
    const m = grid.moisture[i]!;
    // hot dry cells warm a bit more; wet cells cool slightly
    temp[i] = Math.min(1, Math.max(0, t + (0.02 * (0.5 - m) - grid.pollution[i]! * 0.01) * dt));
    // moisture drifts toward local equilibrium
    const evap = temp[i]! * 0.03 * dt;
    moist[i] = Math.min(1, Math.max(0, m - evap + (1 - temp[i]!) * 0.02 * dt));
  }

  const pollution = diffuse(grid.pollution, w, h, thresholds.pollutionDiffuse * dt);
  // decay pollution
  for (let i = 0; i < pollution.length; i++) {
    pollution[i] = Math.max(0, pollution[i]! * (1 - 0.02 * dt));
  }

  const fire = new Uint8Array(temp.length);
  const drought = new Uint8Array(temp.length);
  const flood = new Uint8Array(temp.length);

  for (let i = 0; i < temp.length; i++) {
    drought[i] = moist[i]! < thresholds.droughtMoisture ? 1 : 0;
    flood[i] = moist[i]! > thresholds.floodMoisture ? 1 : 0;
    fire[i] =
      temp[i]! > thresholds.fireTemp && moist[i]! < thresholds.fireMoistureMax ? 1 : 0;
    if (fire[i]) {
      moist[i] = Math.max(0, moist[i]! - 0.05 * dt);
      pollution[i] = Math.min(1, pollution[i]! + 0.08 * dt);
    }
  }

  // fire spread
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ixy(x, y, w);
      if (fire[i]) continue;
      let neighborFire = false;
      if (x > 0 && fire[ixy(x - 1, y, w)]) neighborFire = true;
      if (x < w - 1 && fire[ixy(x + 1, y, w)]) neighborFire = true;
      if (y > 0 && fire[ixy(x, y - 1, w)]) neighborFire = true;
      if (y < h - 1 && fire[ixy(x, y + 1, w)]) neighborFire = true;
      if (
        neighborFire &&
        temp[i]! > thresholds.fireTemp - 0.1 &&
        moist[i]! < thresholds.fireMoistureMax + 0.1
      ) {
        fire[i] = 1;
      }
    }
  }

  return { width: w, height: h, temperature: temp, moisture: moist, pollution, fire, drought, flood };
}
