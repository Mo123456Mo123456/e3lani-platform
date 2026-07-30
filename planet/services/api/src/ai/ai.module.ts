import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [OrchestratorClient],
})
export class AiModule {}
