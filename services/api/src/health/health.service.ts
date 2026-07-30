import { Injectable } from "@nestjs/common";
import { RedisPublisherService } from "../common/redis/redis-publisher.service";
import { AiOrchestratorService } from "../common/services/ai-orchestrator.service";
import { SimulationEngineService } from "../common/services/simulation-engine.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestratorService,
    private readonly simulation: SimulationEngineService,
    private readonly redis: RedisPublisherService,
  ) {}

  async check() {
    const [database, ai, simulation] = await Promise.all([
      this.prisma.isHealthy(),
      this.ai.health().then(() => true, () => false),
      this.simulation.health().then(() => true, () => false),
    ]);

    return {
      status: database ? "ok" : "degraded",
      services: {
        database,
        aiOrchestrator: ai,
        simulationEngine: simulation,
        redisPublisher: this.redis.isHealthy(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
