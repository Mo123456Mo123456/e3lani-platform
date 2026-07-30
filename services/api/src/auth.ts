import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import postgres, { type Sql } from "postgres";

const scrypt = promisify(scryptCallback);

export type PlatformRole =
  | "user"
  | "explorer"
  | "life_maker"
  | "civilization_builder"
  | "historian"
  | "moderator"
  | "simulation_admin"
  | "admin"
  | "super_admin";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface RefreshRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

function id(): string {
  return crypto.randomUUID();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [saltHex, keyHex] = encoded.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  private readonly users = new Map<string, StoredUser>();
  private readonly refreshTokens = new Map<string, RefreshRecord>();
  private readonly key: Uint8Array;
  private readonly sql?: Sql;

  constructor() {
    const secret =
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === "production" ? undefined : "sandbox-only-secret-change-before-prod");
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }
    this.key = new TextEncoder().encode(secret);
    if (process.env.DATABASE_URL && process.env.WORLD_STORE === "postgres") {
      this.sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: true });
    }
  }

  async initialize(): Promise<void> {
    if (process.env.NODE_ENV === "production") return;
    const email = "explorer@azura.world";
    if (!(await this.findUserByEmail(email))) {
      const user: StoredUser = {
        id: "00000000-0000-4000-8000-000000000007",
        email,
        displayName: "مستكشف أزورا",
        role: "super_admin",
        passwordHash: await hashPassword("Azura!2347"),
      };
      this.users.set(email, user);
    }
  }

  private async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    if (!this.sql) return this.users.get(email.toLowerCase());
    const [row] = await this.sql<
      {
        id: string;
        email: string;
        display_name: string;
        role: PlatformRole;
        password_hash: string;
      }[]
    >`select id, email, display_name, role, password_hash from users where email = ${email.toLowerCase()} and deleted_at is null`;
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          role: row.role,
          passwordHash: row.password_hash,
        }
      : undefined;
  }

  async register(email: string, password: string, displayName: string): Promise<AuthUser> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.findUserByEmail(normalizedEmail)) throw new Error("EMAIL_ALREADY_EXISTS");
    const user: StoredUser = {
      id: id(),
      email: normalizedEmail,
      displayName: displayName.trim(),
      role: "user",
      passwordHash: await hashPassword(password),
    };
    if (this.sql) {
      await this.sql`
        insert into users (id, email, display_name, password_hash, role, status)
        values (${user.id}, ${user.email}, ${user.displayName}, ${user.passwordHash}, ${user.role}, 'active')
      `;
    } else {
      this.users.set(normalizedEmail, user);
    }
    return this.publicUser(user);
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
    const user = await this.findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error("INVALID_CREDENTIALS");
    }
    return this.issueSession(user);
  }

  private publicUser(user: StoredUser): AuthUser {
    const { id: userId, email, displayName, role } = user;
    return { id: userId, email, displayName, role };
  }

  private async issueSession(user: StoredUser) {
    const publicUser = this.publicUser(user);
    const accessToken = await new SignJWT({
      email: user.email,
      name: user.displayName,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setAudience("living-planet-web")
      .setIssuer("living-planet-api")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(this.key);
    const refreshToken = randomBytes(48).toString("base64url");
    const record: RefreshRecord = {
      id: id(),
      userId: user.id,
      tokenHash: tokenHash(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    if (this.sql) {
      await this.sql`
        insert into refresh_tokens (id, user_id, token_hash, expires_at)
        values (${record.id}, ${record.userId}, ${record.tokenHash}, ${record.expiresAt})
      `;
    } else {
      this.refreshTokens.set(record.tokenHash, record);
    }
    return { user: publicUser, accessToken, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string) {
    const hash = tokenHash(refreshToken);
    let record: RefreshRecord | undefined;
    if (this.sql) {
      const [row] = await this.sql<
        { id: string; user_id: string; token_hash: string; expires_at: Date; revoked_at: Date | null }[]
      >`select id, user_id, token_hash, expires_at, revoked_at from refresh_tokens where token_hash = ${hash}`;
      if (row) {
        record = {
          id: row.id,
          userId: row.user_id,
          tokenHash: row.token_hash,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at ?? undefined,
        };
      }
    } else {
      record = this.refreshTokens.get(hash);
    }
    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }
    if (this.sql) {
      await this.sql`update refresh_tokens set revoked_at = now() where id = ${record.id}`;
      const [row] = await this.sql<
        {
          id: string;
          email: string;
          display_name: string;
          role: PlatformRole;
          password_hash: string;
        }[]
      >`select id, email, display_name, role, password_hash from users where id = ${record.userId}`;
      if (!row) throw new Error("USER_NOT_FOUND");
      return this.issueSession({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        passwordHash: row.password_hash,
      });
    }
    record.revokedAt = new Date();
    const user = [...this.users.values()].find((candidate) => candidate.id === record!.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    return this.issueSession(user);
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: "living-planet-api",
      audience: "living-planet-web",
    });
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new Error("INVALID_ACCESS_TOKEN");
    }
    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.name,
      role: payload.role as PlatformRole,
    };
  }

  middleware(required = true) {
    return async (request: Request, response: Response, next: NextFunction) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) {
        if (required) response.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
        else next();
        return;
      }
      try {
        request.auth = await this.verifyAccessToken(token);
        next();
      } catch {
        response.status(401).json({ error: "INVALID_ACCESS_TOKEN" });
      }
    };
  }
}

export function requireRole(...roles: PlatformRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      response.status(403).json({ error: "INSUFFICIENT_ROLE" });
      return;
    }
    next();
  };
}
