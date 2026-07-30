export const config = {
  port: Number(process.env["PORT"] ?? 4000),
  host: process.env["HOST"] ?? "0.0.0.0",
  databaseUrl: process.env["DATABASE_URL"] ?? "postgresql://planet:planet@localhost:5432/planet",
  engineUrl: process.env["ENGINE_URL"] ?? "http://localhost:4100",
  orchestratorUrl: process.env["ORCHESTRATOR_URL"] ?? "http://localhost:4200",
  jwtSecret: process.env["JWT_SECRET"] ?? "dev-only-insecure-secret-change-me",
  accessTtlSeconds: Number(process.env["ACCESS_TOKEN_TTL"] ?? 900),
  refreshTtlSeconds: Number(process.env["REFRESH_TOKEN_TTL"] ?? 7 * 24 * 3600),
  corsOrigin: process.env["CORS_ORIGIN"] ?? "*",
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  rateLimitPerMinute: Number(process.env["RATE_LIMIT_PER_MINUTE"] ?? 120),
  contributionRateLimitPerHour: Number(process.env["CONTRIBUTION_RATE_LIMIT_PER_HOUR"] ?? 20),
} as const;

if (config.nodeEnv === "production" && config.jwtSecret.includes("insecure")) {
  throw new Error("JWT_SECRET must be set in production");
}
