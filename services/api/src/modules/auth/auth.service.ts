import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { createOtpProvider, type OtpProvider } from '@e3lani/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly otp: OtpProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
      },
      update: {},
    });

    const refreshToken = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        deviceId: input.deviceId,
        expiresAt,
      },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      roles: user.roles,
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
}
