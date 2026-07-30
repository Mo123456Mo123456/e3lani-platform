import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import { prisma, type StaffRole, type User } from "@e3lani/database";
import {
  completeProfileSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type CompleteProfileInput,
} from "@e3lani/types";

export type AuthUser = Pick<User, "id" | "phone" | "staffRole" | "status" | "accountType">;
type AuthenticatedRequest = Request & { user: AuthUser };

export interface OtpAdapter {
  send(phone: string, code: string): Promise<void>;
}

@Injectable()
export class ConsoleOtpAdapter implements OtpAdapter {
  async send(phone: string, code: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CONSOLE_OTP_DISABLED_IN_PRODUCTION");
    }
    console.info(`[sandbox-otp] ${phone}: ${code}`);
  }
}

@Injectable()
export class UnifonicOtpAdapter implements OtpAdapter {
  async send(phone: string, code: string) {
    const appSid = process.env.UNIFONIC_APP_SID;
    if (!appSid) throw new Error("UNIFONIC_NOT_CONFIGURED");
    const response = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        AppSid: appSid,
        SenderID: process.env.UNIFONIC_SENDER_ID ?? "E3lani",
        Recipient: phone,
        Body: `رمز التحقق في إعلاني: ${code}`,
      }),
    });
    if (!response.ok) throw new Error("OTP_PROVIDER_FAILED");
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  private otpHash(phone: string, code: string) {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret || secret.length < 32) throw new Error("OTP_HASH_SECRET_INVALID");
    return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
  }

  private refreshHash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private otpAdapter(): OtpAdapter {
    return process.env.OTP_PROVIDER === "unifonic"
      ? new UnifonicOtpAdapter()
      : new ConsoleOtpAdapter();
  }

  async requestOtp(input: unknown) {
    const { phone } = requestOtpSchema.parse(input);
    const code = randomInt(100_000, 1_000_000).toString();
    const ttl = Number(process.env.OTP_TTL_SECONDS ?? 300);
    await prisma.$transaction([
      prisma.otpChallenge.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      prisma.otpChallenge.create({
        data: {
          phone,
          codeHash: this.otpHash(phone, code),
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      }),
    ]);
    await this.otpAdapter().send(phone, code);
    return { sent: true, expiresInSeconds: ttl };
  }

  async verifyOtp(input: unknown, ipAddress?: string) {
    const parsed = verifyOtpSchema.parse(input);
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone: parsed.phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= maxAttempts) {
      throw new UnauthorizedException("OTP_EXPIRED_OR_LOCKED");
    }

    const received = Buffer.from(this.otpHash(parsed.phone, parsed.code), "hex");
    const expected = Buffer.from(challenge.codeHash, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("OTP_INVALID");
    }

    const consumed = await prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException("OTP_ALREADY_USED");

    const user = await prisma.user.upsert({
      where: { phone: parsed.phone },
      update: {},
      create: { phone: parsed.phone },
    });
    if (user.status !== "ACTIVE") throw new ForbiddenException("ACCOUNT_NOT_ACTIVE");
    return this.createSession(user, parsed.deviceName, ipAddress);
  }

  private async createSession(user: User, deviceName?: string, ipAddress?: string) {
    const refreshToken = randomBytes(48).toString("base64url");
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.refreshHash(refreshToken),
        deviceName,
        ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id, role: user.staffRole },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "15m" },
    );
    return {
      accessToken,
      refreshToken,
      profileComplete: Boolean(user.name && user.cityId && user.termsAcceptedAt),
      user: this.safeUser(user),
    };
  }

  async refresh(rawToken: unknown) {
    if (typeof rawToken !== "string" || rawToken.length < 32) {
      throw new UnauthorizedException("REFRESH_TOKEN_INVALID");
    }
    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: this.refreshHash(rawToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("REFRESH_TOKEN_EXPIRED");
    }
    if (session.user.status !== "ACTIVE") throw new ForbiddenException("ACCOUNT_NOT_ACTIVE");

    const nextToken = randomBytes(48).toString("base64url");
    await prisma.authSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.refreshHash(nextToken), lastSeenAt: new Date() },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: session.user.id, sid: session.id, role: session.user.staffRole },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "15m" },
    );
    return { accessToken, refreshToken: nextToken, user: this.safeUser(session.user) };
  }

  async completeProfile(userId: string, input: unknown) {
    const data: CompleteProfileInput = completeProfileSchema.parse(input);
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email || null,
        cityId: data.cityId,
        accountType: data.accountType,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        accountType: true,
        cityId: true,
      },
    });
  }

  async logout(userId: string, sessionId: string) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  safeUser(user: User) {
    const { id, phone, name, email, accountType, staffRole, cityId, avatarUrl } = user;
    return { id, phone, name, email, accountType, staffRole, cityId, avatarUrl };
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException("AUTH_REQUIRED");
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException("ACCESS_TOKEN_INVALID");
    }
    const session = await prisma.authSession.findFirst({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("SESSION_INVALID");
    }
    request.user = session.user;
    return true;
  }
}

const ROLES_KEY = "staff_roles";
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !roles.includes(request.user.staffRole)) {
      throw new ForbiddenException("INSUFFICIENT_ROLE");
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

export const SessionId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  const token = request.headers.authorization?.slice(7);
  if (!token) throw new UnauthorizedException();
  const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as {
    sid?: string;
  };
  if (!payload.sid) throw new BadRequestException("SESSION_ID_MISSING");
  return payload.sid;
});

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("otp/request")
  requestOtp(@Body() body: unknown) {
    return this.auth.requestOtp(body);
  }

  @Post("otp/verify")
  verifyOtp(@Body() body: unknown) {
    return this.auth.verifyOtp(body);
  }

  @Post("refresh")
  refresh(@Body() body: { refreshToken?: unknown }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return prisma.user.findUnique({
      where: { id: user.id },
      include: { city: true, businessProfile: true },
    });
  }

  @Post("profile")
  @UseGuards(JwtAuthGuard)
  completeProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.completeProfile(user.id, body);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser, @SessionId() sessionId: string) {
    return this.auth.logout(user.id, sessionId);
  }
}
