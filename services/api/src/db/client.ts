import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadConfig } from "@planet/config";
import * as schema from "./schema.js";

const config = loadConfig();

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
