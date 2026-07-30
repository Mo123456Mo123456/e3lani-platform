import { Redis } from "ioredis";

const CHANNEL = "planet:deltas";

interface RealtimeDelta {
  type: string;
  planetId: string;
  tick?: number;
  payload?: Record<string, unknown>;
  ts?: string;
}

interface NotificationCandidate {
  planetId: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  sourceType: string;
  sourceTick?: number;
  createdAt: string;
}

function parseDelta(raw: string): RealtimeDelta | null {
  try {
    const value = JSON.parse(raw) as Partial<RealtimeDelta>;
    if (!value || typeof value !== "object" || typeof value.planetId !== "string" || typeof value.type !== "string") {
      return null;
    }
    return value as RealtimeDelta;
  } catch {
    return null;
  }
}

function notificationFromDelta(delta: RealtimeDelta): NotificationCandidate | null {
  const payload = delta.payload ?? {};
  const title = typeof payload.title === "string" ? payload.title : undefined;
  const eventType = typeof payload.eventType === "string" ? payload.eventType : delta.type;

  if (!["event", "contribution", "notification", "ai_status"].includes(delta.type)) {
    return null;
  }

  return {
    planetId: delta.planetId,
    title: title ?? `Planet ${eventType} update`,
    body: typeof payload.description === "string" ? payload.description : `New ${delta.type} delta for planet ${delta.planetId}.`,
    severity: delta.type === "ai_status" ? "warning" : "info",
    sourceType: delta.type,
    sourceTick: delta.tick,
    createdAt: delta.ts ?? new Date().toISOString(),
  };
}

async function createNotification(candidate: NotificationCandidate): Promise<void> {
  const apiUrl = process.env.PLANET_API_URL;
  const token = process.env.NOTIFICATION_WORKER_TOKEN;

  if (apiUrl && token) {
    // Stub for the future API/DB persistence phase. No create endpoint exists yet.
    console.log(
      JSON.stringify({
        level: "info",
        message: "notification_candidate_ready_for_api",
        apiUrl,
        candidate,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "notification_candidate",
      candidate,
    }),
  );
}

async function main() {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on("error", (error) => {
    console.warn(`notification-worker redis error: ${error.message}`);
  });

  redis.on("message", async (_channel, raw) => {
    const delta = parseDelta(raw);
    if (!delta) {
      console.warn("notification-worker skipped invalid delta");
      return;
    }

    const notification = notificationFromDelta(delta);
    if (!notification) {
      return;
    }

    await createNotification(notification).catch((error: unknown) => {
      console.warn(`notification-worker create failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  await redis.connect();
  await redis.subscribe(CHANNEL);
  console.log(`notification-worker listening on ${CHANNEL}`);

  async function shutdown() {
    await redis.quit().catch(() => undefined);
  }

  process.on("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
