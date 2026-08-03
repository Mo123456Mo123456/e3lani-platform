import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const apply = process.argv.includes("--apply");

function splitSql(sql) {
  const result = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (char === "\n") { lineComment = false; current += char; }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (!quote && char === "-" && next === "-") { lineComment = true; i += 1; continue; }
    if (!quote && char === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (quote) {
      current += char;
      if (char === "\\") { current += sql[i + 1] ?? ""; i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; current += char; continue; }
    if (char === ";") {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

const connection = await mysql.createConnection(databaseUrl);
const schemaName = new URL(databaseUrl).pathname.replace(/^\//, "");

async function tableExists(name) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
    [schemaName, name],
  );
  return rows.length > 0;
}
async function columnExists(table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1",
    [schemaName, table, column],
  );
  return rows.length > 0;
}
async function indexExists(table, indexName) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1",
    [schemaName, table, indexName],
  );
  return rows.length > 0;
}
async function runMigration(path, tag) {
  const sql = await readFile(path, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  for (const statement of splitSql(sql)) await connection.query(statement);
  await connection.query(
    "INSERT INTO e3lani_deploy_migrations (tag, checksum, appliedAt) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), appliedAt = VALUES(appliedAt)",
    [tag, checksum],
  );
}

try {
  const [lockRows] = await connection.query("SELECT GET_LOCK('e3lani-production-schema', 60) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) throw new Error("SCHEMA_LOCK_TIMEOUT");
  await connection.query(
    "CREATE TABLE IF NOT EXISTS e3lani_deploy_migrations (tag varchar(120) PRIMARY KEY, checksum varchar(64) NOT NULL, appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );

  const baseTables = ["users", "visitor_sessions", "ads", "media_assets", "favorites", "reports", "moderation_cases", "audit_logs", "report_actions"];
  for (const table of baseTables) if (!(await tableExists(table))) throw new Error(`BASE_SCHEMA_MISSING:${table}`);

  const state0010 = [
    await tableExists("advertiser_profiles"),
    await tableExists("profile_posts"),
    await tableExists("share_media_variants"),
    await columnExists("visitor_sessions", "status"),
    await columnExists("ads", "ownerVisitorSessionId"),
  ];
  const count0010 = state0010.filter(Boolean).length;
  if (count0010 === 0) {
    if (!apply) throw new Error("MIGRATION_0010_REQUIRED");
    await runMigration("drizzle/0010_guest_profiles_posts_sharing.sql", "0010_guest_profiles_posts_sharing");
  } else if (count0010 !== state0010.length) {
    throw new Error("MIGRATION_0010_PARTIAL_STATE");
  }

  const state0011 = [
    await columnExists("ads", "adminHold"),
    await columnExists("ads", "adminHoldReason"),
    await tableExists("profile_post_events"),
    await indexExists("identity_action_events", "identity_action_user_idempotency_unique"),
    await indexExists("identity_action_events", "identity_action_visitor_idempotency_unique"),
  ];
  const count0011 = state0011.filter(Boolean).length;
  if (count0011 === 0) {
    if (!apply) throw new Error("MIGRATION_0011_REQUIRED");
    await runMigration("drizzle/0011_production_safety_hardening.sql", "0011_production_safety_hardening");
  } else if (count0011 !== state0011.length) {
    throw new Error("MIGRATION_0011_PARTIAL_STATE");
  }

  console.log("[schema] production schema verified");
} finally {
  await connection.query("SELECT RELEASE_LOCK('e3lani-production-schema')").catch(() => undefined);
  await connection.end();
}
