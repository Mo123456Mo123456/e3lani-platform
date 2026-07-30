import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";

const EventSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

type QueuedEvent = z.infer<typeof EventSchema> & { queuedAt: Date };
type Notification = QueuedEvent & {
  id: string;
  processedAt: Date;
};

const queue: QueuedEvent[] = [];
const notifications: Notification[] = [];
let processed = 0;

function processQueue(limit = 100) {
  const batch = queue.splice(0, limit);
  for (const event of batch) {
    notifications.push({
      ...event,
      id: randomUUID(),
      processedAt: new Date(),
    });
  }
  processed += batch.length;
  return batch.length;
}

const timer = setInterval(() => processQueue(), 1_000);
timer.unref();

const app = Fastify({ logger: true });
app.addHook("onClose", async () => clearInterval(timer));

app.get("/health", async () => ({
  status: "ok",
  service: "@planet-born/notification-worker",
  queued: queue.length,
  processed,
}));

app.post("/events", async (request, reply) => {
  const event = EventSchema.parse(request.body);
  queue.push({ ...event, queuedAt: new Date() });
  return reply.code(202).send({ accepted: true, position: queue.length });
});

app.post("/process", async () => ({ processed: processQueue() }));

app.get("/notifications/:userId", async (request) => {
  const { userId } = z
    .object({ userId: z.string().uuid() })
    .parse(request.params);
  return notifications.filter((notification) => notification.userId === userId);
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: "INVALID_NOTIFICATION_EVENT" });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "NOTIFICATION_PROCESSING_FAILED" });
});

try {
  await app.listen({
    port: Number(process.env.PORT ?? 4500),
    host: process.env.HOST ?? "0.0.0.0",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
