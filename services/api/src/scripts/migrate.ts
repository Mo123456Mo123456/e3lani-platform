import "dotenv/config";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationPath = fileURLToPath(
  new URL("../db/migrations/0001_planet_foundation.sql", import.meta.url),
);
const client = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await client.file(migrationPath);
  console.log("Applied 0001_planet_foundation.sql");
} finally {
  await client.end();
}
