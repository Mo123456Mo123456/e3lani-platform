export const APP_NAME_AR = "كوكب يولد أمامك";
export const APP_NAME_EN = "Planet Born Before You";
export const TAGLINE_AR = "عالمك، قرارك، أثر لا ينتهي.";
export const TAGLINE_EN = "Your world. Your decision. An endless impact.";

export const DEFAULT_PLANET_SEED = "planet-born-alpha-2026";

export const SERVICE_PORTS = {
  web: 3000,
  admin: 3001,
  api: 4000,
  realtime: 4001,
  simulation: 8001,
  ai: 8002,
  worldGenerator: 8003,
} as const;

export const REDIS_CHANNELS = {
  deltas: "planet:deltas",
  notifications: "planet:notifications",
} as const;

export const COLORS = {
  bg: "#050a14",
  panel: "#0a1628",
  cyan: "#3ecbff",
  green: "#3dff9a",
  gold: "#f0c14a",
  purple: "#b07cff",
  red: "#ff4d6d",
  orange: "#ff8a3d",
  text: "#e8eef7",
  muted: "#9aa8bc",
} as const;
