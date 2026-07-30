import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const RATE_KEY = Symbol("rate_limit");
export const RateLimit = (points: number, windowSeconds = 60) =>
  SetMetadata(RATE_KEY, { points, windowSeconds });

/**
 * Sliding-window rate limiter (in-memory per instance; swap the store
 * for Redis in multi-instance deployments — documented in SECURITY.md).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const meta = Reflect.getMetadata(RATE_KEY, context.getHandler()) as
      | { points: number; windowSeconds: number }
      | undefined;
    if (!meta) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = `${req.ip}:${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + meta.windowSeconds * 1000 };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, meta.points - bucket.count);
    res.setHeader("x-ratelimit-limit", meta.points);
    res.setHeader("x-ratelimit-remaining", remaining);
    if (this.buckets.size > 50_000) {
      this.buckets.clear();
    }
    if (bucket.count > meta.points) {
      res.setHeader("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpException({ error: "rate_limited", retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }, 429);
    }
    return true;
  }
}
