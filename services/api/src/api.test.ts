import { describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth/auth.service.js";
import { NotificationWorker } from "./notifications/notification-worker.js";
import { EventBus } from "./common/event-bus.js";
import type { WorldEvent } from "@kawkab/shared-types";

/** minimal in-memory Prisma stub covering the auth + notification flows */
function fakePrisma() {
  const state = {
    users: new Map<string, { id: string; email: string; displayName: string; role: "USER"; passwordHash?: string; bannedAt: Date | null; avatarUrl: null }>(),
    refreshTokens: [] as Array<{ id: string; userId: string; tokenHash: string; family: string; revoked: boolean; expiresAt: Date }>,
    notifications: [] as Array<{ userId: string; type: string; title: string; body: string; data: Record<string, unknown> }>,
    contributions: new Map<string, { id: string; userId: string; eventCount: number; impactScore: number }>(),
  };
  let seq = 0;
  const prisma = {
    _state: state,
    user: {
      findUnique: async ({ where: { email } }: { where: { email: string } }) => [...state.users.values()].find((u) => u.email === email) ?? null,
      create: async ({ data }: { data: { email: string; passwordHash: string; displayName: string; locale?: string } }) => {
        const user = { id: `u_${++seq}`, email: data.email, displayName: data.displayName, role: "USER" as const, passwordHash: data.passwordHash, bannedAt: null, avatarUrl: null };
        state.users.set(user.id, user);
        return user;
      },
      update: async ({ where: { id } }: { where: { id: string } }) => state.users.get(id),
    },
    refreshToken: {
      findUnique: async ({ where: { tokenHash } }: { where: { tokenHash: string } }) => {
        const rt = state.refreshTokens.find((t) => t.tokenHash === tokenHash) ?? null;
        return rt ? { ...rt, user: state.users.get(rt.userId) } : null;
      },
      create: async ({ data }: { data: { userId: string; tokenHash: string; family: string; expiresAt: Date } }) => {
        const rt = { id: `rt_${++seq}`, revoked: false, ...data };
        state.refreshTokens.push(rt);
        return rt;
      },
      update: async ({ where: { id }, data }: { where: { id: string }; data: Partial<{ revoked: boolean; replacedById: string }> }) => {
        const rt = state.refreshTokens.find((t) => t.id === id)!;
        Object.assign(rt, data);
        return rt;
      },
      updateMany: async ({ where, data }: { where: { family?: string; tokenHash?: string }; data: { revoked: boolean } }) => {
        let count = 0;
        for (const t of state.refreshTokens) {
          if ((where.family && t.family === where.family) || (where.tokenHash && t.tokenHash === where.tokenHash)) {
            t.revoked = data.revoked;
            count++;
          }
        }
        return { count };
      },
    },
    notification: {
      create: async ({ data }: { data: { userId: string; type: string; title: string; body: string; data: Record<string, unknown> } }) => {
        state.notifications.push(data);
        return data;
      },
      findFirst: async () => null,
    },
    userContribution: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) => state.contributions.get(id) ?? null,
      update: async ({ where: { id }, data }: { where: { id: string }; data: { eventCount?: { increment: number }; impactScore?: { increment: number } } }) => {
        const c = state.contributions.get(id)!;
        if (data.eventCount) c.eventCount += data.eventCount.increment;
        if (data.impactScore) c.impactScore += data.impactScore.increment;
        return c;
      },
    },
    profile: { update: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    auditLog: { create: async () => ({}) },
  };
  return prisma;
}

const jwt = new JwtService({});

describe("auth service: registration, login, refresh rotation", () => {
  it("registers, logs in, rotates refresh tokens and detects reuse", async () => {
    const prisma = fakePrisma();
    const auth = new AuthService(prisma as never, jwt);

    const { user, tokens } = await auth.register({ email: "Test@Kawkab.dev", password: "super-secret-1", displayName: "اختبار" });
    expect(user.email).toBe("test@kawkab.dev");
    expect(tokens.accessToken.length).toBeGreaterThan(20);

    const login = await auth.login({ email: "test@kawkab.dev", password: "super-secret-1" });
    expect(login.user.id).toBe(user.id);

    // rotation: old token works once…
    const rotated = await auth.refresh(tokens.refreshToken);
    expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);

    // …and using it again revokes the family (reuse detection)
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow();
    // the rotated token (same family) is now dead too
    await expect(auth.refresh(rotated.tokens.refreshToken)).rejects.toThrow();
  });

  it("rejects wrong passwords", async () => {
    const prisma = fakePrisma();
    const auth = new AuthService(prisma as never, jwt);
    await auth.register({ email: "a@b.co", password: "correct-horse", displayName: "ab" });
    await expect(auth.login({ email: "a@b.co", password: "wrong" })).rejects.toThrow();
  });
});

describe("notification worker", () => {
  const mkEvent = (over: Partial<WorldEvent>): WorldEvent => ({
    id: "ev_1", tick: 10, simYear: 10, type: "WAR_STARTED", title: "حرب", summary: "اندلعت حرب",
    region: null, actorIds: [], causeIds: [], contributionId: "c1", confidence: 1, magnitude: 0.7, data: {}, ...over,
  });

  it("notifies owners on noteworthy descendant events and bumps counters", async () => {
    const prisma = fakePrisma();
    prisma._state.contributions.set("c1", { id: "c1", userId: "u1", eventCount: 0, impactScore: 0 });
    const bus = new EventBus();
    const worker = new NotificationWorker(bus as never, prisma as never);
    await worker.handle("p1", mkEvent({}));
    expect(prisma._state.notifications.length).toBe(1);
    expect(prisma._state.contributions.get("c1")!.eventCount).toBe(1);
  });

  it("ignores genesis-scale or contribution-unrelated events", async () => {
    const prisma = fakePrisma();
    prisma._state.contributions.set("c1", { id: "c1", userId: "u1", eventCount: 0, impactScore: 0 });
    const bus = new EventBus();
    const worker = new NotificationWorker(bus as never, prisma as never);
    await worker.handle("p1", mkEvent({ contributionId: null }));
    await worker.handle("p1", mkEvent({ type: "STORM_FORMED", magnitude: 0.3 }));
    expect(prisma._state.notifications.length).toBe(0);
  });
});
