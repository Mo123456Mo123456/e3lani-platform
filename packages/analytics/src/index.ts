/**
 * Minimal privacy-respecting analytics tracker: batches events and
 * flushes on interval/visibility change. No sensitive data collected.
 */

export interface TrackEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
  at: string;
}

export interface TrackerOptions {
  endpoint: string;
  flushIntervalMs?: number;
  maxBatch?: number;
  getToken?: () => string | null;
}

export function createTracker(opts: TrackerOptions) {
  const queue: TrackEvent[] = [];
  const flushInterval = opts.flushIntervalMs ?? 8000;
  const maxBatch = opts.maxBatch ?? 40;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function flush(): Promise<void> {
    if (!queue.length) return;
    const batch = queue.splice(0, maxBatch);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = opts.getToken?.();
      if (token) headers.authorization = `Bearer ${token}`;
      await fetch(opts.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      queue.unshift(...batch.slice(0, 10)); // bounded retry
    }
  }

  function track(name: string, props?: TrackEvent["props"]): void {
    if (queue.length > 500) queue.shift();
    queue.push({ name, props, at: new Date().toISOString() });
    if (queue.length >= maxBatch) void flush();
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(() => void flush(), flushInterval);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void flush();
      });
    }
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    void flush();
  }

  return { track, flush, start, stop };
}

/** WebGL performance sampler used by the quality auto-tuner. */
export function createFpsSampler(onSample: (fps: number) => void, windowSize = 90) {
  let frames = 0;
  let last = 0;
  let running = false;

  function loop(now: number): void {
    if (!running) return;
    frames++;
    if (last === 0) last = now;
    const elapsed = now - last;
    if (elapsed >= 1000) {
      onSample((frames * 1000) / elapsed);
      frames = 0;
      last = now;
    }
    requestAnimationFrame(loop);
  }

  return {
    start() {
      if (running || typeof requestAnimationFrame === "undefined") return;
      running = true;
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    _windowSize: windowSize,
  };
}
