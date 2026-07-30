import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AnalyzeContributionRequestSchema,
  CommitContributionRequestSchema,
} from "@planet/shared-types";
import { z } from "zod";

import { AiService } from "./ai.service";
import { AuthService } from "./auth.service";
import { WorldService } from "./world.service";

const tickRequestSchema = z
  .object({ count: z.number().int().min(1).max(1_000).default(1) })
  .strict();

@ApiTags("world")
@Controller("v1")
export class WorldController {
  constructor(
    private readonly worlds: WorldService,
    private readonly ai: AiService,
    private readonly auth: AuthService,
  ) {}

  @Get("worlds/current")
  @ApiOperation({ summary: "Read the current deterministic world summary" })
  getCurrentWorld() {
    return this.worlds.getSummary();
  }

  @Get("worlds/:worldId/regions")
  @ApiOperation({ summary: "Read generated geographic simulation cells" })
  getRegions(@Param("worldId") worldId: string) {
    return { data: this.worlds.getRegions(worldId) };
  }

  @Get("worlds/:worldId/events")
  @ApiOperation({ summary: "Read causal world events in reverse order" })
  getEvents(
    @Param("worldId") worldId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 80,
    @Query("before", new ParseIntPipe({ optional: true })) before?: number,
  ) {
    return {
      data: this.worlds.getEvents(worldId, limit, before),
      nextBefore: this.worlds.getEvents(worldId, limit, before).at(-1)?.sequence,
    };
  }

  @Post("worlds/:worldId/ticks")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Advance the world by deterministic simulation ticks" })
  async runTicks(
    @Param("worldId") worldId: string,
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    await this.auth.authenticate(authorization);
    const request = parseOrBadRequest(tickRequestSchema, body);
    const result = await this.worlds.runTicks(worldId, request.count);
    return {
      world: this.worlds.getSummary(),
      events: result.events,
    };
  }

  @Post("contributions/analyze")
  @ApiOperation({
    summary: "Convert untrusted contribution text to validated structured traits",
  })
  analyze(@Body() body: unknown) {
    const request = parseOrBadRequest(AnalyzeContributionRequestSchema, body);
    return this.ai.analyze(request);
  }

  @Post("worlds/:worldId/contributions")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Commit a validated contribution and its first causal event",
  })
  async contribute(
    @Param("worldId") worldId: string,
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    const userId = await this.auth.authenticate(authorization);
    const request = parseOrBadRequest(CommitContributionRequestSchema, body);
    const result = await this.worlds.addContribution(
      worldId,
      userId,
      request,
    );
    return {
      contribution: result.contribution,
      events: result.events,
      world: this.worlds.getSummary(),
    };
  }

  @Get("worlds/:worldId/contributions/:contributionId/causality")
  @ApiOperation({ summary: "Trace cause-and-effect links for one contribution" })
  getCausality(
    @Param("worldId") worldId: string,
    @Param("contributionId") contributionId: string,
  ) {
    return this.worlds.getCausality(worldId, contributionId);
  }
}

function parseOrBadRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}
