export const APP_NAME = {
  ar: "كوكب يولد أمامك",
  en: "A Planet Born Before You",
} as const;

export const APP_TAGLINE = {
  ar: "عالمك، قرارك، أثر لا ينتهي.",
  en: "Your world, your decision, an endless impact.",
} as const;

export const COLORS = {
  background: "#050A15",
  backgroundAlt: "#0A1224",
  surface: "rgba(12, 22, 42, 0.72)",
  surfaceSolid: "#0C162A",
  border: "rgba(120, 160, 220, 0.18)",
  text: "#F2F5FA",
  textMuted: "#9AA8C0",
  tech: "#3DD6F5",
  nature: "#3DCF7A",
  civilization: "#E6C35C",
  migration: "#A78BFA",
  war: "#EF4444",
  hazard: "#F97316",
  white: "#FFFFFF",
  gray: "#94A3B8",
} as const;

export const DEFAULT_PLANET_SEED = "planet-born-genesis-v1";
export const DEFAULT_TICK_UNIT = "year" as const;
export const SIM_YEARS_PER_TICK: Record<string, number> = {
  day: 1 / 365,
  month: 1 / 12,
  year: 1,
  decade: 10,
};

export const BALANCE_LIMITS = {
  maxTrait: 0.95,
  maxReproduction: 0.7,
  maxImmortality: 0.85,
  maxInstantDestruction: 0.4,
  maxUnlimitedEnergy: 0.75,
} as const;

export const SERVICE_PORTS = {
  api: 4000,
  ai: 4100,
  simulation: 4200,
  realtime: 4300,
  worldGenerator: 4400,
  web: 3000,
  admin: 3001,
} as const;

export const RATE_LIMITS = {
  contributionPerHour: 5,
  aiAnalyzePerHour: 20,
  authLoginPerMinute: 10,
} as const;
