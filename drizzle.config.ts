import type { Config } from "drizzle-kit";

export default {
  schema: "./services/api/src/db/schema.ts",
  out: "./services/api/drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? "./data/kawkab.sqlite"
  }
} satisfies Config;
