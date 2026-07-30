import type { FastifyInstance } from 'fastify';
import { getSqlitePath } from '../db/client.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    service: '@planet/api',
    time: new Date().toISOString(),
    db: getSqlitePath(),
  }));

  app.get('/ready', async () => ({ ready: true }));
}
