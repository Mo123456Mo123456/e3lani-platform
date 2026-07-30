import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { loginSchema, registerSchema } from "@planet/validation";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const exists = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);
    if (exists.length) return reply.code(409).send({ error: "email_taken" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: parsed.data.email,
        passwordHash,
        displayName: parsed.data.displayName,
        locale: parsed.data.locale,
        role: "user",
      })
      .returning();

    await db.insert(schema.profiles).values({ userId: user!.id });
    await db.insert(schema.auditLogs).values({
      actorId: user!.id,
      action: "auth.register",
      target: user!.id,
    });

    return issueSession(app, reply, user!);
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1);
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    return issueSession(app, reply, user);
  });

  app.post("/auth/refresh", async (req, reply) => {
    const refresh = (req.cookies as { refresh_token?: string }).refresh_token;
    if (!refresh) return reply.code(401).send({ error: "missing_refresh" });
    const tokenHash = hashToken(refresh);
    const [row] = await db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      return reply.code(401).send({ error: "invalid_refresh" });
    }

    // rotate
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, row.id));

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, row.userId))
      .limit(1);
    if (!user) return reply.code(401).send({ error: "invalid_refresh" });
    return issueSession(app, reply, user);
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req) => {
    return { user: req.user };
  });

  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (req, reply) => {
    const refresh = (req.cookies as { refresh_token?: string }).refresh_token;
    if (refresh) {
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.tokenHash, hashToken(refresh)));
    }
    reply.clearCookie("refresh_token", { path: "/" });
    return { ok: true };
  });
}

async function issueSession(
  app: FastifyInstance,
  reply: import("fastify").FastifyReply,
  user: typeof schema.users.$inferSelect,
) {
  const accessToken = await reply.jwtSign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      level: user.level,
      xp: user.xp,
      locale: user.locale,
    },
    { expiresIn: process.env.JWT_ACCESS_TTL ?? "15m" },
  );

  const refresh = randomBytes(32).toString("hex");
  const days = 7;
  const expiresAt = new Date(Date.now() + days * 864e5);
  await db.insert(schema.refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refresh),
    expiresAt,
  });

  reply.setCookie("refresh_token", refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      level: user.level,
      xp: user.xp,
      locale: user.locale,
    },
  };
}
