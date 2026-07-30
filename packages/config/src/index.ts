export const config = {
  appName: process.env.APP_NAME ?? "كوكب يولد أمامك",
  tagline: "عالمك، قرارك، أثر لا ينتهي.",
  taglineEn: "Your world, your decision, an endless impact.",
  defaultSeed: process.env.DEFAULT_PLANET_SEED ?? "planet-born-alpha-2026",
  tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 5000),
  tickYears: Number(process.env.TICK_YEARS ?? 1),
  aiProvider: process.env.AI_PROVIDER ?? "sandbox",
  aiSandbox: (process.env.AI_SANDBOX_MODE ?? "true") === "true",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER ?? "planet-born",
  jwtAudience: process.env.JWT_AUDIENCE ?? "planet-born-web",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://planet:planet@localhost:5432/planet_born",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  simulationUrl: process.env.SIMULATION_URL ?? "http://localhost:8001",
  aiUrl: process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8002",
  port: Number(process.env.API_PORT ?? 4000),
};
