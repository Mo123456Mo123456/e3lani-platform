import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import { AuthModule } from "../auth/auth.module.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { EngineClient } from "../common/engine.client.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [OrchestratorClient, EngineClient],
})
export class AdminModule {}
