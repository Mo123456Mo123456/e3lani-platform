import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { userRoles, roles } from '../db/schema.js';
import { hasMinRole, type RoleName } from './roles.js';

export type JwtUser = {
  sub: string;
  email: string;
  roles: string[];
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export async function loadUserRoles(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.name);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRoles(...required: RoleName[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = request.user;
    const ok = required.some((r) => hasMinRole(user.roles || [], r) || (user.roles || []).includes(r));
    if (!ok) {
      return reply.code(403).send({ error: 'Forbidden', required });
    }
  };
}

export function optionalAuth(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) {
  const header = request.headers.authorization;
  if (!header) return done();
  request
    .jwtVerify()
    .then(() => done())
    .catch(() => done());
}
