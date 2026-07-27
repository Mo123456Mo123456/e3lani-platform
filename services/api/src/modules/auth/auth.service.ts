import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { createOtpProvider, type OtpProvider } from '@e3lani/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

export function createRefreshToken(): string {
  return randomUUID() + randomUUID();
}

@Injectable()
export class AuthService {
  private readonly otp: OtpProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {
    const mode = (process.env.OTP_MODE ?? 'sandbox') as 'sandbox' | 'production';
    this.otp = createOtpProvider(mode, process.env.OTP_PROVIDER);
  }

  async requestOtp(input: {
    phone: string;
    locale: 'ar' | 'en';
    countryCode: string;
  }) {
    const result = await this.otp.sendOtp({
      phone: input.phone,
      locale: input.locale,
      correlationId: randomUUID(),
    });

    return {
      requestId: result.requestId,
      expiresAt: result.expiresAt,
      provider: result.provider,
      ...(result.sandboxCode ? { sandboxCode: result.sandboxCode } : {}),
    };
  }

  async verifyOtp(input: { phone: string; code: string; deviceId?: string }) {
    const verification = await this.otp.verifyOtp({
      phone: input.phone,
      code: input.code,
    });
    if (!verification.valid) {
      throw new UnauthorizedException(verification.reason ?? 'OTP_INVALID');
    }

    const user = await this.prisma.user.upsert({
      where: { phone: input.phone },
      create: {
        phone: input.phone,
        roles: ['USER'],
        locale: 'ar',
        countryCode: 'SA',
        displayName: `معلن ${input.phone.slice(-4)}`,
      },
      update: {},
      include: { brandProfile: true },
    });
    if (user.deletedAt || user.isSuspended) {
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }

    if (!user.brandProfile) {
      const slugBase = `brand-${user.id.replace(/-/g, '').slice(0, 10)}`;
      await this.prisma.brandProfile.create({
        data: {
          userId: user.id,
          slug: slugBase,
          nameAr: user.displayName || `معلن ${input.phone.slice(-4)}`,
          nameEn: `Advertiser ${input.phone.slice(-4)}`,
          phone: input.phone,
          whatsapp: input.phone,
        },
      });
    }

    const refreshToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        deviceId: input.deviceId,
        expiresAt,
      },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      roles: user.roles,
    });

    await this.audit.write({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.displayName,
        roles: user.roles,
        locale: user.locale,
        countryCode: user.countryCode,
      },
    };
  }

  async refresh(refreshToken: string) {
    const now = new Date();
    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });
    if (!session || session.user.deletedAt) {
      throw new UnauthorizedException('REFRESH_TOKEN_INVALID');
    }
    if (session.user.isSuspended) {
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }

    const nextRefreshToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });
      await tx.userSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: hashRefreshToken(nextRefreshToken),
          deviceId: session.deviceId,
          ip: session.ip,
          userAgent: session.userAgent,
          expiresAt,
        },
      });
    });

    const accessToken = await this.jwt.signAsync({
      sub: session.user.id,
      roles: session.user.roles,
    });

    await this.audit.write({
      actorId: session.user.id,
      action: 'auth.refresh',
      entityType: 'userSession',
      entityId: session.id,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: session.user.id,
        phone: session.user.phone,
        displayName: session.user.displayName,
        roles: session.user.roles,
        locale: session.user.locale,
        countryCode: session.user.countryCode,
      },
    };
  }

  async logout(input: {
    userId?: string;
    refreshToken?: string;
    allDevices?: boolean;
  }) {
    const now = new Date();
    let actorId = input.userId;
    let revoked = 0;

    if (input.allDevices) {
      if (!input.userId) {
        throw new UnauthorizedException('MISSING_TOKEN');
      }
      const result = await this.prisma.userSession.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      revoked = result.count;
    } else if (input.refreshToken) {
      const session = await this.prisma.userSession.findFirst({
        where: {
          refreshTokenHash: hashRefreshToken(input.refreshToken),
          ...(input.userId ? { userId: input.userId } : {}),
          revokedAt: null,
        },
      });
      if (session) {
        actorId = actorId ?? session.userId;
        const result = await this.prisma.userSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        });
        revoked = result.count;
      }
    } else if (input.userId) {
      const latest = await this.prisma.userSession.findFirst({
        where: { userId: input.userId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        const result = await this.prisma.userSession.updateMany({
          where: { id: latest.id, revokedAt: null },
          data: { revokedAt: now },
        });
        revoked = result.count;
      }
    } else {
      throw new UnauthorizedException('MISSING_TOKEN');
    }

    if (actorId) {
      await this.audit.write({
        actorId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: actorId,
        after: { revoked },
      });
    }

    return { ok: true, revoked };
  }
}
