import { Controller, Get } from "@nestjs/common";

import { PrismaService, Public } from "../common";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      service: "e3lani-api",
      timestamp: new Date().toISOString(),
    };
  }
}
