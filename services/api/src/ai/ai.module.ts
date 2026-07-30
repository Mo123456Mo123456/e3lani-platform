import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { AiClientService } from "./ai.service.js";

@Module({
  controllers: [AiController],
  providers: [AiClientService],
  exports: [AiClientService],
})
export class AiModule {}
