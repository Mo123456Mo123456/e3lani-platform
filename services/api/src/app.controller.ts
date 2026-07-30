import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AiService } from "./ai.service";
import { WorldService } from "./world.service";

@ApiTags("operations")
@Controller()
export class AppController {
  constructor(
    private readonly worlds: WorldService,
    private readonly ai: AiService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Service and dependency health" })
  async health() {
    return {
      status: "ok",
      service: "planet-api",
      world: {
        id: this.worlds.getSummary().id,
        tick: this.worlds.getSummary().currentTick,
      },
      ai: await this.ai.status(),
      timestamp: new Date().toISOString(),
    };
  }
}
