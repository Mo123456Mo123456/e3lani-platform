/**
 * Canvas texture builders — every pixel is derived from live grid data,
 * never from static images. Textures are equirectangular; row 0 = north pole
 * (textures are uploaded with flipY=false to match SphereGeometry v=0).
 */
import type { Biome, PlanetCell, RenderLayer } from "@planet/shared-types";
import { Simplex3 } from "@planet/simulation-models";
import type { PlanetGrid } from "@planet/simulation-models";
import type { CityMarker } from "@/lib/api";

export const BIOME_COLORS: Record<Biome, string> = {
  ocean: "#0b3d66",
  coast: "#1a6b9c",
  ice: "#e8f4f8",
  tundra: "#9db8a4",
  steppe: "#b8b06a",
  plains: "#5da85f",
  temperate_forest: "#2e7d46",
  rainforest: "#14532d",
  desert: "#d9b36c",
  mountains: "#8d8d99",
  volcanic: "#5a2b20",
  swamp: "#4a6b4f",
};

const CIV_PALETTE = [
  "#c9a227", "#3f8efc", "#e15554", "#7d5ba6", "#3bb273", "#e8871e",
  "#4d908e", "#f3722c", "#90be6d", "#577590", "#f9c74f", "#f94144",
  "#a26769", "#6a8eae", "#c1666b", "#48a9a6",
];

export function civColor(civId: string): string {
  let hash = 0;
  for (let i = 0; i < civId.length; i++) hash = (hash * 31 + civId.charCodeAt(i)) >>> 0;
  return CIV_PALETTE[hash % CIV_PALETTE.length]!;
}

export interface TextureSet {
  day: HTMLCanvasElement;
  night: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  clouds: HTMLCanvasElement;
}

export function buildDayTexture(grid: PlanetGrid, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grid.lonBands * scale;
  canvas.height = grid.latBands * scale;
  const ctx = canvas.getContext("2d")!;
  for (const cell of grid.cells) {
    ctx.fillStyle = BIOME_COLORS[cell.biome];
    const { x, y } = cellXY(cell, grid, scale);
    ctx.fillRect(x, y, scale, scale);
    // subtle height shading for terrain depth
    if (cell.height > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.22, cell.height * 0.25)})`;
      ctx.fillRect(x, y, scale, scale);
    } else {
      ctx.fillStyle = `rgba(0,0,20,${Math.min(0.3, -cell.height * 0.4)})`;
      ctx.fillRect(x, y, scale, scale);
    }
    if (cell.river) {
      ctx.fillStyle = "#7ec8e3";
      ctx.fillRect(x, y, scale, scale);
    }
  }
  return canvas;
}

export function buildNightTexture(
  grid: PlanetGrid,
  scale: number,
  cities: CityMarker[],
  luminescentCells: number[],
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grid.lonBands * scale;
  canvas.height = grid.latBands * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const city of cities) {
    const cell = grid.cells[city.cell];
    if (!cell) continue;
    const { x, y } = cellXY(cell, grid, scale);
    const radius = Math.min(10, 2 + Math.log10(city.population + 10) * 1.6) * (scale / 4);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,214,130,0.95)");
    gradient.addColorStop(1, "rgba(255,170,60,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // luminescent flora glows cool cyan
  ctx.fillStyle = "rgba(120,240,255,0.5)";
  for (const idx of luminescentCells) {
    const cell = grid.cells[idx];
    if (!cell) continue;
    const { x, y } = cellXY(cell, grid, scale);
    ctx.fillRect(x, y, scale, scale);
  }
  return canvas;
}

export function buildOverlayTexture(
  grid: PlanetGrid,
  scale: number,
  layer: RenderLayer,
  civWarIds: Set<string>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grid.lonBands * scale;
  canvas.height = grid.latBands * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const cell of grid.cells) {
    const { x, y } = cellXY(cell, grid, scale);
    switch (layer) {
      case "civilization":
      case "historical":
      case "trade":
      case "migration":
        if (cell.ownerId) {
          ctx.fillStyle = civColor(cell.ownerId) + "aa";
          ctx.fillRect(x, y, scale, scale);
        }
        break;
      case "conflict":
        if (cell.ownerId && civWarIds.has(cell.ownerId)) {
          ctx.fillStyle = "rgba(230,60,60,0.75)";
          ctx.fillRect(x, y, scale, scale);
        }
        break;
      case "pollution":
        if (cell.pollution > 0.04) {
          ctx.fillStyle = `rgba(220,50,50,${Math.min(0.85, cell.pollution)})`;
          ctx.fillRect(x, y, scale, scale);
        }
        break;
      case "temperature": {
        const t = cell.temperature;
        ctx.fillStyle = temperatureColor(t);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, scale, scale);
        ctx.globalAlpha = 1;
        break;
      }
      case "resource":
        for (const deposit of cell.resources) {
          if (!deposit.discovered) continue;
          ctx.fillStyle = resourceColor(deposit.type);
          ctx.fillRect(x, y, scale, scale);
        }
        break;
      case "weather": {
        const m = cell.moisture;
        if (m > 0.6) {
          ctx.fillStyle = `rgba(90,160,255,${(m - 0.6) * 1.4})`;
          ctx.fillRect(x, y, scale, scale);
        } else if (m < 0.15 && cell.height >= grid.seaLevel) {
          ctx.fillStyle = `rgba(230,180,80,${(0.15 - m) * 4})`;
          ctx.fillRect(x, y, scale, scale);
        }
        break;
      }
      default:
        break;
    }
  }
  return canvas;
}

export function buildCloudTexture(seed: string, width = 512, height = 256): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const noise = new Simplex3(`${seed}:clouds`);
  for (let y = 0; y < height; y++) {
    const lat = ((90 - (y / height) * 180) * Math.PI) / 180;
    for (let x = 0; x < width; x++) {
      const lon = (((x / width) * 360 - 180) * Math.PI) / 180;
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.cos(lat) * Math.sin(lon);
      const pz = Math.sin(lat);
      const n = noise.fbm(px * 2.4, py * 2.4, pz * 2.4, 4);
      const coverage = Math.max(0, n - 0.12) * 1.9;
      const alpha = Math.min(190, coverage * 255);
      const idx = (y * width + x) * 4;
      image.data[idx] = 255;
      image.data[idx + 1] = 255;
      image.data[idx + 2] = 255;
      image.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** glow sprite for event markers */
export function buildGlowSprite(color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color + "cc");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

function cellXY(cell: PlanetCell, grid: PlanetGrid, scale: number): { x: number; y: number } {
  const lo = cell.index % grid.lonBands;
  const la = Math.floor(cell.index / grid.lonBands);
  return { x: lo * scale, y: la * scale };
}

function temperatureColor(t: number): string {
  // blue -> green -> yellow -> red
  const stops: Array<[number, [number, number, number]]> = [
    [0, [40, 80, 200]],
    [0.35, [60, 170, 200]],
    [0.55, [90, 190, 90]],
    [0.75, [230, 200, 60]],
    [1, [220, 60, 40]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]!;
    const [t0, c0] = stops[i - 1]!;
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(220,60,40)";
}

function resourceColor(type: string): string {
  const map: Record<string, string> = {
    gold: "#ffd700",
    iron: "#b0b8c4",
    copper: "#e08d57",
    oil: "#402a52",
    coal: "#333333",
    uranium: "#7cff6b",
    crystal: "#9be7ff",
    timber: "#3d8b40",
    grain: "#e8d264",
    fish: "#4aa3df",
    fresh_water: "#6bd5e1",
    fertile_soil: "#8a5a2b",
  };
  return map[type] ?? "#ffffff";
}
