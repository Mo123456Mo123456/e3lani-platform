import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import {
  AccessTokenGuard,
  AuthModule,
  RoleGuard,
  Roles,
} from "./auth.module.js";
import { DatabaseModule } from "./database.module.js";
import { DatabaseService } from "./database.service.js";
import { WorldModule } from "./world.module.js";

@ApiTags("system")
@Controller("system")
class SystemController {
  constructor(private readonly database: DatabaseService) {}

  @Get("health")
  async health() {
    const rows = await this.database.query<{ now: string }>(
      "SELECT now()::text AS now",
    );
    return {
      status: "ok",
      database: "connected",
      simulation: "ready",
      timestamp: rows[0]?.now,
    };
  }

  @Get("admin/stats")
  @ApiBearerAuth()
  @Roles("system_admin", "simulation_admin")
  @UseGuards(AccessTokenGuard, RoleGuard)
  async adminStats() {
    const rows = await this.database.query<{
      users: number;
      contributions: number;
      events: number;
      ticks: number;
      aiCost: string;
    }>(
      `SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM user_contributions) AS contributions,
        (SELECT count(*)::int FROM world_events) AS events,
        (SELECT count(*)::int FROM simulation_ticks) AS ticks,
        (SELECT coalesce(sum(cost_usd),0)::text FROM ai_requests) AS "aiCost"`,
    );
    return rows[0];
  }
}

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AuthModule,
    WorldModule,
  ],
  controllers: [SystemController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
