import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { requestOtpSchema, verifyOtpSchema } from '@e3lani/validation';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  requestOtp(@Body() body: unknown) {
    const input = requestOtpSchema.parse(body);
    return this.auth.requestOtp({
      phone: input.phone,
      locale: input.locale,
      countryCode: input.countryCode,
    });
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: unknown) {
    const input = verifyOtpSchema.parse(body);
    return this.auth.verifyOtp({
      phone: input.phone,
      code: input.code,
      deviceId: input.deviceId,
    });
  }
}
