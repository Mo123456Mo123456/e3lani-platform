import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { Public } from '../../common/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [database, cache] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`
        .then(() => 'up')
        .catch(() => 'down'),
      this.redis.client
        .ping()
        .then(() => 'up')
        .catch(() => 'down'),
    ]);
    const healthy = database === 'up' && cache === 'up';
    return {
      status: healthy ? 'ok' : 'degraded',
      services: { database, cache },
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
