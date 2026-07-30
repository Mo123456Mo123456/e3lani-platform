import { clamp } from "./rng.js";
import type { GeneratedCell } from "./world-generator.js";

export type ClimateState = {
  temperature: number;
  moisture: number;
  pressure: number;
  pollution: number;
  vegetation: number;
  stormIntensity: number;
};

export function initClimate(cell: GeneratedCell): ClimateState {
  return {
    temperature: cell.temperature,
    moisture: cell.moisture,
    pressure: 0.5 + (0.5 - cell.height) * 0.2,
    pollution: 0,
    vegetation: cell.isOcean ? 0 : cell.fertility * 0.6,
    stormIntensity: 0,
  };
}

/**
 * Simplified climate step using neighbor diffusion (cellular automata style).
 * All changes are causal: diffusion, vegetation feedback, pollution forcing.
 */
export function stepClimateGrid(
  cells: GeneratedCell[],
  climate: ClimateState[],
  width: number,
  height: number,
  emissions = 0,
  volcanicAsh = 0,
): ClimateState[] {
  const next = climate.map((c) => ({ ...c }));
  const idx = (x: number, y: number) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      const cell = cells[i]!;
      const cur = climate[i]!;
      let tSum = 0;
      let mSum = 0;
      let pSum = 0;
      let n = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = idx(nx, ny);
        tSum += climate[ni]!.temperature;
        mSum += climate[ni]!.moisture;
        pSum += climate[ni]!.pollution;
        n++;
      }
      const avgT = n ? tSum / n : cur.temperature;
      const avgM = n ? mSum / n : cur.moisture;
      const avgP = n ? pSum / n : cur.pollution;

      let temperature = cur.temperature * 0.85 + avgT * 0.15;
      temperature += emissions * 0.002;
      temperature -= volcanicAsh * 0.01;
      temperature -= cur.vegetation * 0.001;
      temperature = clamp(temperature, 0, 1);

      let moisture = cur.moisture * 0.8 + avgM * 0.15;
      if (cell.isOcean) moisture = Math.max(moisture, 0.7);
      moisture += (cell.isOcean ? 0.02 : -0.005);
      moisture -= cur.pollution * 0.01;
      moisture = clamp(moisture, 0, 1);

      let pollution = cur.pollution * 0.92 + avgP * 0.05 + emissions * 0.01;
      pollution = clamp(pollution - cur.vegetation * 0.02, 0, 1);

      let vegetation = cur.vegetation;
      if (!cell.isOcean) {
        vegetation += (moisture - 0.35) * 0.02 * cell.fertility;
        vegetation -= pollution * 0.03;
        vegetation -= Math.abs(temperature - 0.55) * 0.01;
        vegetation = clamp(vegetation, 0, 1);
      } else {
        vegetation = 0;
      }

      const stormIntensity = clamp(
        (moisture - 0.65) * (temperature > 0.5 ? 1.2 : 0.4) + (cur.pressure < 0.4 ? 0.2 : 0),
        0,
        1,
      );

      next[i] = {
        temperature,
        moisture,
        pressure: clamp(cur.pressure * 0.9 + (1 - temperature) * 0.1, 0, 1),
        pollution,
        vegetation,
        stormIntensity,
      };
    }
  }
  return next;
}
