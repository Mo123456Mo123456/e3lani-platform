import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { contributionConfirmSchema, contributionCreateSchema } from "@kawkab/validation";
import type { Locale } from "@kawkab/shared-types";
import { CurrentUser, type AuthUser } from "../common/decorators.js";
import { ContributionsService } from "./contributions.service.js";

@ApiTags("contributions")
@Controller("contributions")
export class ContributionsController {
  constructor(private readonly service: ContributionsService) {}

  @ApiOperation({ summary: "Stage 1: moderate + parse + balance + preview an idea" })
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Query("locale") locale: Locale = "ar") {
    const input = contributionCreateSchema.parse(body);
    return this.service.createPreview(user.id, input, locale === "en" ? "en" : "ar");
  }

  @ApiOperation({ summary: "Stage 2: confirm origin — the element enters the world" })
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @Post("confirm")
  confirm(@Body() body: unknown, @CurrentUser() user: AuthUser, @Query("locale") locale: Locale = "ar") {
    const input = contributionConfirmSchema.parse(body);
    return this.service.confirm(user.id, input.contributionId, input.originIndex, locale === "en" ? "en" : "ar");
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user.id);
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.detail(user.id, id);
  }

  @Get(":id/trace")
  trace(@Param("id") id: string) {
    return this.service.causalTrace(id);
  }

  @ApiOperation({ summary: "Monte-Carlo futures: 1y / 10y / 100y / 1000y" })
  @Throttle({ default: { ttl: 60_000, limit: 4 } })
  @Get(":id/scenarios")
  scenarios(@Param("id") id: string, @CurrentUser() user: AuthUser, @Query("locale") locale: Locale = "ar") {
    return this.service.scenarios(user.id, id, locale === "en" ? "en" : "ar");
  }
}
