/** Shared configuration for كوكب يولد أمامك */

export const ports = {
  web: 3000,
  api: 4000,
  admin: 3001,
  realtime: 4001,
  simulationEngine: 8001,
  aiOrchestrator: 8002,
  postgres: 5432,
  redis: 6379,
  minio: 9000,
} as const;

/** Theme CSS custom properties as JS values */
export const colors = {
  "--color-bg": "#0b1a24",
  "--color-bg-elevated": "#122636",
  "--color-surface": "#1a3347",
  "--color-fg": "#e8f1f5",
  "--color-fg-muted": "#8aa4b3",
  "--color-accent": "#2ec4b6",
  "--color-accent-warm": "#f4a261",
  "--color-ocean": "#1b4f72",
  "--color-land": "#2d6a4f",
  "--color-desert": "#c4a35a",
  "--color-ice": "#a8d5e5",
  "--color-volcanic": "#9b2226",
  "--color-danger": "#e63946",
  "--color-success": "#52b788",
  "--color-border": "#2a4558",
} as const;

export const roles = [
  "visitor",
  "contributor",
  "moderator",
  "admin",
  "scientist",
] as const;

export const tickDefaults = {
  day: { yearsPerTick: 1 / 365 },
  month: { yearsPerTick: 1 / 12 },
  year: { yearsPerTick: 1 },
  decade: { yearsPerTick: 10 },
  defaultTickType: "year" as const,
  defaultForecastYears: 100,
  defaultMonteCarloRuns: 24,
} as const;

export const qualityPresets = {
  draft: { resolution: 32, fbmOctaves: 3, riverCount: 8 },
  standard: { resolution: 64, fbmOctaves: 5, riverCount: 16 },
  high: { resolution: 128, fbmOctaves: 6, riverCount: 32 },
  ultra: { resolution: 256, fbmOctaves: 8, riverCount: 64 },
} as const;

export type QualityPreset = keyof typeof qualityPresets;
