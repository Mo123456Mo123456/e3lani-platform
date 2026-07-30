/**
 * lat/lon ↔ unit-sphere conversions consistent with THREE.SphereGeometry's
 * UV parameterization (v = 0 at the north pole, u = 0 at lon −180).
 */

export function latLonToVec3(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -radius * Math.cos(theta) * Math.sin(phi),
    radius * Math.cos(phi),
    radius * Math.sin(theta) * Math.sin(phi),
  ];
}

export function uvToLatLon(u: number, v: number): { lat: number; lon: number } {
  return { lat: 90 - v * 180, lon: u * 360 - 180 };
}
