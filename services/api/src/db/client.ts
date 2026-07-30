import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://planet:planet@localhost:5432/planet_born",
});

export const db = drizzle(pool, { schema });
export { pool };
