import { Global, Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway.js";
import { AuthModule } from "../auth/auth.module.js";

@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
