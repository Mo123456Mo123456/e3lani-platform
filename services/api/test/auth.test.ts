import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, loginAdmin, registerUser, authHeader, type TestHarness } from "./helpers.js";

let h: TestHarness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.app.close();
});

describe("auth", () => {
  it("registers, logs in and returns a profile", async () => {
    const { tokens } = await registerUser(h.app, "a@test.dev");
    const me = await h.app.inject({ method: "GET", url: "/me", headers: authHeader(tokens.accessToken) });
    expect(me.statusCode).toBe(200);
    const body = me.json() as { user: { email: string; roles: string[] }; stats: { contributions: number } };
    expect(body.user.email).toBe("a@test.dev");
    expect(body.user.roles).toContain("user");
    expect(body.stats.contributions).toBe(0);
  });

  it("rejects duplicate emails and bad passwords", async () => {
    await registerUser(h.app, "dup@test.dev");
    const dup = await h.app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@test.dev", password: "password-456", displayName: "مستخدم مكرر" },
    });
    expect(dup.statusCode).toBe(409);
    const bad = await h.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dup@test.dev", password: "wrong-password" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("rotates refresh tokens and detects reuse", async () => {
    const { tokens } = await registerUser(h.app, "rotate@test.dev");
    const first = await h.app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(first.statusCode).toBe(200);
    const rotated = first.json() as { tokens: { refreshToken: string } };

    // replaying the old token is an attack — the whole family dies
    const replay = await h.app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.body).toContain("reuse");

    // even the legitimately rotated token is now revoked
    const after = await h.app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: rotated.tokens.refreshToken },
    });
    expect(after.statusCode).toBe(401);
  });

  it("enforces RBAC on admin endpoints", async () => {
    const { tokens } = await registerUser(h.app, "plain@test.dev");
    const forbidden = await h.app.inject({
      method: "GET",
      url: "/admin/users",
      headers: authHeader(tokens.accessToken),
    });
    expect(forbidden.statusCode).toBe(403);

    const admin = await loginAdmin(h.app);
    const allowed = await h.app.inject({
      method: "GET",
      url: "/admin/users",
      headers: authHeader(admin.tokens.accessToken),
    });
    expect(allowed.statusCode).toBe(200);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await h.app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
  });
});
