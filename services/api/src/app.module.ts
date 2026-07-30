import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard } from "./common/auth.guard";
import { CommonModule } from "./common/common.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { RolesGuard } from "./common/roles.guard";
import { ContributionsModule } from "./contributions/contributions.module";
import { DatabaseModule } from "./db/database.module";
import { HealthController } from "./health/health.controller";
import { ModerationModule } from "./moderation/moderation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlanetsModule } from "./planets/planets.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SimulationModule } from "./simulation/simulation.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsersModule,
    SimulationModule,
    PlanetsModule,
    ContributionsModule,
    AiModule,
    ModerationModule,
    NotificationsModule,
    RealtimeModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
