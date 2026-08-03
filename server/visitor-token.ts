import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { visitorSessions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb, requireDatabase } from "./db";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type VisitorTokenPayload = {
  v: 1;
  sid: number;
  aid: string;
  tv: number;
  iat: number;
  exp: number;
};

export type AuthenticatedVisitor = {
  id: number;
  anonymousId: string;
  tokenVersion: number;
  status: "active";
};

function tokenSecret(): string {
  if (ENV.cookieSecret) return ENV.cookieSecret;
  if (!ENV.isProduction) return "e3lani-local-visitor-token-secret";
  throw new Error("VISITOR_TOKEN_SECRET_NOT_CONFIGURED");
}

function sign(encoded: string): string {
  return createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
}

function encode(payload: VisitorTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decode(token: string): VisitorTokenPayload | null {
  const [encoded, provided, extra] = token.split(".");
  if (!encoded || !provided || extra) return null;
  const expected = sign(encoded);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VisitorTokenPayload;
    if (
      value.v !== TOKEN_VERSION ||
      !Number.isInteger(value.sid) ||
      typeof value.aid !== "string" ||
      !Number.isInteger(value.tv) ||
      value.exp <= Date.now()
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function issueToken(input: { id: number; anonymousId: string; tokenVersion: number }): string {
  const now = Date.now();
  return encode({
    v: TOKEN_VERSION,
    sid: input.id,
    aid: input.anonymousId,
    tv: input.tokenVersion,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  });
}

export async function resolveVisitorToken(token?: string | null): Promise<AuthenticatedVisitor | null> {
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  const database = await getDb();
  if (!database) return null;
  const db = requireDatabase(database);
  const rows = await db
    .select({
      id: visitorSessions.id,
      anonymousId: visitorSessions.anonymousId,
      tokenVersion: visitorSessions.tokenVersion,
      status: visitorSessions.status,
    })
    .from(visitorSessions)
    .where(
      and(
        eq(visitorSessions.id, payload.sid),
        eq(visitorSessions.anonymousId, payload.aid),
        eq(visitorSessions.tokenVersion, payload.tv),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  await db
    .update(visitorSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(visitorSessions.id, row.id))
    .catch(() => undefined);
  return {
    id: row.id,
    anonymousId: row.anonymousId,
    tokenVersion: row.tokenVersion,
    status: "active",
  };
}

export async function ensureVisitorToken(existingToken?: string | null) {
  const existing = await resolveVisitorToken(existingToken);
  if (existing) {
    return {
      token: existingToken!,
      created: false as const,
    };
  }

  const db = requireDatabase(await getDb());
  const anonymousId = `anon_${randomBytes(24).toString("base64url")}`.slice(0, 64);
  const inserted = await db.insert(visitorSessions).values({
    anonymousId,
    prefsJson: {},
    savedAdPublicIds: [],
    status: "active",
    tokenVersion: 1,
    lastSeenAt: new Date(),
  });
  const id = Number(inserted[0].insertId);
  return {
    token: issueToken({ id, anonymousId, tokenVersion: 1 }),
    created: true as const,
  };
}

export function visitorTokenFromHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

