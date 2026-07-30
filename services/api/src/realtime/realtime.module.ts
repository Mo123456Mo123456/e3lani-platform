import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { WorldGateway } from "./world.gateway.js";

@Module({
  imports: [WorldsModule],
  providers: [WorldGateway],
})
export class RealtimeModule {}
