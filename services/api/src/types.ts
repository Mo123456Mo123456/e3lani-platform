import type { AiProvider } from "./adapters/ai-provider.js";
import type { EventBus } from "./adapters/event-bus.js";
import type { WorldRepository } from "./adapters/repository.js";
import type { AppConfig } from "./config.js";
import type { Role } from "./domain/contracts.js";
import type { ContributionService } from "./domain/contribution-service.js";

export type JwtClaims = {
  sub: string;
  sid: string;
  email: string;
  roles: Role[];
};

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    repository: WorldRepository;
    aiProvider: AiProvider;
    eventBus: EventBus;
    contributionService: ContributionService;
    authenticate: import("fastify").preHandlerHookHandler;
    requireRole: (role: Role) => import("fastify").preHandlerHookHandler;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtClaims;
    user: JwtClaims;
  }
}
