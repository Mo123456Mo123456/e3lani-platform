import type { FastifyInstance } from 'fastify';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';

export async function eventRoutes(app: FastifyInstance) {
  app.get('/planets/:planetId/events', async (req) => {
    const { planetId } = req.params as { planetId: string };
    const q = req.query as { fromTick?: string; toTick?: string; limit?: string };
    const db = getDb();
    const fromTick = q.fromTick ? Number(q.fromTick) : undefined;
    const toTick = q.toTick ? Number(q.toTick) : undefined;
    const limit = Math.min(Number(q.limit || 100), 500);

    let rows;
    if (fromTick !== undefined && toTick !== undefined) {
      rows = await db
        .select()
        .from(s.worldEvents)
        .where(and(eq(s.worldEvents.planetId, planetId), gte(s.worldEvents.tick, fromTick), lte(s.worldEvents.tick, toTick)))
        .limit(limit);
    } else {
      rows = await db.select().from(s.worldEvents).where(eq(s.worldEvents.planetId, planetId)).limit(limit);
    }

    const links = await db.select().from(s.causalLinks).where(eq(s.causalLinks.planetId, planetId)).limit(limit);
    return { events: rows, causalLinks: links };
  });

  app.get('/events/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(s.worldEvents).where(eq(s.worldEvents.id, id)).limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    const causes = await db.select().from(s.causalLinks).where(eq(s.causalLinks.effectEventId, id));
    const effects = await db.select().from(s.causalLinks).where(eq(s.causalLinks.causeEventId, id));
    return { event: rows[0], causes, effects };
  });
}
