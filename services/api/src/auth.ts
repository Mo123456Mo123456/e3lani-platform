import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Injectable,
  Post,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { prisma } from "@e3lani/database";
import { parseServerEnv } from "@e3lani/config";
import { requestOtpSchema, verifyOtpSchema } from "@e3lani/types";
import * as argon2 from "argon2";
import { randomInt, randomUUID } from "node:crypto";
import type { Request } from "express";
import { CurrentUser, type AuthUser, parse, Public } from "./common";

const env = parseServerEnv();

export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  async send(phone: string, code: string) {
    if (env.NODE_ENV === "production") {
      throw new Error("Console OTP provider is forbidden in production");
    }
    console.info(`[OTP development only] ${phone}: ${code}`);
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly otpProvider: ConsoleOtpProvider
  ) {}

  async requestOtp(input: unknown, ip?: string) {
    const { phone } = parse(requestOtpSchema, input);
    const recent = await prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    if (recent && Date.now() - recent.createdAt.getTime() < env.OTP_RESEND_SECONDS * 1000) {
      throw new HttpException("OTP_RESEND_WAIT", 429);
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
        requestedIp: ip
      }
    });
    await this.otpProvider.send(phone, code);
    return { sent: true, expiresInSeconds: env.OTP_TTL_SECONDS };
  }

  async verifyOtp(input: unknown, request: Request) {
    const data = parse(verifyOtpSchema, input);
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone: data.phone, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException("OTP_EXPIRED");
    }
    if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new HttpException("OTP_ATTEMPTS_EXCEEDED", 429);
    }
    if (!(await argon2.verify(challenge.codeHash, data.code))) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } }
      });
      throw new UnauthorizedException("OTP_INVALID");
    }

    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (!existing && (!data.name || !data.cityId || !data.accountType || !data.acceptedTerms)) {
      throw new BadRequestException("REGISTRATION_FIELDS_REQUIRED");
    }
    if (!existing && data.accountType !== "INDIVIDUAL" && !data.email) {
      throw new BadRequestException("BUSINESS_EMAIL_REQUIRED");
    }

    const user = existing
      ? existing
      : await prisma.user.create({
          data: {
            phone: data.phone,
            name: data.name,
            cityId: data.cityId,
            accountType: data.accountType,
            email: data.email,
            acceptedTermsAt: new Date(),
            profileCompletedAt: new Date()
          }
        });
    if (user.status !== "ACTIVE") throw new UnauthorizedException("ACCOUNT_UNAVAILABLE");

    const sessionSecret = `${randomUUID()}${randomUUID()}`;
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    const session = await prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date(), userId: user.id }
      });
      return tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: await argon2.hash(sessionSecret),
          userAgent: request.headers["user-agent"],
          ipAddress: request.ip,
          expiresAt
        }
      });
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { expiresIn: env.JWT_ACCESS_TTL as never }
    );
    return {
      accessToken,
      refreshToken: `${session.id}.${sessionSecret}`,
      expiresInSeconds: 900,
      user: {
        id: user.id,
        name: user.name,
        accountType: user.accountType,
        staffRole: user.staffRole
      }
    };
  }

  async refresh(rawToken: string) {
    const separator = rawToken.indexOf(".");
    if (separator < 1) throw new UnauthorizedException("REFRESH_INVALID");
    const sessionId = rawToken.slice(0, separator);
    const secret = rawToken.slice(separator + 1);
    const session = await prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } }
    });
    if (!session || !(await argon2.verify(session.refreshTokenHash, secret))) {
      throw new UnauthorizedException("REFRESH_INVALID");
    }
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return {
      accessToken: await this.jwt.signAsync(
        { sub: session.userId, sid: session.id },
        { expiresIn: env.JWT_ACCESS_TTL as never }
      ),
      expiresInSeconds: 900
    };
  }

  async logout(user: AuthUser) {
    await prisma.session.update({ where: { id: user.sessionId }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  me(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        accountType: true,
        avatarUrl: true,
        staffRole: true,
        city: { select: { id: true, nameAr: true, nameEn: true } },
        businessProfile: true
      }
    });
  }
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("otp/request")
  requestOtp(@Body() body: unknown, @Req() request: Request) {
    return this.auth.requestOtp(body, request.ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("otp/verify")
  verifyOtp(@Body() body: unknown, @Req() request: Request) {
    return this.auth.verifyOtp(body, request);
  }

  @Public()
  @Post("refresh")
  refresh(@Body("refreshToken") refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @Post("logout")
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
