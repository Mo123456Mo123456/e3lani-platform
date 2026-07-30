import { Global, Module } from "@nestjs/common";
import { EventBus } from "./event-bus.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [PrismaService, EventBus],
  exports: [PrismaService, EventBus],
})
export class CommonModule {}
