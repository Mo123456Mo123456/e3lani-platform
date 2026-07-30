import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Kysely } from "kysely";
import type {
  ContributionAssessment,
  StructuredContribution,
  UserContributionDto,
  WorldEvent,
} from "@planet/shared-types";
import { structuredContributionSchema } from "@planet/validation";
import { AiService } from "../ai/ai.service";
import { AuditService } from "../common/audit.service";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import { ModerationService } from "../moderation/moderation.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { SimulationService } from "../simulation/simulation.service";

const PREVIEW_MAX_RUNS_FULL = 6;
const PREVIEW_QUICK_HORIZON = 100;

@Injectable()
export class ContributionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ContributionsService");
  private workerTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ai: AiService,
    private readonly moderation: ModerationService,
    private readonly simulation: SimulationService,
    private readonly notifications: NotificationsService,
    private readonly gateway: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workerTimer = setInterval(() => void this.processPreviewJobs(), 2000);
  }

  onModuleDestroy(): void {
    if (this.workerTimer) clearInterval(this.workerTimer);
  }

  // ------------------------------------------------------------------
  // Step 1-2: draft (category + free text)
  // ------------------------------------------------------------------
  async createDraft(userId: string, input: { planetId: string; text: string; category?: string }) {
    const verdict = this.moderation.check(input.text);
    if (verdict.status === "block") {
      await this.moderation.record(userId, "contribution", input.text, verdict);
      throw new UnprocessableEntityException({ error: "moderation_blocked", reasons: verdict.reasons });
    }
    const row = await this.db
      .insertInto("user_contributions")
      .values({
        user_id: userId,
        planet_id: input.planetId,
        category: input.category ?? "custom",
        raw_text: input.text,
        status: "draft",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (verdict.status === "flag") {
      await this.moderation.record(userId, "contribution", input.text, verdict);
    }
    return this.getContribution(userId, row.id);
  }

  // ------------------------------------------------------------------
  // Step 3-6: AI analysis -> structured traits -> balance -> preview card
  // ------------------------------------------------------------------
  async analyze(userId: string, id: string) {
    const draft = await this.owned(userId, id);
    if (!["draft", "analyzed", "rejected", "failed"].includes(draft.status)) {
      throw new BadRequestException({ error: "invalid_state", status: draft.status });
    }
    await this.setStatus(id, "analyzing");
    try {
      const result = await this.ai.analyze(draft.raw_text, "ar", draft.category === "custom" ? undefined : draft.category, {
        userId,
        contributionId: id,
      });
      const moderation = result.moderation;
      if (moderation.status === "block") {
        await this.moderation.record(userId, "contribution", draft.raw_text, {
          status: "block",
          reasons: moderation.reasons,
        });
        await this.setStatus(id, "rejected");
        throw new UnprocessableEntityException({ error: "moderation_blocked", reasons: moderation.reasons });
      }
      const balance = result.balance as {
        verdict: string; issues: Array<Record<string, unknown>>; suggested: Record<string, unknown> | null;
      } | null;
      const contribution = (result.contribution ?? {}) as Record<string, unknown>;
      const finalData =
        balance?.verdict === "adjusted" && balance.suggested ? balance.suggested : contribution;
      // enforce schema server-side regardless of provider output
      const validated = structuredContributionSchema.parse({
        ...finalData,
        category: finalData.category ?? contribution.category ?? draft.category,
        name: finalData.name ?? draft.raw_text.slice(0, 60),
        provider: result.provider,
        sandbox: result.sandbox,
      });
      await this.db
        .updateTable("user_contributions")
        .set({
          structured: validated as never,
          balance: (balance ?? null) as never,
          graph: (result.graph ?? null) as never,
          name: validated.name,
          category: validated.category,
          provider: result.provider,
          sandbox: result.sandbox,
          status: balance?.verdict === "rejected" ? "rejected" : "analyzed",
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();
      return {
        contribution: validated as unknown as StructuredContribution,
        balance,
        graph: result.graph,
        provider: result.provider,
        sandbox: result.sandbox,
      };
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err;
      await this.setStatus(id, "failed").catch(() => undefined);
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Step 7-9: choose region -> algorithmic assessment -> future preview
  // ------------------------------------------------------------------
  async assess(userId: string, id: string, targetCellId: number | null | undefined): Promise<ContributionAssessment> {
    const draft = await this.owned(userId, id);
    if (!["analyzed", "previewed"].includes(draft.status)) {
      throw new BadRequestException({ error: "invalid_state", status: draft.status });
    }
    const planet = await this.simulation.getPlanet(draft.planet_id);
    const structured = draft.structured as Record<string, unknown>;
    const result = await this.simulation.assessOn(planet, {
      ...structured,
      targetCellId: targetCellId ?? draft.target_cell_id,
    });
    await this.db
      .updateTable("user_contributions")
      .set({
        assessment: result as never,
        target_cell_id: targetCellId ?? draft.target_cell_id,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
    return result as unknown as ContributionAssessment;
  }

  async requestPreview(
    userId: string,
    id: string,
    input: { horizons?: number[]; runs?: number; targetCellId?: number | null },
  ): Promise<{ jobId: string }> {
    const draft = await this.owned(userId, id);
    if (!["analyzed", "previewed"].includes(draft.status)) {
      throw new BadRequestException({ error: "invalid_state", status: draft.status });
    }
    const horizons = input.horizons ?? [1, 10, 100];
    let runs = input.runs ?? 3;
    if (horizons.some((h) => h > PREVIEW_QUICK_HORIZON)) {
      runs = Math.min(runs, 3);
    } else {
      runs = Math.min(runs, PREVIEW_MAX_RUNS_FULL);
    }
    if (input.targetCellId !== undefined) {
      await this.db.updateTable("user_contributions").set({ target_cell_id: input.targetCellId }).where("id", "=", id).execute();
    }
    const job = await this.db
      .insertInto("jobs")
      .values({
        kind: "contribution_preview",
        payload: { contributionId: id, horizons, runs },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await this.setStatus(id, "previewing");
    this.gateway.emitToUser(userId, "contribution:status", { contributionId: id, status: "previewing" });
    return { jobId: job.id };
  }

  async previewResult(userId: string, id: string) {
    const draft = await this.owned(userId, id);
    return {
      status: draft.status,
      report: draft.preview_report ?? null,
    };
  }

  private async processPreviewJobs(): Promise<void> {
    try {
      const job = await this.db
        .selectFrom("jobs")
        .selectAll()
        .where("kind", "=", "contribution_preview")
        .where("status", "=", "queued")
        .where("run_after", "<=", new Date())
        .orderBy("created_at", "asc")
        .limit(1)
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (!job) return;
      await this.db.updateTable("jobs").set({ status: "running", attempts: job.attempts + 1, updated_at: new Date() }).where("id", "=", job.id).execute();
      const payload = job.payload as { contributionId: string; horizons?: number[]; runs?: number };
      const draft = await this.db
        .selectFrom("user_contributions")
        .selectAll()
        .where("id", "=", payload.contributionId)
        .executeTakeFirst();
      if (!draft?.structured) {
        await this.db.updateTable("jobs").set({ status: "failed", error: "contribution_missing" }).where("id", "=", job.id).execute();
        return;
      }
      try {
        const planet = await this.simulation.getPlanet(draft.planet_id);
        const contribution = {
          ...(draft.structured as Record<string, unknown>),
          targetCellId: draft.target_cell_id,
        };
        const { report } = await this.simulation.scenariosOn(
          planet,
          contribution,
          payload.horizons,
          payload.runs,
        );
        await this.db
          .updateTable("user_contributions")
          .set({ preview_report: report as never, status: "previewed", updated_at: new Date() })
          .where("id", "=", draft.id)
          .execute();
        await this.db.updateTable("jobs").set({ status: "done", result: { ok: true }, updated_at: new Date() }).where("id", "=", job.id).execute();
        this.gateway.emitToUser(draft.user_id, "contribution:status", {
          contributionId: draft.id,
          status: "previewed",
          detail: { probabilistic: true },
        });
      } catch (err) {
        this.logger.warn(`preview job ${job.id} failed: ${(err as Error).message}`);
        await this.db.updateTable("jobs").set({ status: "failed", error: (err as Error).message.slice(0, 500), updated_at: new Date() }).where("id", "=", job.id).execute();
        await this.setStatus(draft.id, "analyzed");
        this.gateway.emitToUser(draft.user_id, "contribution:status", {
          contributionId: draft.id,
          status: "preview_failed",
        });
      }
    } catch (err) {
      this.logger.error(`preview worker error: ${(err as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // Step 10-12: confirm -> inject into world -> narrative from real events
  // ------------------------------------------------------------------
  async confirm(
    userId: string,
    id: string,
    input: { targetCellId?: number | null; finalName?: string; finalTraits?: Record<string, number | string> },
  ): Promise<{ contribution: UserContributionDto; narrative: string; events: WorldEvent[] }> {
    const draft = await this.owned(userId, id);
    if (!["analyzed", "previewed"].includes(draft.status)) {
      throw new BadRequestException({ error: "invalid_state", status: draft.status });
    }
    const structured = draft.structured as Record<string, unknown>;
    const merged = structuredContributionSchema.parse({
      ...structured,
      name: input.finalName ?? structured.name,
      traits: { ...(structured.traits as Record<string, number | string>), ...(input.finalTraits ?? {}) },
      provider: draft.provider ?? "unknown",
      sandbox: draft.sandbox,
    });
    const targetCellId = input.targetCellId ?? draft.target_cell_id ?? null;

    const { events } = await this.simulation.injectContribution(draft.planet_id, {
      id: draft.id,
      category: merged.category,
      name: merged.name,
      traits: merged.traits,
      possibleBiomes: merged.possibleBiomes,
      targetCellId,
    });

    await this.db
      .updateTable("user_contributions")
      .set({
        status: "applied",
        applied_tick: (await this.simulation.getPlanet(draft.planet_id)).tick,
        target_cell_id: targetCellId,
        structured: merged as never,
        name: merged.name,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();

    // narrative STRICTLY from the events the engine just produced
    const narrated = await this.ai
      .narrate(events as unknown as Array<Record<string, unknown>>, "ar", { userId, contributionId: id })
      .catch(() => null);
    const narrative = narrated?.text ?? "";
    if (narrative) {
      await this.db.updateTable("user_contributions").set({ narrative }).where("id", "=", id).execute();
    }

    await this.maybeUpgradeRole(userId, merged.category);
    await this.audit.log({
      actorId: userId,
      actorEmail: null,
      action: "contribution.applied",
      targetType: "contribution",
      targetId: id,
      detail: { category: merged.category, sandbox: draft.sandbox },
    });
    this.gateway.emitToUser(userId, "contribution:status", {
      contributionId: id,
      status: "applied",
      detail: { eventIds: events.map((e) => e.id) },
    });

    const contribution = await this.getContribution(userId, id);
    return { contribution, narrative, events: events as unknown as WorldEvent[] };
  }

  private async maybeUpgradeRole(userId: string, category: string): Promise<void> {
    const upgrades: Array<[string, string]> = [];
    const appliedCount = await this.db
      .selectFrom("user_contributions")
      .where("user_id", "=", userId)
      .where("status", "=", "applied")
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .executeTakeFirstOrThrow();
    if (Number(appliedCount.c) >= 1) upgrades.push(["life_maker", "صانع حياة — أضاف أول عنصر إلى العالم"]);
    if (category === "civilization") upgrades.push(["civ_builder", "منشئ حضارات — أسس حضارة جديدة"]);
    const user = await this.db.selectFrom("users").select(["role", "locale"]).where("id", "=", userId).executeTakeFirstOrThrow();
    const rankOf = (r: string) =>
      ["visitor", "user", "explorer", "life_maker", "civ_builder", "historian", "moderator", "sim_manager", "admin", "super_admin"].indexOf(r);
    for (const [role, achievement] of upgrades) {
      if (rankOf(user.role) < rankOf(role)) {
        await this.db.updateTable("users").set({ role, updated_at: new Date() }).where("id", "=", userId).execute();
      }
      await this.db.insertInto("roles").values({ user_id: userId, role }).onConflict((oc) => oc.doNothing()).execute();
      await this.db
        .updateTable("profiles")
        .set((eb) => ({
          achievements: eb.fn("jsonb_append", [eb.ref("achievements"), eb.val(JSON.stringify([achievement]))]) as never,
          updated_at: new Date(),
        }))
        .where("user_id", "=", userId)
        .execute();
      await this.notifications.create(userId, "achievement", "إنجاز جديد", achievement, { role });
    }
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------
  async getContribution(userId: string, id: string): Promise<UserContributionDto> {
    const row = await this.owned(userId, id);
    return this.toDto(row);
  }

  async mine(userId: string): Promise<UserContributionDto[]> {
    const rows = await this.db
      .selectFrom("user_contributions")
      .selectAll()
      .where("user_id", "=", userId)
      .where("status", "in", ["analyzed", "previewed", "applied", "previewing"])
      .orderBy("created_at", "desc")
      .limit(100)
      .execute();
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  async impact(userId: string, id: string) {
    const draft = await this.owned(userId, id);
    const descendants = await this.db
      .selectFrom("causal_links")
      .innerJoin("world_events", (j) =>
        j.onRef("world_events.id", "=", "causal_links.event_id").onRef("world_events.planet_id", "=", "causal_links.planet_id"),
      )
      .select(["world_events.id", "world_events.tick", "world_events.type", "world_events.importance", "world_events.cell_id", "world_events.civ_ids"])
      .where("causal_links.planet_id", "=", draft.planet_id)
      .where("causal_links.contribution_id", "=", id)
      .orderBy("world_events.tick", "asc")
      .limit(500)
      .execute();
    const civIds = new Set<string>();
    const cells = new Set<number>();
    for (const d of descendants) {
      for (const civ of (d.civ_ids as string[]) ?? []) civIds.add(civ);
      if (d.cell_id !== null) cells.add(d.cell_id);
    }
    return {
      contribution: await this.toDto(draft),
      descendantEvents: descendants.map((d) => ({
        id: d.id,
        tick: d.tick,
        type: d.type,
        importance: d.importance,
        cellId: d.cell_id,
      })),
      spreadCells: [...cells],
      affectedCivIds: [...civIds],
    };
  }

  private async toDto(row: {
    id: string; user_id: string; planet_id: string; category: string; name: string | null;
    status: string; structured: unknown; target_cell_id: number | null; applied_tick: number | null;
    provider: string | null; sandbox: boolean; created_at: Date;
  }): Promise<UserContributionDto> {
    const impactStats = await this.db
      .selectFrom("causal_links")
      .leftJoin("world_events", (j) =>
        j.onRef("world_events.id", "=", "causal_links.event_id").onRef("world_events.planet_id", "=", "causal_links.planet_id"),
      )
      .where("causal_links.planet_id", "=", row.planet_id)
      .where("causal_links.contribution_id", "=", row.id)
      .select((eb) => [
        eb.fn.countAll<number>().as("events"),
        eb.fn.max("world_events.tick").as("last_tick"),
      ])
      .executeTakeFirst();
    const civCount = await this.db
      .selectFrom("civilizations")
      .where("planet_id", "=", row.planet_id)
      .where("contribution_id", "=", row.id)
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .executeTakeFirstOrThrow();
    return {
      id: row.id,
      userId: row.user_id,
      planetId: row.planet_id,
      category: row.category as UserContributionDto["category"],
      name: row.name ?? "—",
      status: row.status as UserContributionDto["status"],
      traits: ((row.structured as { traits?: Record<string, number | string> })?.traits) ?? {},
      targetCellId: row.target_cell_id,
      appliedTick: row.applied_tick,
      provider: row.provider,
      sandbox: row.sandbox,
      impact: {
        descendantEvents: Number(impactStats?.events ?? 0),
        affectedCivs: Number(civCount.c),
        affectedCells: 0,
        lastEventAt: (impactStats?.last_tick as number | null) ?? null,
      },
      createdAt: row.created_at.toISOString(),
    };
  }

  private async owned(userId: string, id: string) {
    const row = await this.db
      .selectFrom("user_contributions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) throw new NotFoundException({ error: "contribution_not_found" });
    if (row.user_id !== userId) throw new ForbiddenException({ error: "not_your_contribution" });
    return row;
  }

  private async setStatus(id: string, status: string): Promise<void> {
    await this.db.updateTable("user_contributions").set({ status, updated_at: new Date() }).where("id", "=", id).execute();
  }
}
