import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabase, closeDatabase } from "./database.js";

export async function migrate(): Promise<void> {
  const sql = getDatabase();
  const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`SELECT pg_advisory_lock(73409281)`;
  try {
    for (const file of files) {
      const applied = await sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = ${file}) AS exists
      `;
      if (applied[0]?.exists) continue;
      const content = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(content);
        await transaction`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });
      console.info(JSON.stringify({ level: "info", message: "migration_applied", migration: file }));
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(73409281)`;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  migrate()
    .then(() => closeDatabase())
    .catch(async (error: unknown) => {
      console.error(error);
      await closeDatabase();
      process.exitCode = 1;
    });
}
