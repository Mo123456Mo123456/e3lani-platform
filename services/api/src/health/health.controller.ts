import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { Public } from "../common/auth.guard";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import { EngineClient } from "../simulation/engine-client.service";

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly engine: EngineClient,
  ) {}

  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "planet-born-api", time: new Date().toISOString() };
  }

  @Public()
  @Get("ready")
  async ready() {
    const checks: Record<string, boolean> = {};
    try {
      await sql`SELECT 1`.execute(this.db);
      checks.database = true;
    } catch {
      checks.database = false;
    }
    checks.simulationEngine = await this.engine.health();
    if (!checks.database) {
      throw new ServiceUnavailableException({ status: "not_ready", checks });
    }
    return { status: "ready", checks };
  }
}
