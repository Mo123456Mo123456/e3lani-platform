import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminLoginSchema, completeProfileSchema, refreshTokenSchema, requestOtpSchema, verifyOtpSchema,
} from '@e3lani/types';
import { AuthService } from './auth.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ClientMeta, CurrentUser, Public, RateLimit, type AuthUser,
} from '../../common/decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @RateLimit({ limit: 5, windowSeconds: 300 })
  @ApiOperation({ summary: 'طلب رمز تحقق برقم الجوال' })
  async requestOtp(
    @Body(zodPipe(requestOtpSchema)) body: { phone: string; purpose: 'LOGIN' | 'REGISTER' | 'PHONE_CHANGE' },
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    return this.auth.requestOtp(body.phone, body.purpose, meta);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowSeconds: 300 })
  @ApiOperation({ summary: 'التحقق من الرمز وإصدار الجلسة' })
  async verifyOtp(
    @Body(zodPipe(verifyOtpSchema)) body: { phone: string; code: string; deviceId?: string },
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    return this.auth.verifyOtp(body.phone, body.code, { ...meta, deviceId: body.deviceId });
  }

  @Post('profile')
  @HttpCode(200)
  @ApiOperation({ summary: 'استكمال بيانات الحساب بعد التحقق' })
  async completeProfile(
    @CurrentUser() user: AuthUser,
    @Body(zodPipe(completeProfileSchema)) body: any,
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    return this.auth.completeProfile(user.id, body, meta);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowSeconds: 300 })
  async refresh(
    @Body(zodPipe(refreshTokenSchema)) body: { refreshToken: string },
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    return this.auth.refresh(body.refreshToken, meta);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser, @Body() body: { refreshToken?: string }) {
    await this.auth.logout(body?.refreshToken, user.id);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.sessionUser(user.id);
  }

  @Public()
  @Post('admin/login')
  @HttpCode(200)
  @RateLimit({ limit: 8, windowSeconds: 300 })
  @ApiOperation({ summary: 'تسجيل دخول لوحة الإدارة (رمز منفصل تمامًا)' })
  async adminLogin(
    @Body(zodPipe(adminLoginSchema)) body: { email: string; password: string },
    @ClientMeta() meta: { ip: string; userAgent: string | null },
  ) {
    return this.auth.adminLogin(body.email, body.password, meta);
  }
}
