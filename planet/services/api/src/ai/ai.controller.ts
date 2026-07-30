import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { CurrentUser, JwtAuthGuard } from "../auth/guards.js";
import type { AccessPayload } from "../auth/auth.service.js";
import { globalRateLimiter } from "../common/rate-limit.js";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private orchestrator: OrchestratorClient,
    private prisma: PrismaService,
  ) {}

  @Get("providers")
  providers() {
    return this.orchestrator.providers();
  }

  /** Narrate a set of simulation facts (grounded storytelling). */
  @Post("narrate")
  async narrate(@CurrentUser() user: AccessPayload, @Body() body: { locale?: string; facts?: unknown[] }) {
    if (!globalRateLimiter.allow(`narrate:${user.sub}`, 30, 60_000)) {
      return { error: "rate_limit_exceeded" };
    }
    const facts = Array.isArray(body?.facts) ? body.facts.slice(0, 30) : [];
    const started = Date.now();
    const result = await this.orchestrator.narrate({ locale: body?.locale ?? "ar", facts });
    await this.prisma.aIRequest.create({
      data: {
        userId: user.sub,
        provider: result.provider,
        kind: "narrate",
        sandbox: !result.llmGenerated,
        durationMs: Date.now() - started,
        status: "ok",
      },
    });
    return result;
  }
}
