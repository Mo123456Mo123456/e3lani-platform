/**
 * Shared application context injected into every route module.
 */
import type { Tracker } from "@planet/analytics";
import type { Repository } from "./store/repository";
import type { TokenService } from "./auth/tokens";
import type { WorldManager } from "./world/manager";
import type { AiOrchestrator } from "./ai/orchestrator";
import type { ApiEnv } from "@planet/config";

export interface AppContext {
  env: ApiEnv;
  repository: Repository;
  tokens: TokenService;
  worlds: WorldManager;
  ai: AiOrchestrator;
  tracker: Tracker;
}
