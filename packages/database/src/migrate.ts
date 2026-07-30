import { migrate } from "drizzle-orm/postgres-js/migrator";

import { connectDatabase } from "./index";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const connection = connectDatabase(databaseUrl);
try {
  await connection.sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await connection.sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  await migrate(connection.db, { migrationsFolder: "./migrations" });
  console.info("Database migrations completed");
} finally {
  await connection.close();
}
