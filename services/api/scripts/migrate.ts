import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(resolve(here, "../migrations/001_foundation.sql"), "utf8");
const client = new Client({ connectionString });

await client.connect();
try {
  await client.query(sql);
  process.stdout.write("Database migration 001_foundation applied.\n");
} finally {
  await client.end();
}
