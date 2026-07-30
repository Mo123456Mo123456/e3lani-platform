import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@planet/shared-types";
import { db } from "../db/client.js";
import { refreshTokens, users } from "../db/schema.js";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function storeRefreshToken(userId: string, token: string, days = 30) {
  const expiresAt = new Date(Date.now() + days * 864e5);
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return expiresAt;
}

export async function rotateRefreshToken(oldToken: string, userId: string) {
  const hash = hashToken(oldToken);
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, rows[0].id));
  const next = newRefreshToken();
  await storeRefreshToken(userId, next);
  return next;
}

export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)));
}

const ROLE_RANK: Record<string, number> = {
  visitor: 0,
  user: 1,
  explorer: 2,
  life_maker: 3,
  civilization_founder: 4,
  historian: 5,
  content_moderator: 6,
  simulation_manager: 7,
  system_admin: 8,
  super_admin: 9,
};

export function requireAuth(required?: UserRole | UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      const user = req.user as JwtPayload;
      if (required) {
        const needed = Array.isArray(required) ? required : [required];
        const ok = needed.some((r) => (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[r] ?? 99));
        // Also allow exact match for listed roles OR higher rank than minimum
        const minRank = Math.min(...needed.map((r) => ROLE_RANK[r] ?? 99));
        if ((ROLE_RANK[user.role] ?? 0) < minRank && !needed.includes(user.role)) {
          return reply.code(403).send({
            error: "forbidden",
            message: "Insufficient role",
            messageAr: "صلاحية غير كافية",
          });
        }
        void ok;
      }
      const dbUser = await db.select().from(users).where(eq(users.id, user.sub)).limit(1);
      if (!dbUser[0]) {
        return reply.code(401).send({ error: "unauthorized", message: "User not found" });
      }
      (req as FastifyRequest & { dbUser: (typeof dbUser)[0] }).dbUser = dbUser[0];
    } catch {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Authentication required",
        messageAr: "يلزم تسجيل الدخول",
      });
    }
  };
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    dbUser?: typeof users.$inferSelect;
  }
}
