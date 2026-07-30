/** Lat/lon <-> cell and sphere math shared with the renderer. */

export interface GridDims {
  latBands: number;
  lonBands: number;
}

export function cellIdFromLatLon(dims: GridDims, lat: number, lon: number): number {
  const latI = Math.min(dims.latBands - 1, Math.max(0, Math.floor(((lat + 90) / 180) * dims.latBands)));
  const lonI = Math.floor((((lon + 180) % 360) / 360) * dims.lonBands);
  return latI * dims.lonBands + lonI;
}

export function latLonFromCell(dims: GridDims, cellId: number): { lat: number; lon: number } {
  const latI = Math.floor(cellId / dims.lonBands);
  const lonI = cellId % dims.lonBands;
  return {
    lat: -90 + (latI + 0.5) * (180 / dims.latBands),
    lon: -180 + (lonI + 0.5) * (360 / dims.lonBands),
  };
}

export function latLonToVec3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function vec3ToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = 90 - Math.acos(y / r) * (180 / Math.PI);
  const lon = Math.atan2(z, -x) * (180 / Math.PI) - 180;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

/** Great-circle arc points between two lat/lon pairs. */
export function arcPoints(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  radius: number,
  lift = 0.12,
  segments = 32,
): Array<[number, number, number]> {
  const a = latLonToVec3(from.lat, from.lon, 1);
  const b = latLonToVec3(to.lat, to.lon, 1);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const s = Math.sin(Math.PI * t);
    const v = slerp(a, b, t);
    const r = radius * (1 + lift * s);
    pts.push([v[0] * r, v[1] * r, v[2] * r]);
  }
  return pts;
}

function slerp(a: number[], b: number[], t: number): number[] {
  let dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  dot = Math.min(1, Math.max(-1, dot));
  const theta = Math.acos(dot);
  if (theta < 1e-6) return a;
  const sinT = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinT;
  const wb = Math.sin(t * theta) / sinT;
  return [
    wa * a[0]! + wb * b[0]!,
    wa * a[1]! + wb * b[1]!,
    wa * a[2]! + wb * b[2]!,
  ];
}
