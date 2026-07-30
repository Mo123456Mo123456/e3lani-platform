export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Convert grid coords (equirectangular) to unit-sphere xyz. */
export function cellToSphere(width: number, height: number, x: number, y: number): [number, number, number] {
  const lon = (x / width) * Math.PI * 2 - Math.PI;
  const lat = (0.5 - y / height) * Math.PI;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
}

export function cellLat(height: number, y: number): number {
  return (0.5 - y / height) * 180;
}

export function cellLon(width: number, x: number): number {
  return (x / width) * 360 - 180;
}

export function latLonToCell(width: number, height: number, lat: number, lon: number): number {
  const y = clamp(Math.floor((0.5 - lat / 180) * height), 0, height - 1);
  const x = ((Math.floor(((lon + 180) / 360) * width) % width) + width) % width;
  return y * width + x;
}

export function cellXY(width: number, index: number): [number, number] {
  return [index % width, Math.floor(index / width)];
}

/** 4-neighbourhood with longitudinal wrap and polar clamp. */
export function neighbors4(width: number, height: number, index: number): number[] {
  const x = index % width;
  const y = Math.floor(index / width);
  const out: number[] = [];
  out.push(y * width + ((x + 1) % width));
  out.push(y * width + ((x - 1 + width) % width));
  if (y > 0) out.push((y - 1) * width + x);
  if (y < height - 1) out.push((y + 1) * width + x);
  return out;
}

/** Approximate great-circle distance between two cells, in cell units. */
export function cellDistance(width: number, height: number, a: number, b: number): number {
  const [ax, ay] = cellXY(width, a);
  const [bx, by] = cellXY(width, b);
  const dx = Math.min(Math.abs(ax - bx), width - Math.abs(ax - bx));
  const dy = Math.abs(ay - by);
  return Math.sqrt(dx * dx + dy * dy);
}
