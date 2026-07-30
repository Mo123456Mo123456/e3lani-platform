import { Global, Module } from "@nestjs/common";
import { RedisPublisherService } from "./redis-publisher.service";

@Global()
@Module({
  providers: [RedisPublisherService],
  exports: [RedisPublisherService],
})
export class RedisPublisherModule {}
