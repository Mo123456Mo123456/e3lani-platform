export interface ApiConfig {
  nodeEnv: string;
  port: number;
  apiUrl: string;
  appUrl: string;
  adminUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
  simulationUrl: string;
  aiOrchestratorUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  defaultPlanetSeed: string;
}

const fallbackAccessSecret = "local-access-secret-change-before-production";
const fallbackRefreshSecret = "local-refresh-secret-change-before-production";

export default (): ApiConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiUrl: process.env.API_URL ?? "http://localhost:4000",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  adminUrl: process.env.ADMIN_URL ?? "http://localhost:3001",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  simulationUrl: process.env.SIMULATION_URL ?? "http://localhost:8001",
  aiOrchestratorUrl: process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8002",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? fallbackAccessSecret,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? fallbackRefreshSecret,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  defaultPlanetSeed: process.env.DEFAULT_PLANET_SEED ?? "planet-born-alpha-2026",
});
