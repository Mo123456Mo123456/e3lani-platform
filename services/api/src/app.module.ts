import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { parseServerEnv } from "@e3lani/config";
import { AccessGuard, RolesGuard } from "./common";
import { AuthController, AuthService, ConsoleOtpProvider } from "./auth";
import { MediaController, MediaService } from "./media";
import { PlatformController, PlatformService } from "./platform";
import { AdminController, OperationsController, OperationsService } from "./operations";
import {
  DisabledPaymentProvider,
  PaymentsController,
  PaymentsService
} from "./payments";

const env = parseServerEnv();

@Module({
  imports: [
    JwtModule.register({ global: true, secret: env.JWT_SECRET }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])
  ],
  controllers: [
    AuthController,
    PlatformController,
    MediaController,
    OperationsController,
    AdminController,
    PaymentsController
  ],
  providers: [
    AuthService,
    ConsoleOtpProvider,
    PlatformService,
    MediaService,
    OperationsService,
    PaymentsService,
    DisabledPaymentProvider,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
