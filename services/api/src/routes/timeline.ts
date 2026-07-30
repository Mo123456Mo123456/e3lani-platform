import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';

export async function timelineRoutes(app: FastifyInstance) {
  app.get('/planets/:planetId/timeline', async (req) => {
    const { planetId } = req.params as { planetId: string };
    const db = getDb();
    const snapshots = await db
      .select()
      .from(s.timelineSnapshots)
      .where(eq(s.timelineSnapshots.planetId, planetId));
    const ticks = await db.select().from(s.simulationTicks).where(eq(s.simulationTicks.planetId, planetId)).limit(200);
    return { snapshots, ticks };
  });

  app.get('/planets/:planetId/timeline/:tick', async (req, reply) => {
    const { planetId, tick } = req.params as { planetId: string; tick: string };
    const db = getDb();
    const snap = await db
      .select()
      .from(s.timelineSnapshots)
      .where(eq(s.timelineSnapshots.planetId, planetId));
    const match = snap.find((x) => x.tick === Number(tick));
    if (!match) return reply.code(404).send({ error: 'Snapshot not found' });
    const events = await db.select().from(s.worldEvents).where(eq(s.worldEvents.planetId, planetId));
    return { snapshot: match, eventsAtTick: events.filter((e) => e.tick === Number(tick)) };
  });
}
