import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import {
  connectDatabase,
  type DatabaseConnection,
} from "@planet/database";
import { deterministicUuid } from "@planet/simulation-models";
import { jwtVerify, SignJWT } from "jose";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
  displayName: z.string().trim().min(2).max(80).optional(),
});

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  refreshTokenVersion: number;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly connection: DatabaseConnection | null;
  private readonly memoryUsers = new Map<string, StoredUser>();
  private readonly secret: Uint8Array;

  constructor() {
    const environment = process.env.APP_ENV ?? "sandbox";
    const secret =
      process.env.JWT_SECRET ??
      (environment === "sandbox"
        ? "sandbox-only-secret-change-before-production"
        : "");
    if (secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }
    this.secret = new TextEncoder().encode(secret);
    this.connection = process.env.DATABASE_URL
      ? connectDatabase(process.env.DATABASE_URL)
      : null;

    if (!this.connection) {
      const id = deterministicUuid("sandbox", "super-admin");
      this.memoryUsers.set("admin@planet.local", {
        id,
        email: "admin@planet.local",
        passwordHash: hashPassword("PlanetSandbox!2026", "planet-sandbox-only"),
        refreshTokenVersion: 0,
      });
    }
  }

  async register(input: unknown) {
    const credentials = credentialsSchema.parse(input);
    if (await this.findByEmail(credentials.email)) {
      throw new ConflictException("Email is already registered");
    }
    const user: StoredUser = {
      id: randomUUID(),
      email: credentials.email,
      passwordHash: hashPassword(credentials.password),
      refreshTokenVersion: 0,
    };

    if (this.connection) {
      const roleId = deterministicUuid("role", "user");
      await this.connection.sql.begin(async (sql) => {
        await sql`
          INSERT INTO users (id, email, password_hash)
          VALUES (${user.id}, ${user.email}, ${user.passwordHash})
        `;
        await sql`
          INSERT INTO profiles (id, user_id, display_name)
          VALUES (
            ${deterministicUuid("profile", user.id)}, ${user.id},
            ${credentials.displayName ?? credentials.email.split("@")[0]}
          )
        `;
        await sql`
          INSERT INTO user_roles (user_id, role_id)
          VALUES (${user.id}, ${roleId})
          ON CONFLICT DO NOTHING
        `;
      });
    } else {
      this.memoryUsers.set(user.email, user);
    }
    return this.issueTokens(user);
  }

  async login(input: unknown) {
    const credentials = credentialsSchema
      .omit({ displayName: true })
      .parse(input);
    const user = await this.findByEmail(credentials.email);
    if (!user || !verifyPassword(credentials.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issueTokens(user);
  }

  async rotate(refreshToken: string) {
    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(refreshToken, this.secret, {
        issuer: "planet-api",
        audience: "planet-web",
      }));
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.typ !== "refresh" || !payload.sub) {
      throw new UnauthorizedException("Invalid refresh token type");
    }
    const user = await this.findById(payload.sub);
    if (
      !user ||
      payload.version !== user.refreshTokenVersion
    ) {
      throw new UnauthorizedException("Refresh token was already rotated");
    }
    user.refreshTokenVersion += 1;
    await this.updateTokenVersion(user);
    return this.issueTokens(user);
  }

  async authenticate(header?: string): Promise<string> {
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      if ((process.env.APP_ENV ?? "sandbox") === "sandbox") {
        return deterministicUuid("sandbox", "super-admin");
      }
      throw new UnauthorizedException("Bearer token is required");
    }
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: "planet-api",
        audience: "planet-web",
      });
      if (payload.typ !== "access" || !payload.sub) throw new Error();
      return payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  private async issueTokens(user: StoredUser) {
    const accessToken = await new SignJWT({
      typ: "access",
      email: user.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("planet-api")
      .setAudience("planet-web")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(this.secret);
    const refreshToken = await new SignJWT({
      typ: "refresh",
      version: user.refreshTokenVersion,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("planet-api")
      .setAudience("planet-web")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(this.secret);
    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  private async findByEmail(email: string): Promise<StoredUser | null> {
    if (!this.connection) return this.memoryUsers.get(email) ?? null;
    const [row] = await this.connection.sql`
      SELECT id, email, password_hash, refresh_token_version
      FROM users WHERE email = ${email} AND status = 'active' LIMIT 1
    `;
    return row
      ? {
          id: String(row.id),
          email: String(row.email),
          passwordHash: String(row.password_hash),
          refreshTokenVersion: Number(row.refresh_token_version),
        }
      : null;
  }

  private async findById(id: string): Promise<StoredUser | null> {
    if (!this.connection) {
      return (
        [...this.memoryUsers.values()].find((user) => user.id === id) ?? null
      );
    }
    const [row] = await this.connection.sql`
      SELECT id, email, password_hash, refresh_token_version
      FROM users WHERE id = ${id} AND status = 'active' LIMIT 1
    `;
    return row
      ? {
          id: String(row.id),
          email: String(row.email),
          passwordHash: String(row.password_hash),
          refreshTokenVersion: Number(row.refresh_token_version),
        }
      : null;
  }

  private async updateTokenVersion(user: StoredUser): Promise<void> {
    if (this.connection) {
      await this.connection.sql`
        UPDATE users SET refresh_token_version = ${user.refreshTokenVersion}
        WHERE id = ${user.id}
      `;
    } else {
      this.memoryUsers.set(user.email, user);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }
}

function hashPassword(password: string, fixedSalt?: string): string {
  const salt = fixedSalt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
