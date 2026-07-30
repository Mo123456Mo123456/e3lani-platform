type BusHandler = (event: RealtimeEnvelope) => void;

export type RealtimeEnvelope = {
  type: string;
  planetId?: string;
  userId?: string;
  tick?: number;
  events?: unknown[];
  patches?: unknown[];
  payload?: Record<string, unknown>;
};

const handlers = new Set<BusHandler>();
const recent: RealtimeEnvelope[] = [];
const MAX_RECENT = 200;

export function subscribe(handler: BusHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function publish(event: RealtimeEnvelope) {
  recent.push(event);
  if (recent.length > MAX_RECENT) recent.shift();
  for (const h of handlers) {
    try {
      h(event);
    } catch {
      // ignore subscriber errors
    }
  }
  void forwardHttp(event);
}

export function getRecentEvents(filter?: { planetId?: string; userId?: string }) {
  return recent.filter((e) => {
    if (filter?.planetId && e.planetId !== filter.planetId) return false;
    if (filter?.userId && e.userId !== filter.userId) return false;
    return true;
  });
}

async function forwardHttp(event: RealtimeEnvelope) {
  const url = process.env.REALTIME_URL;
  if (!url) return;
  try {
    await fetch(`${url.replace(/\/$/, '')}/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY || 'dev-internal',
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // realtime optional
  }
}
