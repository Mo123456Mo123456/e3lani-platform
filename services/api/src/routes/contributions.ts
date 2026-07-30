import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authenticate, requireRoles } from '../auth/middleware.js';
import { createAndProcessContribution, injectContribution } from '../services/contribution-flow.js';

const createSchema = z.object({
  planetId: z.string().min(1),
  type: z.enum(['species', 'plant', 'element', 'invention', 'event', 'culture']),
  title: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  payload: z.record(z.unknown()).optional(),
  inject: z.boolean().optional(),
});

export async function contributionRoutes(app: FastifyInstance) {
  app.post('/contributions', { preHandler: [authenticate, requireRoles('life_maker', 'explorer', 'user')] }, async (req, reply) => {
    const body = createSchema.parse(req.body);
    try {
      const result = await createAndProcessContribution(
        {
          userId: req.user.sub,
          planetId: body.planetId,
          type: body.type,
          title: body.title,
          description: body.description,
          payload: body.payload,
        },
        { inject: body.inject },
      );
      return reply.code(201).send(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post('/contributions/:id/inject', { preHandler: [authenticate, requireRoles('life_maker', 'sim_manager')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await injectContribution(id);
      return result;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.get('/contributions/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(s.userContributions).where(eq(s.userContributions.id, id)).limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    return { contribution: rows[0] };
  });

  app.get('/contributions', { preHandler: [authenticate] }, async (req) => {
    const db = getDb();
    const mine = await db.select().from(s.userContributions).where(eq(s.userContributions.userId, req.user.sub)).limit(100);
    return { contributions: mine };
  });
}
