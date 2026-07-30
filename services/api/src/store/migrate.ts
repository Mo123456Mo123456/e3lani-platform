/**
 * Migration runner — applies migrations/*.sql in order, tracked in a
 * schema_migrations table. Runnable standalone (`pnpm migrate`) or at boot.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const dir = join(here, "..", "..", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (applied.rowCount && applied.rowCount > 0) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await pool.query("COMMIT");
        console.log(`[migrate] applied ${file}`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      console.log("[migrate] done");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[migrate] failed", error);
      process.exit(1);
    });
}
