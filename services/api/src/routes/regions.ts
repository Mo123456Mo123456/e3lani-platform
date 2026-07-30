import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';

export async function regionRoutes(app: FastifyInstance) {
  app.get('/planets/:planetId/regions', async (req) => {
    const { planetId } = req.params as { planetId: string };
    const db = getDb();
    const regions = await db.select().from(s.planetRegions).where(eq(s.planetRegions.planetId, planetId));
    const biomes = await db.select().from(s.biomes).where(eq(s.biomes.planetId, planetId));
    return { regions, biomes };
  });

  app.get('/planets/:planetId/regions/:id', async (req, reply) => {
    const { id } = req.params as { planetId: string; id: string };
    const db = getDb();
    const rows = await db.select().from(s.planetRegions).where(eq(s.planetRegions.id, id)).limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    return { region: rows[0] };
  });

  app.get('/planets/:planetId/climate', async (req) => {
    const { planetId } = req.params as { planetId: string };
    const db = getDb();
    const cells = await db.select().from(s.climateCells).where(eq(s.climateCells.planetId, planetId)).limit(256);
    return { cells };
  });
}
