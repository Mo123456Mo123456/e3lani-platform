import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return { status: 'ok', service: 'e3lani-api', ts: new Date().toISOString() };
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
      return { status: 'ready', database: 'up' };
    } catch {
      return { status: 'not_ready', database: 'down' };
    }
  }
}
