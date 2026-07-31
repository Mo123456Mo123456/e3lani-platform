import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';
import { StorageService } from './services/storage.service';
import { QueueService } from './services/queue.service';
import { SettingsService } from './services/settings.service';
import { AuditService } from './services/audit.service';
import { SerializerService } from './services/serializer.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    PrismaService,
    RedisService,
    StorageService,
    QueueService,
    SettingsService,
    AuditService,
    SerializerService,
  ],
  exports: [
    JwtModule,
    PrismaService,
    RedisService,
    StorageService,
    QueueService,
    SettingsService,
    AuditService,
    SerializerService,
  ],
})
export class CommonModule {}
