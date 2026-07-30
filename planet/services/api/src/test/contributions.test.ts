import { describe, expect, it, vi } from "vitest";
import { ContributionsService } from "../contributions/contributions.service.js";

/**
 * Contribution pipeline with mocked infrastructure: verifies ordering
 * (analyze → preview → confirm), balance enforcement and impact scoring.
 */
function makeDeps() {
  const drafts = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const prisma = {
    userContribution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const d = { id: `c${++seq}`, ...data };
        drafts.set(d.id, d);
        return d;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const d = drafts.get(where.id);
        Object.assign(d ?? {}, data);
        return d;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => drafts.get(where.id) ?? null),
    },
    aIRequest: { create: vi.fn(async () => ({})) },
    moderationResult: { create: vi.fn(async () => ({})) },
    planet: { update: vi.fn(async () => ({})) },
    profile: { update: vi.fn(async () => ({})) },
    worldEvent: { findMany: vi.fn(async () => []) },
  };
  const engine = {
    previewContribution: vi.fn(async () => ({ successProbability: 0.8, horizons: [] })),
    applyContribution: vi.fn(async () => ({
      applied: true,
      tick: 55,
      rootEvent: { seq: 100, type: "CONTRIBUTION_APPLIED", importance: 0.7, causes: [], contributionId: "c1", payload: {}, confidence: 1, tick: 55, year: 55, hash: "x" },
      contributionEvents: [
        { seq: 100, type: "CONTRIBUTION_APPLIED", importance: 0.7, causes: [], payload: {}, confidence: 1, tick: 55, year: 55, hash: "x" },
        { seq: 101, type: "SPECIES_CREATED", importance: 0.6, causes: [100], payload: {}, confidence: 1, tick: 55, year: 55, hash: "y" },
      ],
      newEvents: [],
    })),
  };
  const orchestrator = {
    analyze: vi.fn(async () => ({
      analysis: { category: "plant", name: "شجرة", traits: {}, sandbox: true },
      balance: { verdict: "accept", reasons: [] },
      moderation: { flags: [] },
    })),
  };
  const worlds = {
    ensureEngineWorld: vi.fn(async () => {}),
    persistEvents: vi.fn(async () => {}),
    broadcastEvent: vi.fn(),
  };
  const notifications = { create: vi.fn(async () => ({})) };
  return { prisma, engine, orchestrator, worlds, notifications };
}

describe("ContributionsService pipeline", () => {
  it("runs draft → analyze → preview → confirm in order", async () => {
    const deps = makeDeps();
    const svc = new ContributionsService(
      deps.prisma as never, deps.engine as never, deps.orchestrator as never,
      deps.worlds as never, deps.notifications as never,
    );
    const draft = await svc.createDraft("u1", { category: "plant", text: "شجرة مضيئة", worldId: "w1" });
    expect(draft.status).toBe("draft");

    await svc.analyze("u1", draft.id, "ar");
    expect(deps.orchestrator.analyze).toHaveBeenCalledOnce();

    const preview = await svc.preview("u1", draft.id, 123);
    expect(preview.successProbability).toBe(0.8);

    const result = await svc.confirm("u1", draft.id);
    expect(result.contribution.status).toBe("applied");
    expect(result.contribution.eventCount).toBe(2);
    expect(result.contribution.impactScore).toBeCloseTo(1.3, 5);
    expect(deps.worlds.persistEvents).toHaveBeenCalled();
    expect(deps.notifications.create).toHaveBeenCalledOnce();
  });

  it("blocks confirm before preview", async () => {
    const deps = makeDeps();
    const svc = new ContributionsService(
      deps.prisma as never, deps.engine as never, deps.orchestrator as never,
      deps.worlds as never, deps.notifications as never,
    );
    const draft = await svc.createDraft("u1", { category: "plant", text: "شجرة", worldId: "w1" });
    await expect(svc.confirm("u1", draft.id)).rejects.toThrow("preview_first");
  });

  it("blocks other users' contributions", async () => {
    const deps = makeDeps();
    const svc = new ContributionsService(
      deps.prisma as never, deps.engine as never, deps.orchestrator as never,
      deps.worlds as never, deps.notifications as never,
    );
    const draft = await svc.createDraft("u1", { category: "plant", text: "شجرة", worldId: "w1" });
    await expect(svc.analyze("intruder", draft.id, "ar")).rejects.toThrow("contribution_not_found");
  });

  it("applies adjusted traits when balance nerfs the addition", async () => {
    const deps = makeDeps();
    deps.orchestrator.analyze = vi.fn(async () => ({
      analysis: { category: "creature", name: "وحش", traits: { lifespan: 1 }, sandbox: true },
      balance: { verdict: "adjust", reasons: ["immortality_forbidden"], adjustedTraits: { lifespan: 0.95 } },
      moderation: { flags: [] },
    }));
    const svc = new ContributionsService(
      deps.prisma as never, deps.engine as never, deps.orchestrator as never,
      deps.worlds as never, deps.notifications as never,
    );
    const draft = await svc.createDraft("u1", { category: "creature", text: "وحش خالد", worldId: "w1" });
    await svc.analyze("u1", draft.id, "ar");
    await svc.preview("u1", draft.id, 10);
    await svc.confirm("u1", draft.id);
    const appliedAnalysis = (deps.engine.applyContribution as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.analysis as { traits: { lifespan: number } };
    expect(appliedAnalysis.traits.lifespan).toBe(0.95);
  });
});
