import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly windowMs = 60_000;
  private readonly maxHits = 10;

  use(req: Request, _res: Response, next: NextFunction) {
    const now = Date.now();
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : 'unknown';
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${ip}:${phone}`;
    const bucket = buckets.get(key) ?? { hits: [] };

    bucket.hits = bucket.hits.filter((hit) => now - hit < this.windowMs);
    if (bucket.hits.length >= this.maxHits) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  }
}
