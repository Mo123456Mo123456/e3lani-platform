import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import {
  AdminController,
  PaymentsController,
} from "./admin.js";
import {
  AuthController,
  AuthService,
  JwtAuthGuard,
  RolesGuard,
} from "./auth.js";
import { MediaController } from "./media.js";
import {
  AdsController,
  AnalyticsController,
  BannersController,
  CatalogController,
  NotificationsController,
  PostsController,
  ProfilesController,
  SavedController,
} from "./platform.js";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { status: "ok", service: "e3lani-api", timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 100 },
      { name: "auth", ttl: 60_000, limit: 8 },
    ]),
  ],
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    AdsController,
    PostsController,
    ProfilesController,
    SavedController,
    BannersController,
    AnalyticsController,
    NotificationsController,
    MediaController,
    AdminController,
    PaymentsController,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
