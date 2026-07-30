import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { loginInput, refreshInput, registerInput } from "@planet/validation";
import type { StoredUser } from "../store/repository";
import { hashPassword, verifyPassword } from "../auth/passwords";
import { requireAuth } from "../auth/guards";
import type { AppContext } from "../context";

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/auth/register", {
    schema: { tags: ["auth"], summary: "Create an account (email + password)" },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = registerInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid_input", details: parsed.error.flatten() });
    }
    const { email, password, displayName } = parsed.data;
    const existing = await ctx.repository.findUserByEmail(email);
    if (existing) {
      return reply.code(409).send({ error: "email_already_registered" });
    }
    const user: StoredUser = {
      id: randomUUID(),
      email: email.toLowerCase(),
      displayName,
      roles: ["user"],
      provider: "email",
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    await ctx.repository.createUser(user);
    const tokens = await ctx.tokens.issue(user);
    await ctx.repository.audit(user.id, "user_registered", { email: user.email });
    ctx.tracker.track("user_registered", { userId: user.id });
    const { passwordHash, ...publicUser } = user;
    return reply.code(201).send({ user: publicUser, tokens });
  });

  app.post("/auth/login", {
    schema: { tags: ["auth"], summary: "Log in with email + password" },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = loginInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid_input" });
    }
    const user = await ctx.repository.findUserByEmail(parsed.data.email);
    if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const tokens = await ctx.tokens.issue(user);
    ctx.tracker.track("user_login", { userId: user.id });
    const { passwordHash, ...publicUser } = user;
    return reply.send({ user: publicUser, tokens });
  });

  app.post("/auth/refresh", {
    schema: { tags: ["auth"], summary: "Rotate a refresh token" },
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = refreshInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid_input" });
    }
    const result = await ctx.tokens.rotate(parsed.data.refreshToken);
    if (result === "reuse-detected") {
      return reply.code(401).send({ error: "refresh_token_reuse_detected", detail: "all sessions in this family were revoked" });
    }
    if (!result) {
      return reply.code(401).send({ error: "invalid_refresh_token" });
    }
    const { passwordHash, ...publicUser } = result.user as StoredUser;
    return reply.send({ user: publicUser, tokens: result.tokens });
  });

  app.post("/auth/logout", {
    schema: { tags: ["auth"], summary: "Revoke a refresh token family" },
  }, async (request, reply) => {
    const parsed = refreshInput.safeParse(request.body);
    if (parsed.success) await ctx.tokens.logout(parsed.data.refreshToken);
    return reply.send({ ok: true });
  });

  app.get("/me", {
    preHandler: requireAuth,
    schema: { tags: ["auth"], summary: "Current user profile" },
  }, async (request, reply) => {
    const user = await ctx.repository.findUserById(request.user.sub);
    if (!user) return reply.code(404).send({ error: "not_found" });
    const contributions = await ctx.repository.contributionsByUser(user.id);
    const unread = await ctx.repository.countUnread(user.id);
    const { passwordHash, ...publicUser } = user;
    return reply.send({
      user: publicUser,
      stats: {
        contributions: contributions.length,
        placed: contributions.filter((c) => c.status === "placed").length,
        totalImpact: contributions.reduce((sum, c) => sum + c.impactScore, 0),
        unreadNotifications: unread,
      },
    });
  });
}
