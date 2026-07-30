import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { loadUserRoles } from './middleware.js';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function minutesFromNow(mins: number) {
  return new Date(Date.now() + mins * 60000).toISOString();
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  const db = getDb();
  const existing = await db.select().from(s.users).where(eq(s.users.email, input.email.toLowerCase())).limit(1);
  if (existing.length) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }
  const id = nanoid();
  const passwordHash = await bcrypt.hash(input.password, 10);
  await db.insert(s.users).values({
    id,
    email: input.email.toLowerCase(),
    passwordHash,
    displayName: input.displayName,
  });
  await db.insert(s.profiles).values({ id: nanoid(), userId: id, locale: 'ar' });

  const userRole = await db.select().from(s.roles).where(eq(s.roles.name, 'user')).limit(1);
  if (userRole[0]) {
    await db.insert(s.userRoles).values({ id: nanoid(), userId: id, roleId: userRole[0].id });
  }
  return { id, email: input.email.toLowerCase(), displayName: input.displayName };
}

export async function verifyLogin(email: string, password: string) {
  const db = getDb();
  const rows = await db.select().from(s.users).where(eq(s.users.email, email.toLowerCase())).limit(1);
  const user = rows[0];
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  const roles = await loadUserRoles(user.id);
  return { id: user.id, email: user.email, displayName: user.displayName, roles };
}

export async function issueTokens(
  app: FastifyInstance,
  user: { id: string; email: string; roles: string[] },
  meta?: { userAgent?: string; ip?: string },
) {
  const db = getDb();
  const accessToken = app.jwt.sign(
    { sub: user.id, email: user.email, roles: user.roles },
    { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
  );

  const sessionId = nanoid();
  await db.insert(s.sessions).values({
    id: sessionId,
    userId: user.id,
    userAgent: meta?.userAgent,
    ip: meta?.ip,
    expiresAt: daysFromNow(30),
  });

  const rawRefresh = randomBytes(48).toString('hex');
  const refreshId = nanoid();
  await db.insert(s.refreshTokens).values({
    id: refreshId,
    userId: user.id,
    sessionId,
    tokenHash: hashToken(rawRefresh),
    expiresAt: daysFromNow(30),
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresIn: 900,
    tokenType: 'Bearer' as const,
    sessionId,
  };
}

export async function rotateRefreshToken(app: FastifyInstance, rawRefresh: string) {
  const db = getDb();
  const tokenHash = hashToken(rawRefresh);
  const rows = await db
    .select()
    .from(s.refreshTokens)
    .where(and(eq(s.refreshTokens.tokenHash, tokenHash), isNull(s.refreshTokens.revokedAt)))
    .limit(1);
  const token = rows[0];
  if (!token || new Date(token.expiresAt) < new Date()) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const users = await db.select().from(s.users).where(eq(s.users.id, token.userId)).limit(1);
  const user = users[0];
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const roles = await loadUserRoles(user.id);
  const newRaw = randomBytes(48).toString('hex');
  const newId = nanoid();

  await db
    .update(s.refreshTokens)
    .set({ revokedAt: new Date().toISOString(), replacedById: newId })
    .where(eq(s.refreshTokens.id, token.id));

  await db.insert(s.refreshTokens).values({
    id: newId,
    userId: user.id,
    sessionId: token.sessionId,
    tokenHash: hashToken(newRaw),
    expiresAt: daysFromNow(30),
  });

  const accessToken = app.jwt.sign(
    { sub: user.id, email: user.email, roles },
    { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
  );

  return {
    accessToken,
    refreshToken: newRaw,
    expiresIn: 900,
    tokenType: 'Bearer' as const,
    user: { id: user.id, email: user.email, roles },
  };
}

export async function logout(rawRefresh?: string, accessUserId?: string) {
  const db = getDb();
  if (rawRefresh) {
    const tokenHash = hashToken(rawRefresh);
    const rows = await db.select().from(s.refreshTokens).where(eq(s.refreshTokens.tokenHash, tokenHash)).limit(1);
    const token = rows[0];
    if (token) {
      await db
        .update(s.refreshTokens)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(s.refreshTokens.id, token.id));
      if (token.sessionId) {
        await db
          .update(s.sessions)
          .set({ revokedAt: new Date().toISOString() })
          .where(eq(s.sessions.id, token.sessionId));
      }
    }
  } else if (accessUserId) {
    // revoke all active sessions for user
    const sessions = await db
      .select()
      .from(s.sessions)
      .where(and(eq(s.sessions.userId, accessUserId), isNull(s.sessions.revokedAt)));
    for (const sess of sessions) {
      await db.update(s.sessions).set({ revokedAt: new Date().toISOString() }).where(eq(s.sessions.id, sess.id));
    }
  }
}

export { hashToken, minutesFromNow };
