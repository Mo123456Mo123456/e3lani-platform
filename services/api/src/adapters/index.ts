import type { AppConfig } from "../config.js";
import { InMemorySandboxRepository } from "./memory-repository.js";
import { PostgresWorldRepository } from "./postgres-repository.js";
import type { WorldRepository } from "./repository.js";

export function createRepository(config: AppConfig): WorldRepository {
  if (config.sandboxMode) return new InMemorySandboxRepository();
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required; in-memory storage is only enabled by SANDBOX_MODE=true");
  }
  return new PostgresWorldRepository(config.databaseUrl);
}
