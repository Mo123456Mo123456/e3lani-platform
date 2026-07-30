import postgres, { type Sql } from "postgres";

let database: Sql | undefined;

export function getDatabase(): Sql {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required; this API has no in-memory production fallback");
    database = postgres(url, {
      max: Number(process.env.DB_POOL_SIZE ?? 10),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
      transform: { undefined: null },
    });
  }
  return database;
}

export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  await getDatabase()`SELECT 1`;
  return { ok: true, latencyMs: Math.round(performance.now() - started) };
}

export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.end({ timeout: 5 });
    database = undefined;
  }
}
