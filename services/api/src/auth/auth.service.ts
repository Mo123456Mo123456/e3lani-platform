import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { Kysely } from "kysely";
import { randomUUID } from "node:crypto";
import type { AuthResponse, UserDto } from "@planet/shared-types";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAppleIdToken,
  verifyGoogleIdToken,
} from "./jwt.util";

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = bcrypt.hashSync("timing-safe-dummy-password", BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    locale?: string;
    ip?: string;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();
    if (existing) {
      throw new ConflictException({ error: "email_already_registered" });
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.db
      .insertInto("users")
      .values({
        email,
        password_hash: passwordHash,
        display_name: input.displayName,
        role: "user",
        locale: input.locale ?? "ar",
      })
      .returning(["id", "email", "display_name", "role", "locale", "avatar_url", "created_at"])
      .executeTakeFirstOrThrow();
    await this.db.insertInto("profiles").values({ user_id: user.id }).execute();
    await this.db.insertInto("roles").values({ user_id: user.id, role: "user" }).execute();
    return this.issueTokens(user.id, input.ip);
  }

  async login(input: { email: string; password: string; ip?: string; userAgent?: string }): Promise<AuthResponse> {
    const email = input.email.toLowerCase().trim();
    const user = await this.db
      .selectFrom("users")
      .select(["id", "password_hash", "suspended"])
      .where("email", "=", email)
      .executeTakeFirst();
    if (!user?.password_hash) {
      // timing-safe failure path
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw new UnauthorizedException({ error: "invalid_credentials" });
    }
    const ok = await bcrypt.compare(input.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException({ error: "invalid_credentials" });
    }
    if (user.suspended) {
      throw new UnauthorizedException({ error: "account_suspended" });
    }
    return this.issueTokens(user.id, input.ip, input.userAgent);
  }

  async oauth(input: { provider: "google" | "apple"; idToken: string; ip?: string }): Promise<AuthResponse> {
    let identity: { sub: string; email: string; name?: string };
    if (input.provider === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new BadRequestException({ error: "oauth_not_configured", provider: "google", hint: "set GOOGLE_CLIENT_ID/SECRET (see .env.example)" });
      }
      identity = await verifyGoogleIdToken(input.idToken, clientId);
    } else {
      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        throw new BadRequestException({ error: "oauth_not_configured", provider: "apple", hint: "set APPLE_CLIENT_ID/SECRET (see .env.example)" });
      }
      identity = await verifyAppleIdToken(input.idToken, clientId);
    }
    if (!identity.email) {
      throw new UnauthorizedException({ error: "oauth_email_missing" });
    }
    const email = identity.email.toLowerCase();
    const existing = await this.db
      .selectFrom("users")
      .select("id")
      .where((eb) =>
        eb.or([
          eb("email", "=", email),
          eb.and([eb("oauth_provider", "=", input.provider), eb("oauth_subject", "=", identity.sub)]),
        ]),
      )
      .executeTakeFirst();
    if (existing) {
      return this.issueTokens(existing.id, input.ip);
    }
    const user = await this.db
      .insertInto("users")
      .values({
        email,
        display_name: identity.name ?? email.split("@")[0] ?? "explorer",
        role: "user",
        oauth_provider: input.provider,
        oauth_subject: identity.sub,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await this.db.insertInto("profiles").values({ user_id: user.id }).execute();
    await this.db.insertInto("roles").values({ user_id: user.id, role: "user" }).execute();
    return this.issueTokens(user.id, input.ip);
  }

  async refresh(refreshToken: string, ip?: string): Promise<AuthResponse> {
    const hash = hashRefreshToken(refreshToken);
    const row = await this.db
      .selectFrom("refresh_tokens")
      .selectAll()
      .where("token_hash", "=", hash)
      .executeTakeFirst();
    if (!row) {
      throw new UnauthorizedException({ error: "invalid_refresh_token" });
    }
    if (row.revoked_at) {
      // reuse of a rotated token: the whole family is compromised
      await this.db
        .updateTable("refresh_tokens")
        .set({ revoked_at: new Date() })
        .where("family_id", "=", row.family_id)
        .where("revoked_at", "is", null)
        .execute();
      throw new UnauthorizedException({ error: "refresh_token_reuse_detected", familyRevoked: true });
    }
    if (row.expires_at < new Date()) {
      throw new UnauthorizedException({ error: "refresh_token_expired" });
    }
    const next = generateRefreshToken();
    const ttl = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000);
    const inserted = await this.db
      .insertInto("refresh_tokens")
      .values({
        user_id: row.user_id,
        family_id: row.family_id,
        token_hash: next.hash,
        expires_at: new Date(Date.now() + ttl * 1000),
        ip: ip ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await this.db
      .updateTable("refresh_tokens")
      .set({ revoked_at: new Date(), replaced_by: inserted.id })
      .where("id", "=", row.id)
      .execute();
    return this.issueTokens(row.user_id, ip, undefined, next.token);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.db
      .updateTable("refresh_tokens")
      .set({ revoked_at: new Date() })
      .where("token_hash", "=", hashRefreshToken(refreshToken))
      .execute();
  }

  async getUserDto(userId: string): Promise<UserDto> {
    const user = await this.db
      .selectFrom("users")
      .leftJoin("profiles", "profiles.user_id", "users.id")
      .select([
        "users.id",
        "users.email",
        "users.display_name",
        "users.role",
        "users.locale",
        "users.avatar_url",
        "users.created_at",
      ])
      .where("users.id", "=", userId)
      .executeTakeFirstOrThrow();
    const contributionCount = await this.db
      .selectFrom("user_contributions")
      .where("user_id", "=", userId)
      .select((eb) => eb.fn.countAll<number>().as("c"))
      .executeTakeFirstOrThrow();
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: user.display_name,
      role: user.role as UserDto["role"],
      locale: user.locale,
      avatarUrl: user.avatar_url,
      contributionCount: Number(contributionCount.c),
      createdAt: user.created_at.toISOString(),
    };
  }

  private async issueTokens(
    userId: string,
    ip?: string,
    userAgent?: string,
    rotatedRefresh?: string,
  ): Promise<AuthResponse> {
    const dto = await this.getUserDto(userId);
    const accessTtl = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
    const accessToken = await signAccessToken(
      { sub: dto.id, email: dto.email, role: dto.role, locale: dto.locale },
      accessTtl,
    );
    let refreshToken = rotatedRefresh;
    if (!refreshToken) {
      const next = generateRefreshToken();
      const ttl = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000);
      await this.db
        .insertInto("refresh_tokens")
        .values({
          user_id: userId,
          family_id: randomUUID(),
          token_hash: next.hash,
          expires_at: new Date(Date.now() + ttl * 1000),
          user_agent: userAgent ?? null,
          ip: ip ?? null,
        })
        .execute();
      refreshToken = next.token;
    }
    return {
      user: dto,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: accessTtl,
        tokenType: "Bearer",
      },
    };
  }
}
