import { Body, Controller, Headers, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  logoutSchema,
  refreshTokenSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@e3lani/validation';
import { requireUserId } from '../../common/auth.util';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @ApiOperation({ summary: 'Request a one-time passcode' })
  @Post('request-otp')
  requestOtp(@Body() body: unknown) {
    const input = requestOtpSchema.parse(body);
    return this.auth.requestOtp({
      phone: input.phone,
      locale: input.locale,
      countryCode: input.countryCode,
    });
  }

  @ApiOperation({ summary: 'Verify an OTP and create a session' })
  @Post('verify-otp')
  verifyOtp(@Body() body: unknown) {
    const input = verifyOtpSchema.parse(body);
    return this.auth.verifyOtp({
      phone: input.phone,
      code: input.code,
      deviceId: input.deviceId,
    });
  }

  @ApiOperation({ summary: 'Rotate a refresh token and return a new access token' })
  @Post('refresh')
  refresh(@Body() body: unknown) {
    const input = refreshTokenSchema.parse(body);
    return this.auth.refresh(input.refreshToken);
  }

  @ApiOperation({ summary: 'Revoke one refresh token or all user sessions' })
  @Post('logout')
  async logout(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const input = logoutSchema.parse(body ?? {});
    const user = authorization?.startsWith('Bearer ')
      ? await requireUserId(this.jwt, authorization)
      : undefined;
    return this.auth.logout({
      userId: user?.sub,
      refreshToken: input.refreshToken,
      allDevices: input.allDevices,
    });
  }
}
