import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { AuthTokens, SessionUser, UserRole } from "@kawkab/shared-types";
import { PrismaService } from "../common/prisma.service.js";

const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 30);

export interface RefreshClaims {
  sub: string;
  fam: string;
  jti: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: { email: string; password: string; displayName: string; locale?: string }): Promise<{ user: SessionUser; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("email already registered");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        locale: input.locale ?? "ar",
        profile: { create: {} },
        roleGrants: { create: { role: "USER" } },
      },
    });
    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
    return { user: toSession(user), tokens };
  }

  async login(input: { email: string; password: string }): Promise<{ user: SessionUser; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException("invalid credentials");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("invalid credentials");
    if (user.bannedAt) throw new UnauthorizedException("account suspended");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
    return { user: toSession(user), tokens };
  }

  /** refresh token rotation with reuse detection: a reused token revokes its whole family */
  async refresh(token: string): Promise<{ user: SessionUser; tokens: AuthTokens }> {
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-only-refresh-secret-change-me",
      });
    } catch {
      throw new UnauthorizedException("invalid refresh token");
    }
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!stored) throw new UnauthorizedException("unknown refresh token");
    if (stored.revoked) {
      // reuse detected — nuke the family
      await this.prisma.refreshToken.updateMany({ where: { family: stored.family }, data: { revoked: true } });
      throw new UnauthorizedException("refresh token reuse detected; family revoked");
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException("refresh token expired");
    const tokens = await this.issueTokens(
      { id: stored.user.id, email: stored.user.email, role: stored.user.role, displayName: stored.user.displayName },
      stored.family,
      stored.id,
    );
    return { user: toSession(stored.user), tokens };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token) }, data: { revoked: true } });
  }

  private async issueTokens(user: { id: string; email: string; role: UserRole; displayName: string }, family?: string, replaceId?: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, displayName: user.displayName },
      { secret: process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret-change-me", expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 900) },
    );
    const fam = family ?? randomBytes(8).toString("hex");
    const jti = randomBytes(8).toString("hex");
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, fam, jti },
      { secret: process.env.JWT_REFRESH_SECRET ?? "dev-only-refresh-secret-change-me", expiresIn: REFRESH_TTL_SEC },
    );
    await this.prisma.$transaction(async (tx) => {
      if (replaceId) {
        await tx.refreshToken.update({ where: { id: replaceId }, data: { revoked: true, replacedById: jti } });
      }
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          family: fam,
          expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        },
      });
    });
    return { accessToken, refreshToken, accessTokenExpiresInSec: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 900) };
  }
}

function toSession(user: { id: string; email: string; displayName: string; role: UserRole; avatarUrl?: string | null }): SessionUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl ?? null };
}
