import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "./config/app.config";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { ContributionsModule } from "./contributions/contributions.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlanetsModule } from "./planets/planets.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RegionsModule } from "./regions/regions.module";
import { SimulationModule } from "./simulation/simulation.module";
import { TimelineModule } from "./timeline/timeline.module";
import { UsersModule } from "./users/users.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { RequestTimingInterceptor } from "./common/interceptors/request-timing.interceptor";
import { RedisPublisherModule } from "./common/redis/redis-publisher.module";
import { ExternalServicesModule } from "./common/services/external-services.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      load: [appConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    RedisPublisherModule,
    ExternalServicesModule,
    AuthModule,
    UsersModule,
    PlanetsModule,
    RegionsModule,
    EventsModule,
    ContributionsModule,
    SimulationModule,
    TimelineModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
