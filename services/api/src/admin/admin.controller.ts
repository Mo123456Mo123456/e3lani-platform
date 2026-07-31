import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { moderationReviewSchema, simControlSchema, adminUserUpdateSchema, paginationSchema } from "@planet/validation";
import type { AccessClaims } from "../auth/jwt.util";
import { CurrentUser, MinRole } from "../common/auth.guard";
import { AuditService } from "../common/audit.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import { ModerationService } from "../moderation/moderation.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { SimulationService } from "../simulation/simulation.service";
import { AiService } from "../ai/ai.service";

@Controller("admin")
@MinRole("admin")
export class AdminController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly simulation: SimulationService,
    private readonly moderation: ModerationService,
    private readonly gateway: RealtimeGateway,
    private readonly audit: AuditService,
    private readonly ai: AiService,
  ) {}

  @Get("metrics")
  async metrics() {
    const count = async (table: "users" | "user_contributions" | "world_events" | "planets" | "ai_requests") =>
      Number(
        (
          await this.db
            .selectFrom(table)
            .select((eb) => eb.fn.countAll<number>().as("c"))
            .executeTakeFirstOrThrow()
        ).c,
      );
    const [users, contributions, events, planets, aiRequests] = await Promise.all([
      count("users"),
      count("user_contributions"),
      count("world_events"),
      count("planets"),
      count("ai_requests"),
    ]);
    const byCategory = await this.db
      .selectFrom("user_contributions")
      .select(["category"])
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .groupBy("category")
      .execute();
    const aiAgg = await this.db
      .selectFrom("ai_requests")
      .select((eb) => [
        eb.fn.sum<number>("cost_usd").as("cost"),
        eb.fn.avg<number>("latency_ms").as("latency"),
      ])
      .executeTakeFirstOrThrow();
    const blocked = await this.db
      .selectFrom("moderation_results")
      .where("status", "=", "block")
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .executeTakeFirstOrThrow();
    return {
      users,
      contributions,
      contributionsByCategory: Object.fromEntries(byCategory.map((r) => [r.category, Number(r.c)])),
      events,
      planets,
      aiRequests,
      aiCostUsd: Number(aiAgg.cost ?? 0),
      aiAvgLatencyMs: Math.round(Number(aiAgg.latency ?? 0)),
      moderationBlocked: Number(blocked.c),
      activeWsConnections: this.gateway.activeConnections(),
    };
  }

  @Get("users")
  async users(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number }) {
    const total = await this.db.selectFrom("users").select((eb) => eb.fn.countAll<number>().as("c")).executeTakeFirstOrThrow();
    const rows = await this.db
      .selectFrom("users")
      .leftJoin("profiles", "profiles.user_id", "users.id")
      .select([
        "users.id", "users.email", "users.display_name", "users.role", "users.locale",
        "users.avatar_url", "users.created_at", "users.suspended",
      ])
      .orderBy("users.created_at", "desc")
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .execute();
    const counts = await this.db
      .selectFrom("user_contributions")
      .select(["user_id"])
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .groupBy("user_id")
      .execute();
    const countBy = new Map(counts.map((r) => [r.user_id, Number(r.c)]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        email: r.email ?? "",
        displayName: r.display_name,
        role: r.role,
        locale: r.locale,
        avatarUrl: r.avatar_url,
        contributionCount: countBy.get(r.id) ?? 0,
        suspended: r.suspended,
        createdAt: r.created_at.toISOString(),
      })),
      total: Number(total.c),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Patch("users/:id")
  async updateUser(
    @CurrentUser() actor: AccessClaims,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUserUpdateSchema)) body: { role?: string; suspended?: boolean },
    @Ip() ip: string,
  ) {
    if (body.role && id === actor.sub && body.role !== "super_admin" && actor.role === "super_admin") {
      throw new ForbiddenException({ error: "cannot_demote_self" });
    }
    await this.db
      .updateTable("users")
      .set({
        ...(body.role ? { role: body.role } : {}),
        ...(body.suspended !== undefined ? { suspended: body.suspended } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
    if (body.role) {
      await this.db.insertInto("roles").values({ user_id: id, role: body.role, granted_by: actor.sub }).onConflict((oc) => oc.doNothing()).execute();
    }
    await this.audit.log({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: "admin.user_update",
      targetType: "user",
      targetId: id,
      detail: body,
      ip,
    });
    return { ok: true };
  }

  @Post("planets/:id/simulation")
  async simControl(
    @CurrentUser() actor: AccessClaims,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(simControlSchema)) body: { action: "pause" | "resume" | "tick" | "rollback" | "restart_era"; ticks?: number; snapshotId?: string; tick?: number },
    @Ip() ip: string,
  ) {
    let result: { status: string; tick: number };
    switch (body.action) {
      case "pause":
        await this.simulation.setStatus(id, "paused");
        result = { status: "paused", tick: (await this.simulation.getPlanet(id)).tick };
        break;
      case "resume":
        await this.simulation.setStatus(id, "running");
        result = { status: "running", tick: (await this.simulation.getPlanet(id)).tick };
        break;
      case "tick": {
        const advanced = await this.simulation.advancePlanet(id, body.ticks ?? 1);
        result = { status: "advanced", tick: advanced.tick };
        break;
      }
      case "rollback": {
        if (body.tick === undefined) throw new ForbiddenException({ error: "tick_required" });
        const rolled = await this.simulation.rollback(id, body.tick);
        result = { status: "rolled_back", tick: rolled.tick };
        break;
      }
      default:
        throw new ForbiddenException({ error: "unsupported_action" });
    }
    await this.audit.log({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: `admin.sim_${body.action}`,
      targetType: "planet",
      targetId: id,
      detail: body,
      ip,
    });
    return result;
  }

  @Post("planets/:id/maps/render")
  async renderMaps(@Param("id") id: string) {
    const tick = await this.simulation.renderMaps(id, true);
    return { ok: true, tick };
  }

  @Get("ai-requests")
  async aiRequests(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number }) {
    const total = await this.db.selectFrom("ai_requests").select((eb) => eb.fn.countAll<number>().as("c")).executeTakeFirstOrThrow();
    const rows = await this.db
      .selectFrom("ai_requests")
      .selectAll()
      .orderBy("created_at", "desc")
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        kind: r.kind,
        sandbox: r.sandbox,
        tokensIn: r.tokens_in,
        tokensOut: r.tokens_out,
        costUsd: r.cost_usd,
        latencyMs: r.latency_ms,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      })),
      total: Number(total.c),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Get("ai-providers")
  aiProviders() {
    return this.ai.providerStatus();
  }

  @Get("ai-usage-daily")
  async aiUsageDaily() {
    const rows = await sql<{ day: string; cost: string; requests: string; latency: string }>`
      SELECT date_trunc('day', created_at)::date::text AS day,
             COALESCE(SUM(cost_usd), 0)::text AS cost,
             COUNT(*)::text AS requests,
             COALESCE(AVG(latency_ms), 0)::text AS latency
      FROM ai_requests
      WHERE created_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1
    `.execute(this.db);
    return rows.rows.map((r) => ({
      day: r.day,
      costUsd: Number(r.cost),
      requests: Number(r.requests),
      avgLatencyMs: Math.round(Number(r.latency)),
    }));
  }

  @Get("audit-logs")
  async auditLogs(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number }) {
    const total = await this.db.selectFrom("audit_logs").select((eb) => eb.fn.countAll<number>().as("c")).executeTakeFirstOrThrow();
    const rows = await this.db
      .selectFrom("audit_logs")
      .selectAll()
      .orderBy("created_at", "desc")
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorEmail: r.actor_email,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.detail,
        ip: r.ip,
        createdAt: r.created_at.toISOString(),
      })),
      total: Number(total.c),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Get("moderation")
  moderationQueue() {
    return this.moderation.queue();
  }

  @Post("moderation/:id/review")
  async moderationReview(
    @CurrentUser() actor: AccessClaims,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderationReviewSchema)) body: { decision: "approve" | "reject"; note?: string },
    @Ip() ip: string,
  ) {
    await this.moderation.review(id, actor.sub, body.decision, body.note);
    await this.audit.log({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: `admin.moderation_${body.decision}`,
      targetType: "moderation_result",
      targetId: id,
      detail: { note: body.note },
      ip,
    });
    return { ok: true };
  }
}
