import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authenticate } from '../auth/middleware.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: [authenticate] }, async (req) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, req.user.sub))
      .limit(100);
    return { notifications: rows };
  });

  app.post('/notifications/:id/read', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db
      .select()
      .from(s.notifications)
      .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, req.user.sub)))
      .limit(1);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    await db.update(s.notifications).set({ read: true }).where(eq(s.notifications.id, id));
    return { ok: true };
  });
}
