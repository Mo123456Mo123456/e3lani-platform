import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { sdk } from "../server/_core/sdk";
import {
  adminProcedure,
  financeProcedure,
  ownerProcedure,
  protectedProcedure,
  reviewerProcedure,
  router,
  staffProcedure,
  supportProcedure,
} from "../server/_core/trpc";

type UserRole = NonNullable<TrpcContext["user"]>["role"];
type UserStatus = NonNullable<TrpcContext["user"]>["status"];

const accessRouter = router({
  protected: protectedProcedure.query(({ ctx }) => ctx.user.role),
  review: reviewerProcedure.query(({ ctx }) => ctx.user.role),
  finance: financeProcedure.query(({ ctx }) => ctx.user.role),
  support: supportProcedure.query(({ ctx }) => ctx.user.role),
  staff: staffProcedure.query(({ ctx }) => ctx.user.role),
  admin: adminProcedure.query(({ ctx }) => ctx.user.role),
  owner: ownerProcedure.query(({ ctx }) => ctx.user.role),
});

function createContext(role: UserRole, status: UserStatus = "active"): TrpcContext {
  return {
    user: {
      id: 10,
      openId: `test-${role}`,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      accountType: "viewer",
      status,
      preferredLanguage: "ar",
      cityId: null,
      countryCode: null,
      phone: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("server role matrix", () => {
  it.each([
    ["review", "reviewer"],
    ["review", "admin"],
    ["review", "owner"],
    ["finance", "finance"],
    ["finance", "admin"],
    ["finance", "owner"],
    ["support", "support"],
    ["support", "admin"],
    ["support", "owner"],
    ["staff", "reviewer"],
    ["staff", "finance"],
    ["staff", "support"],
    ["admin", "admin"],
    ["admin", "owner"],
    ["owner", "owner"],
  ] as const)("allows %s for %s", async (procedure, role) => {
    const caller = accessRouter.createCaller(createContext(role));
    await expect(caller[procedure]()).resolves.toBe(role);
  });

  it.each([
    ["review", "user"],
    ["finance", "reviewer"],
    ["support", "finance"],
    ["admin", "support"],
    ["owner", "admin"],
  ] as const)("denies %s for %s", async (procedure, role) => {
    const caller = accessRouter.createCaller(createContext(role));
    await expect(caller[procedure]()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a suspended account from every protected procedure", async () => {
    const caller = accessRouter.createCaller(createContext("owner", "suspended"));
    await expect(caller.protected()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("session token hardening", () => {
  it("issues a token with an application-bound session identifier", async () => {
    const token = await sdk.createSessionToken("test-open-id", {
      name: "Test User",
      expiresInMs: 60_000,
    });
    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "test-open-id",
      name: "Test User",
      legacy: false,
    });
    expect(session?.tokenId).toBeTruthy();
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a token signed for a different application id", async () => {
    const token = await sdk.signSession(
      {
        openId: "test-open-id",
        appId: "different-app",
        name: "Test User",
        tokenId: "different-app-token",
      },
      { expiresInMs: 60_000 },
    );

    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });
});
