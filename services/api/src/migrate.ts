import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1 });
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(currentDirectory, "../migrations/001_initial.sql");
const migration = await readFile(migrationPath, "utf8");

await sql.unsafe(migration);
console.info(JSON.stringify({ status: "ok", migration: "001_initial.sql" }));
await sql.end();
