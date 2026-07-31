import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { UsersModule } from "./users/users.module.js";
import { WorldsModule } from "./worlds/worlds.module.js";
import { ContributionsModule } from "./contributions/contributions.module.js";
import { EventsModule } from "./events/events.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AiModule } from "./ai/ai.module.js";
import { InternalModule } from "./internal/internal.module.js";
import { HealthController } from "./health/health.controller.js";
import { EngineClient } from "./common/engine.client.js";
import { OrchestratorClient } from "./common/orchestrator.client.js";

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    WorldsModule,
    ContributionsModule,
    EventsModule,
    NotificationsModule,
    AdminModule,
    AiModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [EngineClient, OrchestratorClient],
})
export class AppModule {}
