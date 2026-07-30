import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { config } from "../config.js";
import type { LoginInput, RegisterInput } from "@planet/validation";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessPayload {
  sub: string;
  email: string;
  role: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(input: RegisterInput, ip?: string): Promise<{ user: { id: string; email: string }; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException("email_already_registered");
    const role = await this.prisma.role.findUnique({ where: { name: "registered" } });
    if (!role) throw new Error("roles_not_seeded");
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 12),
        roleId: role.id,
        profile: { create: { displayName: input.displayName, locale: input.locale } },
      },
    });
    await this.audit(user.id, "auth.register", "User", user.id, ip);
    const tokens = await this.issueTokens(user.id, user.email, "registered");
    return { user: { id: user.id, email: user.email }, tokens };
  }

  async login(input: LoginInput, ip?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { role: true },
    });
    if (!user || user.status !== "active") throw new UnauthorizedException("invalid_credentials");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("invalid_credentials");
    await this.audit(user.id, "auth.login", "User", user.id, ip);
    return this.issueTokens(user.id, user.email, user.role.name);
  }

  /**
   * Refresh Token Rotation: every refresh invalidates the presented token and
   * issues a new pair. Reuse of a revoked token revokes the whole family
   * (theft detection).
   */
  async refresh(presentedToken: string, ip?: string): Promise<TokenPair> {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presentedToken) } });
    if (!record) throw new UnauthorizedException("invalid_refresh_token");
    if (record.revokedAt) {
      // Reuse detected: kill every active token of this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(record.userId, "auth.refresh_reuse_detected", "User", record.userId, ip);
      throw new UnauthorizedException("refresh_token_reuse_detected");
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException("refresh_token_expired");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
      include: { role: true },
    });
    const tokens = await this.issueTokens(user.id, user.email, user.role.name);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: hashToken(tokens.refreshToken).slice(0, 24) },
    });
    return tokens;
  }

  async logout(presentedToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyAccess(token: string): AccessPayload {
    try {
      return this.jwt.verify<AccessPayload>(token, { secret: config.jwtSecret });
    } catch {
      throw new UnauthorizedException("invalid_access_token");
    }
  }

  private async issueTokens(userId: string, email: string, role: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role } satisfies AccessPayload,
      { secret: config.jwtSecret, expiresIn: config.accessTtlSeconds },
    );
    const refreshToken = randomBytes(48).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: config.accessTtlSeconds };
  }

  private async audit(userId: string | null, action: string, targetType: string, targetId: string, ip?: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, targetType, targetId, ip, metadata: {} },
    });
  }
}
