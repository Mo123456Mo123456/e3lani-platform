import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { WorldsModule } from "../worlds/worlds.module.js";
import { ContributionsController } from "./contributions.controller.js";
import { ContributionsService } from "./contributions.service.js";

@Module({
  imports: [WorldsModule, AiModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
