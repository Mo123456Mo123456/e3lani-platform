import { describe, expect, it, vi, beforeEach } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../auth/auth.service.js";
import { roleAtLeast, ROLE_ORDER } from "../auth/guards.js";
import { RateLimiter } from "../common/rate-limit.js";

/** Hand-rolled Prisma mock — unit tests never touch a real database. */
function makePrismaMock() {
  const users: { id: string; email: string; passwordHash: string; status: string; roleId: number; role: { name: string } }[] = [];
  const tokens: { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }[] = [];
  let userSeq = 0;
  return {
    _users: users,
    _tokens: tokens,
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((u) => u.email === where.email || u.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error("not_found");
        return u;
      }),
      create: vi.fn(async ({ data }: { data: { email: string; passwordHash: string; roleId: number } }) => {
        const u = {
          id: `u${++userSeq}`,
          email: data.email,
          passwordHash: data.passwordHash,
          status: "active",
          roleId: data.roleId,
          role: { name: "registered" },
        };
        users.push(u);
        return u;
      }),
    },
    role: {
      findUnique: vi.fn(async ({ where }: { where: { name: string } }) =>
        where.name === "registered" ? { id: 2, name: "registered" } : null),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const t = { id: `t${tokens.length}`, ...data, revokedAt: null };
        tokens.push(t);
        return t;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        tokens.find((t) => t.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<(typeof tokens)[number]> }) => {
        const t = tokens.find((x) => x.id === where.id);
        Object.assign(t ?? {}, data);
        return t;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId?: string; revokedAt?: null }; data: { revokedAt: Date } }) => {
        for (const t of tokens) {
          if (where.userId && t.userId !== where.userId) continue;
          if (t.revokedAt === null) t.revokedAt = data.revokedAt;
        }
        return { count: 1 };
      }),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auth: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    auth = new AuthService(prisma as never, new JwtService({}));
  });

  it("registers a user and issues a token pair", async () => {
    const { user, tokens } = await auth.register({
      email: "Test@Example.com",
      password: "supersecret1",
      displayName: "مختبر",
      locale: "ar",
    });
    expect(user.email).toBe("test@example.com");
    expect(tokens.accessToken.length).toBeGreaterThan(20);
    expect(tokens.refreshToken.length).toBeGreaterThan(20);
  });

  it("rejects duplicate emails", async () => {
    const input = { email: "a@b.co", password: "supersecret1", displayName: "ab", locale: "ar" as const };
    await auth.register(input);
    await expect(auth.register(input)).rejects.toThrow("email_already_registered");
  });

  it("logs in with correct credentials only", async () => {
    await auth.register({ email: "a@b.co", password: "supersecret1", displayName: "ab", locale: "ar" });
    await expect(auth.login({ email: "a@b.co", password: "wrong-password" })).rejects.toThrow("invalid_credentials");
    const tokens = await auth.login({ email: "a@b.co", password: "supersecret1" });
    expect(tokens.accessToken).toBeDefined();
  });

  it("rotates refresh tokens and detects reuse", async () => {
    await auth.register({ email: "a@b.co", password: "supersecret1", displayName: "ab", locale: "ar" });
    const first = await auth.login({ email: "a@b.co", password: "supersecret1" });

    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Presenting the old (rotated) token again = reuse → family revoked.
    await expect(auth.refresh(first.refreshToken)).rejects.toThrow("refresh_token_reuse_detected");
    await expect(auth.refresh(second.refreshToken)).rejects.toThrow();
  });

  it("verifies access tokens", async () => {
    await auth.register({ email: "a@b.co", password: "supersecret1", displayName: "ab", locale: "ar" });
    const { accessToken } = await auth.login({ email: "a@b.co", password: "supersecret1" });
    const payload = auth.verifyAccess(accessToken);
    expect(payload.email).toBe("a@b.co");
    expect(payload.role).toBe("registered");
    expect(() => auth.verifyAccess(accessToken + "x")).toThrow("invalid_access_token");
  });
});

describe("RBAC hierarchy", () => {
  it("orders roles correctly", () => {
    expect(ROLE_ORDER.length).toBe(10);
    expect(roleAtLeast("super_admin", "registered")).toBe(true);
    expect(roleAtLeast("simulation_manager", "content_moderator")).toBe(true);
    expect(roleAtLeast("registered", "super_admin")).toBe(false);
    expect(roleAtLeast("visitor", "visitor")).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("allows within limit, blocks beyond it", () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 5; i++) expect(rl.allow("k", 5, 1000)).toBe(true);
    expect(rl.allow("k", 5, 1000)).toBe(false);
    expect(rl.remaining("k", 5, 1000)).toBe(0);
  });
});
