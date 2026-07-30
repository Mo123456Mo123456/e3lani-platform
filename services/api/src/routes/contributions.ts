import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authenticate, requireRoles } from '../auth/middleware.js';
import { createAndProcessContribution, injectContribution } from '../services/contribution-flow.js';
import { analyzeContribution } from '../services/ai-client.js';
import { runSimulationTick } from '../services/simulation-client.js';

const createSchema = z.object({
  planetId: z.string().min(1),
  type: z.enum(['species', 'plant', 'element', 'invention', 'event', 'culture']),
  title: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  payload: z.record(z.unknown()).optional(),
  inject: z.boolean().optional(),
});

const analyzeSchema = z.object({
  planetId: z.string().min(1).optional(),
  type: z.enum(['species', 'plant', 'element', 'invention', 'event', 'culture']),
  title: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function contributionRoutes(app: FastifyInstance) {
  app.post('/contributions/analyze', { preHandler: [authenticate] }, async (req) => {
    const body = analyzeSchema.parse(req.body);
    const analysis = await analyzeContribution({
      userId: req.user.sub,
      type: body.type,
      title: body.title,
      description: body.description,
      payload: body.payload,
    });
    const balanceScore = Number((1 - analysis.risk * 0.7).toFixed(4));
    const sandbox = analysis.provider === 'local-mock';
    return { analysis, balanceScore, sandbox, balanceHints: analysis.balanceHints };
  });

  app.post('/contributions/:id/forecast', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ years: z.number().int().min(1).max(500).optional() }).parse(req.body || {});
    const db = getDb();
    const rows = await db.select().from(s.userContributions).where(eq(s.userContributions.id, id)).limit(1);
    const contrib = rows[0];
    if (!contrib) return reply.code(404).send({ error: 'Not found' });
    const planets = await db.select().from(s.planets).where(eq(s.planets.id, contrib.planetId)).limit(1);
    const planet = planets[0];
    if (!planet) return reply.code(404).send({ error: 'Planet not found' });

    const years = body.years || 50;
    const scenarios = ['mostLikely', 'best', 'worst'] as const;
    const forecasts = [];
    for (let i = 0; i < scenarios.length; i++) {
      const tick = planet.currentTick + 1 + i;
      const delta = await runSimulationTick({
        planetId: planet.id,
        seed: planet.seed,
        tick,
        contribution: {
          type: contrib.type,
          title: contrib.title,
          payload: (contrib.payload as Record<string, unknown>) || {},
        },
      });
      forecasts.push({
        label: scenarios[i],
        probability: scenarios[i] === 'mostLikely' ? 0.55 : scenarios[i] === 'best' ? 0.25 : 0.2,
        events: delta.events,
        metrics: { year: delta.year, eventCount: delta.events.length },
      });
    }

    return {
      contributionId: id,
      years,
      monteCarloRuns: 3,
      mostLikely: forecasts[0],
      best: forecasts[1],
      worst: forecasts[2],
      uncertainty: 0.35,
      sandbox: true,
    };
  });

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
