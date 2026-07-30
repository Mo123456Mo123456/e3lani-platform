export type QualityLevel = "low" | "medium" | "high";

export type QualityPreset = {
  sphereSegments: number;
  atmosphere: boolean;
  clouds: boolean;
  cityLights: boolean;
  eventNodes: number;
  shadows: boolean;
  pixelRatio: number;
};

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    sphereSegments: 48,
    atmosphere: true,
    clouds: false,
    cityLights: false,
    eventNodes: 6,
    shadows: false,
    pixelRatio: 1,
  },
  medium: {
    sphereSegments: 96,
    atmosphere: true,
    clouds: true,
    cityLights: true,
    eventNodes: 14,
    shadows: false,
    pixelRatio: 1.5,
  },
  high: {
    sphereSegments: 128,
    atmosphere: true,
    clouds: true,
    cityLights: true,
    eventNodes: 24,
    shadows: true,
    pixelRatio: 2,
  },
};

export function detectDefaultQuality(): QualityLevel {
  if (typeof navigator === "undefined") return "medium";
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem && mem <= 4) return "low";
  if (typeof window !== "undefined" && window.innerWidth < 768) return "low";
  return "high";
}
