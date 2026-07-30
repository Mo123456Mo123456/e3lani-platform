import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(user: {
  id: string;
  email: string;
  role: string;
}) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER ?? "planet-born")
    .setAudience(process.env.JWT_AUDIENCE ?? "planet-born-web")
    .setExpirationTime(process.env.ACCESS_TOKEN_TTL ?? "15m")
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), {
    issuer: process.env.JWT_ISSUER ?? "planet-born",
    audience: process.env.JWT_AUDIENCE ?? "planet-born-web",
  });
  return payload as { sub: string; email: string; role: string };
}

export async function createSession(userId: string, userAgent?: string) {
  const refreshToken = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent: userAgent ?? null,
    })
    .returning();
  return { session, refreshToken };
}

export async function rotateRefreshToken(refreshToken: string) {
  const hash = hashToken(refreshToken);
  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.refreshTokenHash, hash),
        isNull(schema.sessions.revokedAt),
      ),
    )
    .limit(1);
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  // Rotate
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.id, session.id));
  const next = await createSession(session.userId);
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  if (!user) return null;
  const accessToken = await signAccessToken(user);
  return { user, accessToken, refreshToken: next.refreshToken, session: next.session };
}

export async function revokeSession(refreshToken: string) {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.refreshTokenHash, hashToken(refreshToken)));
}

export const ADMIN_ROLES = new Set([
  "content_moderator",
  "simulation_manager",
  "system_admin",
  "super_admin",
]);
