import "reflect-metadata";
// Prisma BigInt columns (e.g. WorldEvent.id) serialize as numbers in JSON.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module.js";
import { RealtimeGateway } from "./realtime/realtime.gateway.js";
import { config } from "./config.js";
import { globalRateLimiter } from "./common/rate-limit.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: config.nodeEnv !== "test" }),
  );

  app.enableCors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    credentials: true,
  });

  await app.register(fastifyCookie, { secret: config.jwtSecret });

  // Security headers (CSP is enforced at the edge/web tier; API sets the rest).
  app.getHttpAdapter().getInstance().addHook("onSend", async (_req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  });

  // Global rate limit (per IP).
  app.getHttpAdapter().getInstance().addHook("onRequest", async (req, reply) => {
    const key = `global:${req.ip}`;
    if (!globalRateLimiter.allow(key, config.rateLimitPerMinute, 60_000)) {
      reply.status(429).send({ error: "rate_limit_exceeded" });
    }
  });

  await app.init();

  // Attach the WebSocket gateway to the underlying HTTP server.
  const gateway = app.get(RealtimeGateway);
  gateway.attach(app.getHttpAdapter().getHttpServer());

  await app.listen(config.port, config.host);
  console.log(`api listening on :${config.port}`);
}

void bootstrap();
