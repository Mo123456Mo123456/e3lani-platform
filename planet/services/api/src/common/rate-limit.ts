/**
 * Sliding-window in-memory rate limiter. Suitable for a single API replica;
 * swap the store for Redis in multi-replica deployments (documented).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  /** Returns true when the action is allowed. */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50000) this.hits.clear();
    return true;
  }

  remaining(key: string, limit: number, windowMs: number): number {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    return Math.max(0, limit - list.length);
  }
}

export const globalRateLimiter = new RateLimiter();
