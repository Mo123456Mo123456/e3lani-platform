import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerUser, verifyLogin, issueTokens, rotateRefreshToken, logout } from '../auth/tokens.js';
import { authenticate } from '../auth/middleware.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    try {
      const user = await registerUser(body);
      const tokens = await issueTokens(app, { id: user.id, email: user.email, roles: ['user'] }, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return reply.code(201).send({ user: { ...user, roles: ['user'] }, ...tokens });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    try {
      const user = await verifyLogin(body.email, body.password);
      const tokens = await issueTokens(app, user, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      return { user, ...tokens };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post('/auth/refresh', async (req, reply) => {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    try {
      const tokens = await rotateRefreshToken(app, body.refreshToken);
      return tokens;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });

  app.post('/auth/logout', { preHandler: [authenticate] }, async (req, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(req.body || {});
    await logout(body.refreshToken, req.user.sub);
    return reply.code(204).send();
  });

  app.get('/auth/me', { preHandler: [authenticate] }, async (req) => {
    return { id: req.user.sub, email: req.user.email, roles: req.user.roles };
  });
}
