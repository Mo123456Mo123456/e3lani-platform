import { Controller, Get } from '@nestjs/common';
import { storageHealthSummary } from '@e3lani/storage';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    const storage = storageHealthSummary();
    return {
      status: 'ok',
      service: 'e3lani-api',
      ts: new Date().toISOString(),
      storage: {
        configured: storage.configured,
        misconfigured: storage.misconfigured,
        provider: storage.provider,
        mode: storage.mode,
        // Intentional: health stays up even when storage is missing.
        ready: storage.configured && !storage.misconfigured,
      },
    };
  }

  @Get('live')
  live() {
    return { status: 'live' };
  }

  @Get('ready')
  async ready() {
    if (!process.env.DATABASE_URL) {
      return { status: 'degraded', database: 'unconfigured' };
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const storage = storageHealthSummary();
      return {
        status: 'ready',
        database: 'up',
        storage: {
          configured: storage.configured,
          misconfigured: storage.misconfigured,
          provider: storage.provider,
          mode: storage.mode,
          ready: storage.configured && !storage.misconfigured,
        },
      };
    } catch {
      return { status: 'not_ready', database: 'down' };
    }
  }
}
