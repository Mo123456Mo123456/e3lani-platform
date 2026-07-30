import Fastify from 'fastify';
import { z } from 'zod';
import { generatePlanet } from './generator.js';

async function main() {
  const port = Number(process.env.WORLD_GEN_PORT || 4002);
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true, service: '@planet/world-generator' }));

  app.post('/generate', async (req, reply) => {
    const body = z
      .object({
        seed: z.string().min(1),
        resolution: z.number().int().min(4).max(256).default(32),
      })
      .parse(req.body);
    const planet = await generatePlanet(body.seed, body.resolution);
    return reply.send(planet);
  });

  await app.listen({ port, host: process.env.HOST || '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
