import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireRoles } from '../auth/middleware.js';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/stats', { preHandler: [requireRoles('admin')] }, async () => {
    const db = getDb();
    const [users, planets, contributions, events] = await Promise.all([
      db.select().from(s.users),
      db.select().from(s.planets),
      db.select().from(s.userContributions),
      db.select().from(s.worldEvents),
    ]);
    return {
      users: users.length,
      planets: planets.length,
      contributions: contributions.length,
      events: events.length,
    };
  });

  app.get('/admin/users', { preHandler: [requireRoles('admin')] }, async () => {
    const db = getDb();
    const users = await db
      .select({
        id: s.users.id,
        email: s.users.email,
        displayName: s.users.displayName,
        status: s.users.status,
        createdAt: s.users.createdAt,
      })
      .from(s.users);
    return { users };
  });

  app.post('/admin/users/:id/roles', { preHandler: [requireRoles('super_admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ role: z.string() }).parse(req.body);
    const db = getDb();
    const roleRows = await db.select().from(s.roles).where(eq(s.roles.name, body.role)).limit(1);
    if (!roleRows[0]) return reply.code(404).send({ error: 'Role not found' });
    await db.insert(s.userRoles).values({ id: nanoid(), userId: id, roleId: roleRows[0].id });
    await db.insert(s.auditLogs).values({
      id: nanoid(),
      actorId: req.user.sub,
      action: 'grant_role',
      resourceType: 'user',
      resourceId: id,
      details: { role: body.role },
    });
    return { ok: true };
  });

  app.get('/admin/audit', { preHandler: [requireRoles('admin')] }, async () => {
    const db = getDb();
    return { logs: await db.select().from(s.auditLogs).limit(200) };
  });
}
