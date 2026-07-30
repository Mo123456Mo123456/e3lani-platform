/// <reference lib="webworker" />
/**
 * Planet generation worker: rebuilds the exact same world as the server from
 * the seed alone (same engine code), then paints equirectangular textures.
 * Nothing visual exists without simulation data behind it.
 */
import { generateWorld } from "@kawkab/simulation";
import { cellColor, paintCell } from "./painter";

export interface GenerateRequest {
  type: "generate";
  seed: string;
  gridWidth: number;
  gridHeight: number;
  scale: number;
  lights: {
    cities: Array<{ lat: number; lon: number; population: number }>;
    glowPlants: Array<{ lat: number; lon: number }>;
  };
}

export interface GenerateResponse {
  type: "generated";
  terrain: ImageBitmap;
  lights: ImageBitmap;
  clouds: ImageBitmap;
  statics: ArrayBuffer; // per cell: [elevation, river]
  gridWidth: number;
  gridHeight: number;
  scale: number;
}

self.onmessage = async (ev: MessageEvent<GenerateRequest>) => {
  const req = ev.data;
  if (req.type !== "generate") return;
  const { seed, gridWidth, gridHeight, scale } = req;
  const { state } = generateWorld(seed, { gridWidth, gridHeight });

  const w = gridWidth * scale;
  const h = gridHeight * scale;
  const terrain = new ImageData(w, h);
  const lights = new ImageData(w, h);
  const clouds = new ImageData(w, h);
  const statics = new Float32Array(gridWidth * gridHeight * 2);

  for (const cell of state.cells) {
    const x = cell.index % gridWidth;
    const y = Math.floor(cell.index / gridWidth);
    const rgb = cellColor(cell);
    paintCell(terrain, x, y, scale, rgb, cell.isOcean);
    statics[cell.index * 2] = cell.elevation;
    statics[cell.index * 2 + 1] = cell.river;

    // clouds from moisture & storms
    const density = Math.min(1, (cell.isOcean ? cell.moisture * 0.55 : cell.moisture * 0.35) + cell.storm * 0.9);
    if (density > 0.18) {
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = x * scale + dx;
          const py = y * scale + dy;
          if (px >= w || py >= h) continue;
          const i = (py * w + px) * 4;
          clouds.data[i] = 255;
          clouds.data[i + 1] = 255;
          clouds.data[i + 2] = 255;
          clouds.data[i + 3] = Math.min(235, density * 220);
        }
      }
    }
  }

  // night lights: cities glow warm, luminous plants glow cyan
  const plot = (lat: number, lon: number, rgb: [number, number, number], radius: number, alpha: number) => {
    const cx = Math.floor(((lon + 180) / 360) * gridWidth);
    const cy = Math.floor(((90 - lat) / 180) * gridHeight);
    for (let gy = -radius; gy <= radius; gy++) {
      for (let gx = -radius; gx <= radius; gx++) {
        const d = Math.sqrt(gx * gx + gy * gy);
        if (d > radius) continue;
        const fade = (1 - d / (radius + 0.5)) * alpha;
        const px = (cx + gx + gridWidth) % gridWidth;
        const py = cy + gy;
        if (py < 0 || py >= gridHeight) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const ix = px * scale + dx;
            const iy = py * scale + dy;
            if (ix >= w || iy >= h) continue;
            const i = (iy * w + ix) * 4;
            lights.data[i] = Math.min(255, lights.data[i]! + rgb[0] * fade);
            lights.data[i + 1] = Math.min(255, lights.data[i + 1]! + rgb[1] * fade);
            lights.data[i + 2] = Math.min(255, lights.data[i + 2]! + rgb[2] * fade);
            lights.data[i + 3] = 255;
          }
        }
      }
    }
  };
  for (const city of req.lights.cities) {
    const size = city.population > 5000 ? 2 : 1;
    plot(city.lat, city.lon, [255, 190, 92], size, Math.min(0.95, 0.35 + city.population / 20000));
  }
  for (const plant of req.lights.glowPlants) {
    plot(plant.lat, plant.lon, [110, 255, 200], 1, 0.7);
  }

  const [terrainBmp, lightsBmp, cloudsBmp] = await Promise.all([
    createImageBitmap(terrain),
    createImageBitmap(lights),
    createImageBitmap(clouds),
  ]);
  const response: GenerateResponse = {
    type: "generated",
    terrain: terrainBmp,
    lights: lightsBmp,
    clouds: cloudsBmp,
    statics: statics.buffer,
    gridWidth,
    gridHeight,
    scale,
  };
  (self as unknown as Worker).postMessage(response, [terrainBmp, lightsBmp, cloudsBmp, statics.buffer]);
};
