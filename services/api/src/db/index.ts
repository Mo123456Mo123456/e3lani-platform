import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv } from "@kawkab/config";
import * as schema from "./schema";

const env = loadEnv();
const sqlitePath = resolve(process.cwd(), env.SQLITE_PATH);
mkdirSync(dirname(sqlitePath), { recursive: true });
export const sqlite = new Database(sqlitePath);
export const db = drizzle(sqlite, { schema });

export function migrate(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      roles TEXT NOT NULL,
      refresh_token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS planets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      seed TEXT NOT NULL,
      age_years INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS world_events (
      id TEXT PRIMARY KEY,
      planet_id TEXT NOT NULL,
      tick INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      planet_id TEXT NOT NULL,
      category TEXT NOT NULL,
      prompt TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      planet_id TEXT NOT NULL,
      event_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state_snapshots (
      id TEXT PRIMARY KEY,
      planet_id TEXT NOT NULL,
      tick INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
