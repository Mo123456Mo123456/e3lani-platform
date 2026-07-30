import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { ZodError } from "zod";
import { createAiProvider, type AiProvider } from "./adapters/ai-provider.js";
import { createEventBus, type EventBus } from "./adapters/event-bus.js";
import { createRepository } from "./adapters/index.js";
import type { WorldRepository } from "./adapters/repository.js";
import { loadConfig, type AppConfig } from "./config.js";
import { ContributionService } from "./domain/contribution-service.js";
import { AppError } from "./domain/errors.js";
import { registerAuth, AUTH_COOKIE } from "./plugins/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { contributionRoutes } from "./routes/contributions.js";
import { healthRoutes } from "./routes/health.js";
import { websocketRoutes } from "./routes/websocket.js";
import { worldRoutes } from "./routes/world.js";
import "./types.js";

export type AppOverrides = {
  config?: AppConfig;
  repository?: WorldRepository;
  aiProvider?: AiProvider;
  eventBus?: EventBus;
};

export async function createApp(overrides: AppOverrides = {}) {
  const config = overrides.config ?? loadConfig();
  const repository = overrides.repository ?? createRepository(config);
  const aiProvider = overrides.aiProvider ?? createAiProvider(config);
  const eventBus = overrides.eventBus ?? (await createEventBus(config.natsUrl));
  const app = Fastify({
    logger: config.logLevel === "silent" ? false : { level: config.logLevel },
    trustProxy: true,
    bodyLimit: 32 * 1024,
    requestIdHeader: "x-request-id",
  });

  app.decorate("config", config);
  app.decorate("repository", repository);
  app.decorate("aiProvider", aiProvider);
  app.decorate("eventBus", eventBus);
  app.decorate("contributionService", new ContributionService(repository, aiProvider, eventBus));

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed"), false);
    },
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.user?.sub ?? request.ip,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "كوكب يولد أمامك API",
        description: "Grounded, causal planet simulation backend",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          cookieAuth: { type: "apiKey", in: "cookie", name: AUTH_COOKIE },
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      tags: [
        { name: "system" },
        { name: "auth" },
        { name: "world" },
        { name: "contributions" },
        { name: "admin" },
        { name: "realtime" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(websocket, {
    options: { maxPayload: 16 * 1024, perMessageDeflate: false },
  });
  await registerAuth(app);

  app.addHook("onRequest", async (request) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    if (!request.cookies[AUTH_COOKIE] || request.headers.authorization) return;
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) {
      throw new AppError(403, "ORIGIN_REJECTED", "Request origin is not allowed");
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          issues: error.issues,
          requestId: request.id,
        },
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId: request.id },
      });
    }
    const fastifyError = error as Error & { validation?: unknown };
    if (fastifyError.validation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: fastifyError.message,
          requestId: request.id,
        },
      });
    }
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Route not found", requestId: request.id },
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(worldRoutes);
  await app.register(contributionRoutes);
  await app.register(adminRoutes);
  await app.register(websocketRoutes);

  app.addHook("onClose", async () => {
    await Promise.allSettled([eventBus.close(), repository.close()]);
  });
  return app;
}
