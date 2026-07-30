import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { serverEnvSchema } from "@e3lani/config";

import { AdminController, AdminService } from "./modules/admin";
import {
  AuthController,
  AuthService,
  ConsoleOtpAdapter,
  OtpProvider,
  SmsOtpAdapter,
} from "./modules/auth";
import { CatalogController, CatalogService } from "./modules/catalog";
import { ContentController, ContentService } from "./modules/content";
import { HealthController } from "./modules/health";
import { MediaController, MediaService } from "./modules/media";
import { DisabledPaymentAdapter, PaymentProvider } from "./modules/payments";
import { AccessGuard, PrismaService, RolesGuard } from "./common";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: (environment) => serverEnvSchema.parse(environment),
    }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 120 },
      { name: "sensitive", ttl: 600_000, limit: 6 },
    ]),
  ],
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    ContentController,
    MediaController,
    AdminController,
  ],
  providers: [
    PrismaService,
    AuthService,
    CatalogService,
    ContentService,
    MediaService,
    AdminService,
    ConsoleOtpAdapter,
    SmsOtpAdapter,
    DisabledPaymentAdapter,
    {
      provide: OtpProvider,
      inject: [ConsoleOtpAdapter, SmsOtpAdapter],
      useFactory: (consoleProvider: ConsoleOtpAdapter, smsProvider: SmsOtpAdapter) =>
        process.env.OTP_PROVIDER === "sms" ? smsProvider : consoleProvider,
    },
    {
      provide: PaymentProvider,
      useExisting: DisabledPaymentAdapter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
