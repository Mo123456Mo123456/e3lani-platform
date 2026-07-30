import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { contributionConfirmSchema, contributionDraftSchema } from "@planet/validation";
import { ContributionsService } from "./contributions.service.js";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "../auth/guards.js";
import type { AccessPayload } from "../auth/auth.service.js";

@Controller("contributions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("registered", "explorer", "life_maker", "civ_builder", "historian", "content_moderator", "simulation_manager", "system_admin", "super_admin")
export class ContributionsController {
  constructor(private contributions: ContributionsService) {}

  @Post()
  create(@CurrentUser() user: AccessPayload, @Body() body: unknown) {
    const parsed = contributionDraftSchema.safeParse(body);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    return this.contributions.createDraft(user.sub, parsed.data);
  }

  @Post(":id/analyze")
  analyze(@CurrentUser() user: AccessPayload, @Param("id") id: string, @Body() body: { locale?: string }) {
    return this.contributions.analyze(user.sub, id, body?.locale ?? "ar");
  }

  @Post(":id/preview")
  preview(@CurrentUser() user: AccessPayload, @Param("id") id: string, @Body() body: unknown) {
    const parsed = contributionConfirmSchema.safeParse(body);
    if (!parsed.success) return { error: "cellIndex_required" };
    return this.contributions.preview(user.sub, id, parsed.data.cellIndex);
  }

  @Post(":id/confirm")
  confirm(@CurrentUser() user: AccessPayload, @Param("id") id: string) {
    return this.contributions.confirm(user.sub, id);
  }

  @Get("mine")
  mine(@CurrentUser() user: AccessPayload, @Query("planetId") planetId?: string) {
    return this.contributions.mine(user.sub, planetId);
  }

  @Get(":id/impact")
  impact(@CurrentUser() user: AccessPayload, @Param("id") id: string) {
    return this.contributions.impact(user.sub, id);
  }
}
