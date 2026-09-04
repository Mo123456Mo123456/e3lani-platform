/**
 * حسابات جغرافية للاستخدام داخل التطبيق (التطبيق يعتمد PostGIS في الاستعلامات،
 * وهذه الدوال للفحوص السريعة والاختبارات وحساب المسافات على الجهاز).
 */

const EARTH_RADIUS_M = 6_371_008.8; // نصف القطر المتوسط WGS84

export interface LatLon {
  lat: number;
  lon: number;
}

export function isValidLatLon(p: Partial<LatLon> | null | undefined): p is LatLon {
  if (!p) return false;
  const { lat, lon } = p;
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** مسافة Haversine بالأمتار. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** طول مسار من نقاط متتابعة بالأمتار. */
export function pathLengthMeters(points: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1]!, points[i]!);
  }
  return total;
}

/** أقرب مسافة من نقطة إلى مجموعة نقاط (تقريب عملي لبُعد المسح عن مسار السيارة). */
export function minDistanceToPoints(point: LatLon, points: readonly LatLon[]): number | null {
  if (points.length === 0) return null;
  let min = Infinity;
  for (const p of points) {
    const d = distanceMeters(point, p);
    if (d < min) min = d;
  }
  return min;
}

/** السرعة الضمنية بين نقطتين بالمتر/الثانية. تُرجع null إذا كان الفارق الزمني صفرًا أو سالبًا. */
export function impliedSpeedMps(
  from: { point: LatLon; at: Date },
  to: { point: LatLon; at: Date },
): number | null {
  const dtSec = (to.at.getTime() - from.at.getTime()) / 1000;
  if (!Number.isFinite(dtSec) || dtSec <= 0) return null;
  return distanceMeters(from.point, to.point) / dtSec;
}
