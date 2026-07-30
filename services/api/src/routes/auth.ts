import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema, registerSchema } from "@planet/validation";
import { db } from "../db/client.js";
import { profiles, users, auditLogs } from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  newRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  requireAuth,
} from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing[0]) {
      return reply.code(409).send({
        error: "conflict",
        message: "Email already registered",
        messageAr: "البريد مسجل مسبقًا",
      });
    }
    const passwordHash = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        passwordHash,
        displayName: body.displayName,
        locale: body.locale,
        role: "user",
      })
      .returning();
    await db.insert(profiles).values({ userId: user!.id });
    await db.insert(auditLogs).values({
      actorId: user!.id,
      action: "auth.register",
      targetType: "user",
      targetId: user!.id,
    });

    const accessToken = await reply.jwtSign({
      sub: user!.id,
      email: user!.email,
      role: user!.role as "user",
    });
    const refreshToken = newRefreshToken();
    await storeRefreshToken(user!.id, refreshToken);

    return {
      user: publicUser(user!),
      accessToken,
      refreshToken,
    };
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Invalid credentials",
        messageAr: "بيانات الدخول غير صحيحة",
      });
    }
    const accessToken = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      role: user.role as "user",
    });
    const refreshToken = newRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
    });
    return { user: publicUser(user), accessToken, refreshToken };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const body = req.body as { refreshToken?: string; userId?: string };
    if (!body.refreshToken || !body.userId) {
      return reply.code(400).send({ error: "bad_request", message: "Missing token" });
    }
    const next = await rotateRefreshToken(body.refreshToken, body.userId);
    if (!next) {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid refresh token" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
    if (!user) return reply.code(401).send({ error: "unauthorized", message: "User not found" });
    const accessToken = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      role: user.role as "user",
    });
    return { accessToken, refreshToken: next, user: publicUser(user) };
  });

  app.post("/auth/logout", { preHandler: requireAuth() }, async (req, reply) => {
    const body = req.body as { refreshToken?: string };
    if (body.refreshToken) await revokeRefreshToken(body.refreshToken);
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: requireAuth() }, async (req) => {
    const user = req.dbUser!;
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
    return { user: publicUser(user), profile };
  });
}

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    level: user.level,
    xp: user.xp,
    locale: user.locale,
  };
}
