import { z } from "zod";

export const serviceEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  NATS_URL: z.string().url().default("nats://localhost:4222"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;
