import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Logger,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";

import { Role } from "@e3lani/database";
import { registerSchema, requestOtpSchema, verifyOtpSchema } from "@e3lani/types";

import { CurrentUser, type AuthUser, parseInput, PrismaService, Public } from "../common";

export abstract class OtpProvider {
  abstract send(phone: string, code: string): Promise<void>;
}

@Injectable()
export class ConsoleOtpAdapter implements OtpProvider {
  private readonly logger = new Logger(ConsoleOtpAdapter.name);

  async send(phone: string, code: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CONSOLE_OTP_FORBIDDEN_IN_PRODUCTION");
    }
    this.logger.warn(`[LOCAL OTP] ${phone}: ${code}`);
  }
}

@Injectable()
export class SmsOtpAdapter implements OtpProvider {
  async send(phone: string, code: string) {
    const url = process.env.SMS_PROVIDER_URL;
    const apiKey = process.env.SMS_PROVIDER_API_KEY;
    const sender = process.env.SMS_PROVIDER_SENDER_ID;
    if (!url || !apiKey || !sender) throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        sender,
        message: `رمز التحقق في إعلاني: ${code}`,
      }),
    });
    if (!response.ok) throw new Error(`SMS_PROVIDER_ERROR_${response.status}`);
  }
}

const refreshSchema = z.object({ refreshToken: z.string().min(40) });
const registerBodySchema = registerSchema.extend({ verificationToken: z.string().min(20) });

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00966")) return `+${digits.slice(2)}`;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1)}`;
  return phone;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpProvider,
  ) {}

  private hashOtp(challengeId: string, code: string) {
    return createHmac("sha256", process.env.JWT_ACCESS_SECRET!)
      .update(`${challengeId}:${code}`)
      .digest("hex");
  }

  async requestOtp(rawPhone: string, request: Request) {
    const phone = normalizePhone(rawPhone);
    requestOtpSchema.parse({ phone });
    const code = String(randomInt(100_000, 1_000_000));
    const id = randomBytes(16).toString("hex");
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    await this.prisma.otpChallenge.create({
      data: {
        id,
        phone,
        userId: user?.id,
        codeHash: this.hashOtp(id, code),
        expiresAt: new Date(Date.now() + Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000),
        requestedIp: request.ip,
      },
    });
    await this.otp.send(phone, code);
    return { challengeId: id, expiresInSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300) };
  }

  async verifyOtp(input: z.infer<typeof verifyOtpSchema>, request: Request) {
    const phone = normalizePhone(input.phone);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: { include: { roles: true } } },
    });
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
      throw new UnauthorizedException("OTP_EXPIRED_OR_LOCKED");
    }
    const actual = Buffer.from(this.hashOtp(challenge.id, input.code), "hex");
    const expected = Buffer.from(challenge.codeHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("INVALID_OTP");
    }
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    if (!challenge.user) {
      return {
        registrationRequired: true,
        verificationToken: await this.jwt.signAsync(
          { phone, challengeId: challenge.id, type: "registration" },
          {
            secret: process.env.JWT_ACCESS_SECRET,
            issuer: "e3lani-api",
            audience: "e3lani-registration",
            expiresIn: "10m",
          },
        ),
      };
    }
    return this.issueSession(
      challenge.user.id,
      challenge.user.roles.map((assignment) => assignment.role),
      request,
    );
  }

  async register(input: z.infer<typeof registerBodySchema>, request: Request) {
    let verification: { phone: string; challengeId: string; type: string };
    try {
      verification = await this.jwt.verifyAsync(input.verificationToken, {
        secret: process.env.JWT_ACCESS_SECRET,
        issuer: "e3lani-api",
        audience: "e3lani-registration",
      });
    } catch {
      throw new UnauthorizedException("INVALID_REGISTRATION_TOKEN");
    }
    if (verification.type !== "registration" || normalizePhone(input.phone) !== verification.phone) {
      throw new UnauthorizedException("REGISTRATION_PHONE_MISMATCH");
    }
    const exists = await this.prisma.user.findUnique({ where: { phone: verification.phone } });
    if (exists) throw new ConflictException("PHONE_ALREADY_REGISTERED");
    const city = await this.prisma.city.findFirst({ where: { id: input.cityId, active: true } });
    if (!city) throw new BadRequestException("INVALID_CITY");

    const baseSlug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug || "account"}-${randomBytes(3).toString("hex")}`;
    const initialRole = input.accountType === "INDIVIDUAL" ? Role.ADVERTISER : Role.BRAND_OWNER;
    const user = await this.prisma.user.create({
      data: {
        phone: verification.phone,
        email: input.email,
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
        profile: {
          create: {
            name: input.name,
            slug,
            accountType: input.accountType,
            cityId: input.cityId,
          },
        },
        roles: { create: [{ role: Role.USER }, { role: initialRole }] },
      },
      include: { roles: true },
    });
    return this.issueSession(
      user.id,
      user.roles.map((assignment) => assignment.role),
      request,
    );
  }

  private async issueSession(userId: string, roles: Role[], request: Request) {
    const rawRefresh = randomBytes(48).toString("base64url");
    const refreshTokenHash = createHash("sha256").update(rawRefresh).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: session.id, roles, type: "access" },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        issuer: "e3lani-api",
        audience: "e3lani-clients",
        expiresIn: (process.env.JWT_ACCESS_TTL ?? "15m") as JwtSignOptions["expiresIn"],
      },
    );
    return {
      registrationRequired: false,
      accessToken,
      refreshToken: `${session.id}.${rawRefresh}`,
      expiresInSeconds: 900,
    };
  }

  async refresh(rawRefreshToken: string, request: Request) {
    const [sessionId, token] = rawRefreshToken.split(".");
    if (!sessionId || !token) throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    const session = await this.prisma.authSession.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { roles: true } } },
    });
    const hash = createHash("sha256").update(token).digest("hex");
    if (!session || session.refreshTokenHash !== hash || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    }
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(
      session.userId,
      session.user.roles.map((assignment) => assignment.role),
      request,
    );
  }

  async logout(user: AuthUser) {
    await this.prisma.authSession.updateMany({
      where: { id: user.sessionId, userId: user.id },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(user: AuthUser) {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        roles: true,
        profile: { include: { city: true, avatarMedia: true } },
        _count: {
          select: {
            posts: true,
            favorites: true,
            distributions: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
          },
        },
      },
    });
    return {
      id: account.id,
      phone: account.phone,
      email: account.email,
      roles: account.roles.map((assignment) => assignment.role),
      profile: account.profile
        ? {
            name: account.profile.name,
            slug: account.profile.slug,
            accountType: account.profile.accountType,
            bio: account.profile.bio,
            city: account.profile.city,
            avatarUrl: account.profile.avatarMedia
              ? `${process.env.S3_PUBLIC_URL}/${
                  account.profile.avatarMedia.optimizedKey ?? account.profile.avatarMedia.sourceKey
                }`
              : null,
          }
        : null,
      counts: {
        posts: account._count.posts,
        activeAds: account._count.distributions,
        saved: account._count.favorites,
      },
    };
  }

  notifications(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markNotificationsRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ sensitive: { ttl: 600_000, limit: 6 } })
  @Post("otp/request")
  requestOtp(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(requestOtpSchema, body);
    return this.auth.requestOtp(input.phone, request);
  }

  @Public()
  @Throttle({ sensitive: { ttl: 600_000, limit: 10 } })
  @Post("otp/verify")
  verifyOtp(@Body() body: unknown, @Req() request: Request) {
    return this.auth.verifyOtp(parseInput(verifyOtpSchema, body), request);
  }

  @Public()
  @Post("register")
  register(@Body() body: unknown, @Req() request: Request) {
    return this.auth.register(parseInput(registerBodySchema, body), request);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() body: unknown, @Req() request: Request) {
    return this.auth.refresh(parseInput(refreshSchema, body).refreshToken, request);
  }

  @Post("logout")
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Get("notifications")
  notifications(@CurrentUser() user: AuthUser) {
    return this.auth.notifications(user);
  }

  @Patch("notifications/read-all")
  markNotificationsRead(@CurrentUser() user: AuthUser) {
    return this.auth.markNotificationsRead(user);
  }
}
