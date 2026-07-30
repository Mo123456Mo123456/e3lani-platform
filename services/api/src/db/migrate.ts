import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

/**
 * Forward-only SQL migration runner. Applies files in lexical order,
 * records them in schema_migrations, all inside per-file transactions.
 */
export async function runMigrations(databaseUrl: string, dir = join(__dirname, "migrations")): Promise<string[]> {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const applied: string[] = [];
  try {
        const client = await pool.connect();
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      );
      const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
      const done = new Set(rows.map((r) => r.name));
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        if (done.has(file)) continue;
        const sql = readFileSync(join(dir, file), "utf8");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
          await client.query("COMMIT");
          applied.push(file);
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`migration ${file} failed: ${(err as Error).message}`);
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  return applied;
}
