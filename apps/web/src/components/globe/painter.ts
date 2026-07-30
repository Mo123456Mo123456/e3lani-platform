import { BIOME_COLORS } from "@kawkab/simulation";
import type { BiomeType, LayerId } from "@kawkab/shared-types";

/**
 * Cell → pixel painting, shared between the generation worker (full render)
 * and the main thread (incremental delta repaints). One source of truth so
 * incremental updates match the generated base exactly.
 */

export interface CellPaint {
  biome: BiomeType;
  elevation: number;
  river: number;
  isOcean: boolean;
  hasIce: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function cellColor(cell: CellPaint): [number, number, number] {
  const base = hexToRgb(BIOME_COLORS[cell.biome] ?? "#555555");
  let [r, g, b] = base;
  if (cell.isOcean) {
    const depth = Math.max(0.45, 1 + cell.elevation * 0.9);
    r *= depth; g *= depth; b *= depth * 1.05;
  } else {
    const shade = 0.75 + Math.min(0.45, Math.max(-0.1, cell.elevation * 0.5));
    r *= shade; g *= shade; b *= shade;
    if (cell.river > 0.12) {
      const k = Math.min(0.85, cell.river);
      r = r * (1 - k) + 74 * k;
      g = g * (1 - k) + 163 * k;
      b = b * (1 - k) + 223 * k;
    }
  }
  if (cell.hasIce) {
    r = r * 0.25 + 232 * 0.75;
    g = g * 0.25 + 241 * 0.75;
    b = b * 0.25 + 245 * 0.75;
  }
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

/** overlay color for a data layer value (0..1) with domain-specific ramps */
export function overlayColor(layer: LayerId, value: number, civColor?: string): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, value));
  switch (layer) {
    case "temperature": {
      // blue → yellow → red
      const r = Math.min(255, v * 2 * 255);
      const b = Math.min(255, (1 - v) * 2 * 255);
      return [r, v < 0.5 ? v * 2 * 180 : 180 - (v - 0.5) * 120, b, 0.45];
    }
    case "pollution":
      return [140 + v * 100, 81 - v * 40, 10, v * 0.7];
    case "weather":
      return [106, 81, 163, v * 0.75];
    case "civilization": {
      if (v <= 0) return [0, 0, 0, 0];
      const rgb = civColor ? hexToRgb(civColor.startsWith("#") ? civColor : hslToHex(civColor)) : [245, 196, 82];
      return [rgb[0], rgb[1], rgb[2], 0.55];
    }
    case "resource":
      return [255, 215, 0, v * 0.8];
    case "conflict":
      return [224, 49, 49, v * 0.8];
    case "migration":
      return [151, 117, 250, v * 0.75];
    case "trade":
      return [255, 212, 59, v * 0.7];
    case "history":
      return [248, 249, 250, v * 0.55];
    default:
      return [0, 0, 0, 0];
  }
}

/** three.js-friendly hsl() → #hex */
export function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (!m) return "#f5c452";
  const h = parseFloat(m[1]!) / 360;
  const s = parseFloat(m[2]!) / 100;
  const l = parseFloat(m[3]!) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${((f(0) << 16) | (f(8) << 8) | f(4)).toString(16).padStart(6, "0")}`;
}

/** paint one cell into an ImageData buffer at (x, y) with scale s */
export function paintCell(img: ImageData, x: number, y: number, s: number, rgb: [number, number, number], water: boolean): void {
  for (let dy = 0; dy < s; dy++) {
    for (let dx = 0; dx < s; dx++) {
      const px = x * s + dx;
      const py = y * s + dy;
      if (px >= img.width || py >= img.height) continue;
      const i = (py * img.width + px) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = water ? 255 : 0; // alpha carries the water mask for specular
    }
  }
}

export function blendCell(img: ImageData, x: number, y: number, s: number, rgba: [number, number, number, number]): void {
  if (rgba[3] <= 0) return;
  for (let dy = 0; dy < s; dy++) {
    for (let dx = 0; dx < s; dx++) {
      const px = x * s + dx;
      const py = y * s + dy;
      if (px >= img.width || py >= img.height) continue;
      const i = (py * img.width + px) * 4;
      const a = rgba[3];
      img.data[i] = img.data[i]! * (1 - a) + rgba[0] * a;
      img.data[i + 1] = img.data[i + 1]! * (1 - a) + rgba[1] * a;
      img.data[i + 2] = img.data[i + 2]! * (1 - a) + rgba[2] * a;
      img.data[i + 3] = 255;
    }
  }
}
