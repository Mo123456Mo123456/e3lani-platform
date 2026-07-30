export function formatNumber(n: number, locale: "ar" | "en" = "ar"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatCompact(n: number, locale: "ar" | "en" = "ar"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(v: number, locale: "ar" | "en" = "ar"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 }).format(v);
}

export function formatTemp(c: number): string {
  return `${c.toFixed(1)}°`;
}

/** convert equirectangular lat/lon (deg) to xyz on unit sphere */
export function latLonToVec3(lat: number, lon: number, radius = 1): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function uvToLatLon(u: number, v: number): { lat: number; lon: number } {
  return { lat: 90 - v * 180, lon: u * 360 - 180 };
}
