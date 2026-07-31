import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { otpProviderFactory } from './providers/otp.factory';

@Module({
  controllers: [AuthController],
  providers: [AuthService, otpProviderFactory],
  exports: [AuthService],
})
export class AuthModule {}
