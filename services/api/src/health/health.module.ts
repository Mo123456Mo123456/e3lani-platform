import { Controller, Get, Module } from "@nestjs/common";
import { Public } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";

@Controller("health")
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    const checks: Record<string, { status: "up" | "down"; latencyMs?: number }> = {};
    const started = Date.now();
    try {
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
      await this.prisma.$queryRaw`SELECT 1`;
      checks["database"] = { status: "up", latencyMs: Date.now() - started };
    } catch {
      checks["database"] = { status: "down" };
    }
    const down = Object.values(checks).some((c) => c.status === "down");
    return { status: down ? "degraded" : "ok", uptimeSec: Math.floor(process.uptime()), checks };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
