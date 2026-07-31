import {
  CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators';
import { RedisService } from '../services/redis.service';

/** الحد من المعدل مدعومًا بـ Redis — افتراضي عام + حدود أدق لكل مسار. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {
        limit: this.config.get<number>('RATE_LIMIT_LIMIT') ?? 120,
        windowSeconds: this.config.get<number>('RATE_LIMIT_TTL') ?? 60,
        by: 'ip' as const,
      };

    const ip = (request.headers['x-forwarded-for']?.split(',')[0] ?? request.ip ?? 'unknown').trim();
    const subject =
      options.by === 'user' && request.user?.id ? `user:${request.user.id}` : `ip:${ip}`;
    const route = `${request.method}:${request.route?.path ?? request.url}`;
    const key = `rl:${route}:${subject}`;

    const count = await this.redis.increment(key, options.windowSeconds);
    if (count > options.limit) {
      const retryAfter = await this.redis.ttl(key);
      throw new HttpException(
        {
          message: 'عدد كبير من المحاولات، حاول لاحقًا',
          code: 'RATE_LIMITED',
          retryAfter: retryAfter > 0 ? retryAfter : options.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
