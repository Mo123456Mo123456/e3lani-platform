import {
  BadRequestException, ForbiddenException, Inject, Injectable, Logger,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AuthTokensDto, SessionUserDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { StorageService } from '../../common/services/storage.service';
import { AuditService } from '../../common/services/audit.service';
import { OTP_PROVIDER } from './providers/otp.factory';
import type { OtpProvider } from './providers/otp-provider.interface';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
  ) {}

  /* ----------------------------- OTP ---------------------------------- */

  async requestOtp(
    phone: string,
    purpose: 'LOGIN' | 'REGISTER' | 'PHONE_CHANGE',
    context: RequestContext,
  ): Promise<{ sent: boolean; expiresInSeconds: number; resendAfterSeconds: number }> {
    const cooldownKey = `otp:cooldown:${phone}`;
    const cooldown = await this.redis.ttl(cooldownKey);
    if (cooldown > 0) {
      throw new BadRequestException({
        message: `يمكنك طلب رمز جديد بعد ${cooldown} ثانية`,
        code: 'OTP_COOLDOWN',
        retryAfter: cooldown,
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, status: true },
    });
    if (existing?.status === 'SUSPENDED') {
      throw new ForbiddenException({ message: 'تم إيقاف هذا الحساب', code: 'USER_SUSPENDED' });
    }

    const length = this.config.get<number>('OTP_LENGTH') ?? 4;
    const ttl = this.config.get<number>('OTP_TTL_SECONDS') ?? 300;
    const cooldownSeconds = this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS') ?? 60;

    const code = String(randomInt(0, 10 ** length)).padStart(length, '0');
    const codeHash = await bcrypt.hash(code, 8);

    // إلغاء أي تحديات سابقة غير مستهلكة لنفس الرقم
    await this.prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip: context.ip ?? null,
      },
    });

    const result = await this.otp.send(phone, code);
    if (!result.delivered) {
      throw new BadRequestException({
        message: 'تعذّر إرسال رمز التحقق، حاول لاحقًا',
        code: 'OTP_SEND_FAILED',
      });
    }

    await this.redis.setEx(cooldownKey, cooldownSeconds, '1');

    return { sent: true, expiresInSeconds: ttl, resendAfterSeconds: cooldownSeconds };
  }

  async verifyOtp(
    phone: string,
    code: string,
    context: RequestContext,
  ): Promise<{ tokens: AuthTokensDto; user: SessionUserDto; isNewUser: boolean }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException({ message: 'اطلب رمز تحقق أولًا', code: 'OTP_NOT_REQUESTED' });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ message: 'انتهت صلاحية الرمز', code: 'OTP_EXPIRED' });
    }

    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS') ?? 5;
    if (challenge.attempts >= maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException({
        message: 'تجاوزت عدد المحاولات المسموح بها، اطلب رمزًا جديدًا',
        code: 'OTP_ATTEMPTS_EXCEEDED',
      });
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({ message: 'رمز التحقق غير صحيح', code: 'OTP_INVALID' });
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
      isNewUser = true;
      await this.audit.record({
        action: 'user.registered',
        entityType: 'User',
        entityId: user.id,
        actorUserId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({ message: 'تم إيقاف هذا الحساب', code: 'USER_SUSPENDED' });
    }

    const tokens = await this.issueTokens(user.id, context);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    return { tokens, user: await this.sessionUser(user.id), isNewUser };
  }

  /* --------------------------- tokens --------------------------------- */

  async issueTokens(userId: string, context: RequestContext): Promise<AuthTokensDto> {
    const accessTtl = this.config.get<number>('JWT_ACCESS_TTL') ?? 900;
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL') ?? 2_592_000;

    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        deviceId: context.deviceId ?? null,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async refresh(refreshToken: string, context: RequestContext): Promise<AuthTokensDto> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, status: true } } },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ message: 'جلسة منتهية، سجّل الدخول مجددًا', code: 'SESSION_EXPIRED' });
    }
    if (session.user.status !== 'ACTIVE') {
      throw new ForbiddenException({ message: 'الحساب غير نشط', code: 'USER_INACTIVE' });
    }

    // تدوير رمز التحديث: كل استخدام يُلغي الرمز السابق
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.userId, context);
  }

  async logout(refreshToken: string | undefined, userId: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: hashToken(refreshToken), userId },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /* --------------------------- profile -------------------------------- */

  async completeProfile(
    userId: string,
    input: {
      name: string;
      cityId: string;
      accountType: 'INDIVIDUAL' | 'STORE' | 'BRAND' | 'COMPANY';
      email?: string;
    },
  ): Promise<SessionUserDto> {
    const city = await this.prisma.city.findFirst({
      where: { id: input.cityId, isActive: true },
      select: { id: true },
    });
    if (!city) throw new NotFoundException({ message: 'المدينة غير موجودة', code: 'CITY_NOT_FOUND' });

    if (input.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException({ message: 'البريد الإلكتروني مستخدم', code: 'EMAIL_TAKEN' });
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        cityId: input.cityId,
        accountType: input.accountType,
        email: input.email ?? null,
        profileCompleted: true,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });

    if (input.accountType !== 'INDIVIDUAL') {
      await this.prisma.businessProfile.upsert({
        where: { userId },
        update: {},
        create: { userId, displayName: input.name },
      });
    }

    await this.audit.record({
      action: 'user.profile_completed',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      after: { accountType: input.accountType },
    });

    return this.sessionUser(userId);
  }

  async sessionUser(userId: string): Promise<SessionUserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { avatarMedia: true },
    });
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      status: user.status,
      avatarUrl: this.storage.publicUrlFor(user.avatarMedia?.playbackKey ?? user.avatarMedia?.originalKey),
      cityId: user.cityId,
      isVerified: user.isVerified,
      profileComplete: user.profileCompleted,
      locale: (user.locale as 'ar' | 'en') ?? 'ar',
    };
  }

  /* ------------------------ admin authentication ---------------------- */

  async adminLogin(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<{ accessToken: string; expiresIn: number; admin: { id: string; name: string; email: string; role: string } }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const fallbackHash = '$2a$12$0000000000000000000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? fallbackHash);

    if (!admin || !valid || !admin.isActive) {
      await this.audit.record({
        action: 'admin.login_failed',
        entityType: 'AdminUser',
        entityId: admin?.id ?? null,
        reason: email,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw new UnauthorizedException({
        message: 'بيانات الدخول غير صحيحة',
        code: 'ADMIN_INVALID_CREDENTIALS',
      });
    }

    const ttl = this.config.get<number>('ADMIN_JWT_TTL') ?? 28_800;
    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, typ: 'admin', role: admin.role },
      { secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'), expiresIn: ttl },
    );

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      action: 'admin.login',
      entityType: 'AdminUser',
      entityId: admin.id,
      actorAdminId: admin.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return {
      accessToken,
      expiresIn: ttl,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
