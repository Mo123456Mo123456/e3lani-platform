/**
 * API bootstrap: load env, open the repository (Postgres when configured,
 * otherwise the in-memory sandbox store), ensure the default planet and
 * sandbox accounts exist, then serve.
 */
import { loadApiEnv } from "@planet/config";
import { buildApp } from "./app.js";
import { MemoryRepository } from "./store/memory.js";
import { PgRepository } from "./store/pg.js";
import { runMigrations } from "./store/migrate.js";
import type { Repository } from "./store/repository.js";
import { seedSandboxAccounts, ensureDefaultPlanet } from "./world/bootstrap.js";

async function main(): Promise<void> {
  const env = loadApiEnv();

  let repository: Repository;
  if (env.DATABASE_URL) {
    await runMigrations(env.DATABASE_URL);
    repository = new PgRepository(env.DATABASE_URL);
    console.log("[api] using PostgreSQL repository");
  } else {
    repository = new MemoryRepository();
    console.log("[api] DATABASE_URL not set — using in-memory sandbox repository");
  }

  const { app, ctx } = await buildApp({ env, repository });
  await seedSandboxAccounts(repository);
  const planet = await ensureDefaultPlanet(ctx);
  if (env.AUTO_TICK) {
    ctx.worlds.startAutoTick(planet.id, env.AUTO_TICK_INTERVAL_MS);
    console.log(`[api] auto-tick enabled for ${planet.id} every ${env.AUTO_TICK_INTERVAL_MS}ms`);
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[api] listening on http://${env.HOST}:${env.PORT} (docs at /docs)`);
}

main().catch((error) => {
  console.error("[api] fatal boot error", error);
  process.exit(1);
});
