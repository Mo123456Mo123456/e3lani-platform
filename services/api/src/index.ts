import path from 'node:path';
import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';

const port = Number(process.env.API_PORT || process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  if (!process.env.SQLITE_PATH) {
    process.env.SQLITE_PATH = path.resolve(process.cwd(), '../../data/planet.db');
  }
  runMigrations();
  const app = await buildApp({ logger: true });
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port} (docs at /docs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
