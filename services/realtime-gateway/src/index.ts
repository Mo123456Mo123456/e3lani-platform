import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import type { WebSocket } from 'ws';

export type DeltaMessage = {
  type: string;
  planetId?: string;
  userId?: string;
  tick?: number;
  events?: unknown[];
  patches?: unknown[];
  payload?: Record<string, unknown>;
};

type Client = {
  socket: WebSocket;
  userId?: string;
  channels: Set<string>;
};

const clients = new Set<Client>();
const channelIndex = new Map<string, Set<Client>>();

function subscribe(client: Client, channel: string) {
  client.channels.add(channel);
  if (!channelIndex.has(channel)) channelIndex.set(channel, new Set());
  channelIndex.get(channel)!.add(client);
}

function unsubscribeAll(client: Client) {
  for (const ch of client.channels) {
    channelIndex.get(ch)?.delete(client);
  }
  client.channels.clear();
  clients.delete(client);
}

function broadcast(channel: string, message: DeltaMessage) {
  const set = channelIndex.get(channel);
  if (!set) return;
  const raw = JSON.stringify(message);
  for (const c of set) {
    if (c.socket.readyState === 1) c.socket.send(raw);
  }
}

export function publishDelta(msg: DeltaMessage) {
  if (msg.planetId) broadcast(`planet:${msg.planetId}`, msg);
  if (msg.userId) broadcast(`user:${msg.userId}`, msg);
}

async function main() {
  const port = Number(process.env.REALTIME_PORT || 4001);
  const app = Fastify({ logger: true });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  });
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true, service: '@planet/realtime', clients: clients.size }));

  app.post('/publish', async (req, reply) => {
    const key = req.headers['x-internal-key'];
    if (key !== (process.env.INTERNAL_API_KEY || 'dev-internal')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const body = req.body as DeltaMessage;
    publishDelta(body);
    return { ok: true };
  });

  app.register(async (scoped) => {
    scoped.get('/ws', { websocket: true }, (socket, req) => {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token') || '';
      let userId: string | undefined;
      try {
        const payload = app.jwt.verify<{ sub: string }>(token);
        userId = payload.sub;
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        socket.close();
        return;
      }

      const client: Client = { socket, userId, channels: new Set() };
      clients.add(client);
      subscribe(client, `user:${userId}`);
      socket.send(JSON.stringify({ type: 'welcome', userId, channels: [`user:${userId}`] }));

      socket.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            action: string;
            planetId?: string;
          };
          if (msg.action === 'subscribe' && msg.planetId) {
            subscribe(client, `planet:${msg.planetId}`);
            socket.send(JSON.stringify({ type: 'subscribed', channel: `planet:${msg.planetId}` }));
          }
          if (msg.action === 'unsubscribe' && msg.planetId) {
            const ch = `planet:${msg.planetId}`;
            client.channels.delete(ch);
            channelIndex.get(ch)?.delete(client);
            socket.send(JSON.stringify({ type: 'unsubscribed', channel: ch }));
          }
        } catch {
          socket.send(JSON.stringify({ type: 'error', error: 'bad_message' }));
        }
      });

      socket.on('close', () => unsubscribeAll(client));
    });
  });

  await app.listen({ port, host: process.env.HOST || '0.0.0.0' });
  app.log.info(`Realtime gateway on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
