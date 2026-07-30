import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module.js";
import { AiModule } from "./ai/ai.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuditInterceptor } from "./common/audit.interceptor.js";
import { CommonModule } from "./common/common.module.js";
import { JwtAuthGuard } from "./common/guards.js";
import { ContributionsModule } from "./contributions/contributions.module.js";
import { EventsModule } from "./events/events.module.js";
import { HealthModule } from "./health/health.module.js";
import { ModerationModule } from "./moderation/moderation.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { SimulationModule } from "./simulation/simulation.module.js";
import { UsersModule } from "./users/users.module.js";
import { WorldsModule } from "./worlds/worlds.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
    CommonModule,
    AuthModule,
    UsersModule,
    WorldsModule,
    ContributionsModule,
    SimulationModule,
    EventsModule,
    NotificationsModule,
    AiModule,
    ModerationModule,
    AdminModule,
    RealtimeModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
