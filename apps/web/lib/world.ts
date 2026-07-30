import type { ContributionDraft, Language, Quality, Region } from "./types";

export const QUALITY_PROFILES: Record<
  Quality,
  {
    dpr: [number, number];
    segments: number;
    stars: number;
    cityLights: number;
    animateClouds: boolean;
  }
> = {
  high: {
    dpr: [1, 2],
    segments: 128,
    stars: 1700,
    cityLights: 1,
    animateClouds: true,
  },
  medium: {
    dpr: [1, 1.5],
    segments: 72,
    stars: 900,
    cityLights: 0.65,
    animateClouds: true,
  },
  eco: {
    dpr: [0.75, 1],
    segments: 40,
    stars: 350,
    cityLights: 0.35,
    animateClouds: false,
  },
};

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function latLonToCartesian(
  latitude: number,
  longitude: number,
  radius = 1,
): [number, number, number] {
  const phi = ((90 - latitude) * Math.PI) / 180;
  const theta = ((longitude + 180) * Math.PI) / 180;
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function cartesianToLatLon(
  x: number,
  y: number,
  z: number,
): { latitude: number; longitude: number } {
  const radius = Math.sqrt(x * x + y * y + z * z) || 1;
  return {
    latitude: 90 - (Math.acos(y / radius) * 180) / Math.PI,
    longitude:
      (((((Math.atan2(z, -x) * 180) / Math.PI - 180) % 360) + 540) % 360) - 180,
  };
}

export function nearestRegion(
  regions: Region[],
  latitude: number,
  longitude: number,
): Region | undefined {
  const target = latLonToCartesian(latitude, longitude);
  let best: Region | undefined;
  let bestDot = -Infinity;

  regions.forEach((region) => {
    const point = latLonToCartesian(region.latitude, region.longitude);
    const dot =
      target[0] * point[0] + target[1] * point[1] + target[2] * point[2];
    if (dot > bestDot) {
      best = region;
      bestDot = dot;
    }
  });

  return best;
}

export function makeCityLightPositions(
  regions: Region[],
  density: number,
): Float32Array {
  const positions: number[] = [];

  regions.forEach((region) => {
    const random = seededRandom(hashString(region.id));
    const count = Math.max(1, Math.round(region.cityLights * density));
    for (let index = 0; index < count; index += 1) {
      const latitude = region.latitude + (random() - 0.5) * 15;
      const longitude = region.longitude + (random() - 0.5) * 21;
      positions.push(...latLonToCartesian(latitude, longitude, 2.025));
    }
  });

  return new Float32Array(positions);
}

export function formatCompactNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatEventTime(
  occurredAt: string,
  language: Language,
  now = Date.now(),
): string {
  const minutes = Math.max(
    1,
    Math.round((now - new Date(occurredAt).getTime()) / 60_000),
  );
  const formatter = new Intl.RelativeTimeFormat(
    language === "ar" ? "ar-SA" : "en-US",
    { numeric: "always" },
  );
  if (minutes < 60) return formatter.format(-minutes, "minute");
  if (minutes < 1_440)
    return formatter.format(-Math.round(minutes / 60), "hour");
  return formatter.format(-Math.round(minutes / 1_440), "day");
}

export function splitList(value: string): string[] {
  return value
    .split(/\n|،|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateDraftStep(
  step: number,
  draft: ContributionDraft,
): boolean {
  switch (step) {
    case 0:
      return draft.category !== null;
    case 1:
      return draft.title.trim().length >= 3 && draft.idea.trim().length >= 20;
    case 4:
      return draft.regionId !== null;
    default:
      return true;
  }
}
