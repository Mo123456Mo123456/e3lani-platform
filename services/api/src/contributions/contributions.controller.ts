import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from "@nestjs/common";
import {
  contributionConfirmSchema,
  contributionDraftSchema,
  scenarioRequestSchema,
} from "@planet/validation";
import { CurrentUser, MinRole } from "../common/auth.guard";
import type { AccessClaims } from "../auth/jwt.util";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ContributionsService } from "./contributions.service";

@Controller("contributions")
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Post("drafts")
  @MinRole("user")
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 3600)
  @UsePipes(new ZodValidationPipe(contributionDraftSchema))
  createDraft(@CurrentUser() user: AccessClaims, @Body() body: { planetId: string; text: string; category?: string }) {
    return this.contributions.createDraft(user.sub, body);
  }

  @Post(":id/analyze")
  @MinRole("user")
  @UseGuards(RateLimitGuard)
  @RateLimit(30, 3600)
  analyze(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    return this.contributions.analyze(user.sub, id);
  }

  @Post(":id/assess")
  @MinRole("user")
  assess(@CurrentUser() user: AccessClaims, @Param("id") id: string, @Body() body: { targetCellId?: number | null }) {
    return this.contributions.assess(user.sub, id, body?.targetCellId);
  }

  @Post(":id/preview")
  @MinRole("user")
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 3600)
  preview(
    @CurrentUser() user: AccessClaims,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(scenarioRequestSchema)) body: { horizons?: number[]; runs?: number },
  ) {
    return this.contributions.requestPreview(user.sub, id, body);
  }

  @Get(":id/preview")
  @MinRole("user")
  previewResult(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    return this.contributions.previewResult(user.sub, id);
  }

  @Post(":id/confirm")
  @MinRole("user")
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 3600)
  @UsePipes(new ZodValidationPipe(contributionConfirmSchema))
  confirm(
    @CurrentUser() user: AccessClaims,
    @Param("id") id: string,
    @Body() body: { targetCellId?: number | null; finalName?: string; finalTraits?: Record<string, number | string> },
  ) {
    return this.contributions.confirm(user.sub, id, body);
  }

  @Get("mine")
  @MinRole("user")
  mine(@CurrentUser() user: AccessClaims) {
    return this.contributions.mine(user.sub);
  }

  @Get(":id")
  @MinRole("user")
  get(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    return this.contributions.getContribution(user.sub, id);
  }

  @Get(":id/impact")
  @MinRole("user")
  impact(@CurrentUser() user: AccessClaims, @Param("id") id: string) {
    return this.contributions.impact(user.sub, id);
  }
}
