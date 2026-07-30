import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { RateLimitGuard } from "./rate-limit.guard";
import { estimateCostUsd } from "../ai/ai.service";

function ctxWith(user: { role: string } | null, meta?: unknown): ExecutionContext {
  const req: Record<string, unknown> = { user: user ?? undefined, ip: "127.0.0.1", headers: {} };
  if (meta) (req as Record<string, unknown>).__meta = meta;
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ setHeader: vi.fn() }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestClass {},
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows when no minimum role set", () => {
    expect(new RolesGuard().canActivate(ctxWith(null))).toBe(true);
  });
  it("rejects anonymous users on protected routes", () => {
    const ReflectAny = Reflect as { getMetadata: (k: unknown, t: unknown) => unknown };
    vi.spyOn(ReflectAny, "getMetadata").mockReturnValue("admin");
    expect(() => new RolesGuard().canActivate(ctxWith(null))).toThrow(ForbiddenException);
    vi.restoreAllMocks();
  });
  it("enforces rank order (moderator < admin)", () => {
    const ReflectAny = Reflect as { getMetadata: (k: unknown, t: unknown) => unknown };
    const spy = vi.spyOn(ReflectAny, "getMetadata").mockReturnValue("admin");
    expect(() => new RolesGuard().canActivate(ctxWith({ role: "moderator" }))).toThrow(ForbiddenException);
    expect(new RolesGuard().canActivate(ctxWith({ role: "super_admin" }))).toBe(true);
    spy.mockRestore();
  });
});

describe("RateLimitGuard", () => {
  it("blocks after exceeding the limit", () => {
    const ReflectAny = Reflect as { getMetadata: (k: unknown, t: unknown) => unknown };
    const spy = vi.spyOn(ReflectAny, "getMetadata").mockReturnValue({ points: 2, windowSeconds: 60 });
    const guard = new RateLimitGuard();
    const ctx = ctxWith(null);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow();
    spy.mockRestore();
  });
});

describe("AI cost estimation", () => {
  it("sandbox/mock costs zero", () => {
    expect(estimateCostUsd("mock", true, 10_000, 10_000)).toBe(0);
  });
  it("real providers accumulate cost", () => {
    expect(estimateCostUsd("openai", false, 1000, 1000)).toBeCloseTo(0.00015 + 0.0006, 8);
  });
});
