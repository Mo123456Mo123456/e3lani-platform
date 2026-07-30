import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authenticate, requireRoles } from '../auth/middleware.js';

export async function planetRoutes(app: FastifyInstance) {
  app.get('/planets', async () => {
    const db = getDb();
    const rows = await db.select().from(s.planets);
    return { planets: rows };
  });

  app.get('/planets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(s.planets).where(eq(s.planets.id, id)).limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    const planet = rows[0];
    const [civs, citiesCount, speciesCount, plantsCount, resourcesCount] = await Promise.all([
      db.select().from(s.civilizations).where(eq(s.civilizations.planetId, id)),
      db.select().from(s.cities).where(eq(s.cities.planetId, id)),
      db.select().from(s.species).where(eq(s.species.planetId, id)),
      db.select().from(s.plants).where(eq(s.plants.planetId, id)),
      db.select().from(s.resources).where(eq(s.resources.planetId, id)),
    ]);
    return {
      planet,
      stats: {
        civilizations: civs.length,
        cities: citiesCount.length,
        species: speciesCount.length,
        plants: plantsCount.length,
        resources: resourcesCount.length,
      },
      civilizations: civs,
    };
  });

  app.get('/planets/:id/civilizations', async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    return { civilizations: await db.select().from(s.civilizations).where(eq(s.civilizations.planetId, id)) };
  });

  app.get('/planets/:id/species', async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { limit?: string };
    const limit = Math.min(Number(q.limit || 50), 300);
    const db = getDb();
    const rows = await db.select().from(s.species).where(eq(s.species.planetId, id)).limit(limit);
    return { species: rows };
  });

  app.post('/planets/:id/tick', { preHandler: [authenticate, requireRoles('sim_manager')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(s.planets).where(eq(s.planets.id, id)).limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    const { runSimulationTick } = await import('../services/simulation-client.js');
    const { publish } = await import('../ws-bridge.js');
    const { nanoid } = await import('nanoid');
    const planet = rows[0];
    const tick = planet.currentTick + 1;
    const delta = await runSimulationTick({ planetId: id, seed: planet.seed, tick });
    for (const ev of delta.events) {
      await db.insert(s.worldEvents).values({
        id: nanoid(),
        planetId: id,
        tick,
        type: ev.type,
        title: ev.title,
        description: ev.description,
        severity: ev.severity,
        actors: ev.actors,
        payload: ev.payload,
      });
    }
    await db.insert(s.simulationTicks).values({
      id: nanoid(),
      planetId: id,
      tick,
      year: delta.year,
      deltaSummary: { source: delta.source },
    });
    await db.update(s.planets).set({ currentTick: tick, ageYears: delta.year }).where(eq(s.planets.id, id));
    publish({ type: 'planet.delta', planetId: id, tick, events: delta.events, patches: delta.patches });
    return delta;
  });
}
