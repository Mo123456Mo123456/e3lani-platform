import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { AiService } from "./ai.service";
import { AppController } from "./app.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WorldController } from "./world.controller";
import { WorldGateway } from "./world.gateway";
import { WorldRepository } from "./world.repository";
import { WorldService } from "./world.service";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  controllers: [AppController, AuthController, WorldController],
  providers: [
    AiService,
    AuthService,
    WorldRepository,
    WorldService,
    WorldGateway,
  ],
})
export class AppModule {}
