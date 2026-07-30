import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is unset; memory mode needs no migrations.");
} else {
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Database migrations completed.");
  } finally {
    await client.end();
  }
}
