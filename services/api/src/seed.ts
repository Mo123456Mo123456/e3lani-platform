import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, getDatabase } from "./database.js";

export async function seedSandbox(): Promise<void> {
  if (process.env.SANDBOX_MODE !== "true" && process.env.ALLOW_SEED !== "true") {
    throw new Error("Sandbox seed is disabled. Set SANDBOX_MODE=true or ALLOW_SEED=true explicitly.");
  }
  const sql = getDatabase();
  const seedDirectory = fileURLToPath(new URL("../seeds", import.meta.url));
  const files = (await readdir(seedDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  await sql`
    CREATE TABLE IF NOT EXISTS schema_seed_runs (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`SELECT pg_advisory_lock(73409282)`;
  try {
    for (const file of files) {
      const applied = await sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM schema_seed_runs WHERE name = ${file}) AS exists
      `;
      if (applied[0]?.exists) continue;
      const content = await readFile(new URL(`../seeds/${file}`, import.meta.url), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(content);
        await transaction`INSERT INTO schema_seed_runs (name) VALUES (${file})`;
      });
      console.info(JSON.stringify({ level: "info", message: "sandbox_seed_applied", seed: file }));
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(73409282)`;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  seedSandbox()
    .then(() => closeDatabase())
    .catch(async (error: unknown) => {
      console.error(error);
      await closeDatabase();
      process.exitCode = 1;
    });
}
