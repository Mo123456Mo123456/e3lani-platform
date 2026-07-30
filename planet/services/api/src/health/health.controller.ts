import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { EngineClient } from "../common/engine.client.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";

@Controller("health")
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private engine: EngineClient,
    private orchestrator: OrchestratorClient,
  ) {}

  @Get()
  async health() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    return {
      status: database ? "ok" : "degraded",
      database,
      engine: await this.engine.healthy(),
      orchestrator: await this.orchestrator.healthy(),
      uptime: process.uptime(),
    };
  }
}
