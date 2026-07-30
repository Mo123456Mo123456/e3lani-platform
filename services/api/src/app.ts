import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { authRoutes } from './routes/auth.js';
import { planetRoutes } from './routes/planets.js';
import { regionRoutes } from './routes/regions.js';
import { eventRoutes } from './routes/events.js';
import { contributionRoutes } from './routes/contributions.js';
import { timelineRoutes } from './routes/timeline.js';
import { notificationRoutes } from './routes/notifications.js';
import { adminRoutes } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';

export type BuildAppOptions = {
  jwtSecret?: string;
  logger?: boolean;
};

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  await app.register(cors, {
    origin: process.env.WEB_URL || true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  });

  await app.register(jwt, {
    secret: opts.jwtSecret || process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'كوكب يولد أمامك API',
        description: 'Planet Born Before You — REST API',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: err.flatten() });
    }
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode || 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: e.message || 'Internal error' });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(planetRoutes);
  await app.register(regionRoutes);
  await app.register(eventRoutes);
  await app.register(contributionRoutes);
  await app.register(timelineRoutes);
  await app.register(notificationRoutes);
  await app.register(adminRoutes);

  // Internal publish mirror for realtime / workers
  app.post('/internal/publish', async (req, reply) => {
    const key = req.headers['x-internal-key'];
    if (key !== (process.env.INTERNAL_API_KEY || 'dev-internal')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { publish } = await import('./ws-bridge.js');
    publish(req.body as Parameters<typeof publish>[0]);
    return { ok: true };
  });

  return app;
}
