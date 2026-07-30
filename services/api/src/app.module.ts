import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AdminController, AdminService } from "./modules/admin";
import { AuthController, AuthService, ConsoleOtpAdapter, OtpProvider } from "./modules/auth";
import { CatalogController, CatalogService } from "./modules/catalog";
import { ContentController, ContentService } from "./modules/content";
import { HealthController } from "./modules/health";
import { MediaController, MediaService } from "./modules/media";
import { DisabledPaymentAdapter, PaymentProvider } from "./modules/payments";
import { AccessGuard, PrismaService, RolesGuard } from "./common";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    DisabledPaymentAdapter,
    {
      provide: OtpProvider,
      useExisting: ConsoleOtpAdapter,
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
