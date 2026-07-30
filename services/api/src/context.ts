/**
 * Shared application context injected into every route module.
 */
import type { Tracker } from "@planet/analytics";
import type { Repository } from "./store/repository.js";
import type { TokenService } from "./auth/tokens.js";
import type { WorldManager } from "./world/manager.js";
import type { AiOrchestrator } from "./ai/orchestrator.js";
import type { ApiEnv } from "@planet/config";

export interface AppContext {
  env: ApiEnv;
  repository: Repository;
  tokens: TokenService;
  worlds: WorldManager;
  ai: AiOrchestrator;
  tracker: Tracker;
}
