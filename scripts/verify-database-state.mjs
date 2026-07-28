import "./load-env.js";
import mysql from "mysql2/promise";

const legacyTables = ["adContacts", "adEvents", "adMedia", "adRevisions"];
const centralTables = ["ad_contacts", "ad_events", "ad_media", "ad_revisions", "media_assets"];
const latestMigration = {
  hash: "e6fc7e3345a2dee729615a49bea66043ce885f5c09622e2668757f7398c655c2",
  createdAt: 1785258647680,
};

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tableRows] = await connection.execute(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN (${[...legacyTables, ...centralTables].map(() => "?").join(", ")})`,
    [...legacyTables, ...centralTables],
  );
  const existing = new Set(tableRows.map((row) => row.tableName));
  const remainingLegacy = legacyTables.filter((table) => existing.has(table));
  const missingCentral = centralTables.filter((table) => !existing.has(table));

  const rowCounts = {};
  for (const table of centralTables) {
    if (!existing.has(table)) continue;
    const [rows] = await connection.query(`SELECT COUNT(*) AS rowCount FROM \`${table}\``);
    rowCounts[table] = Number(rows[0].rowCount);
  }

  const [settingRows] = await connection.execute(
    "SELECT value FROM app_settings WHERE settingKey = ? LIMIT 1",
    ["media.policy"],
  );
  const policy = settingRows[0]?.value ?? null;
  const policyOk = Boolean(
    policy &&
      policy.imageMaxBytes === 5 * 1024 * 1024 &&
      policy.videoMaxBytes === 50 * 1024 * 1024 &&
      Array.isArray(policy.allowedVideoMimeTypes) &&
      policy.allowedVideoMimeTypes.length === 1 &&
      policy.allowedVideoMimeTypes[0] === "video/mp4",
  );

  const [indexRows] = await connection.execute(
    `SELECT index_name AS indexName,
            non_unique AS nonUnique,
            GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columnsList
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'ad_media'
      GROUP BY index_name, non_unique`,
  );
  const mediaAssetIndex = indexRows.find((row) => row.indexName === "ad_media_asset_uq");
  const mediaAssetIndexOk = Boolean(
    mediaAssetIndex &&
      Number(mediaAssetIndex.nonUnique) === 0 &&
      mediaAssetIndex.columnsList === "revisionId,mediaAssetId",
  );

  const [migrationRows] = await connection.execute(
    "SELECT hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  );
  const migration = migrationRows[0] ?? null;
  const migrationLedgerOk = Boolean(
    migration &&
      migration.hash === latestMigration.hash &&
      Number(migration.createdAt) === latestMigration.createdAt,
  );

  const result = {
    ok:
      remainingLegacy.length === 0 &&
      missingCentral.length === 0 &&
      policyOk &&
      mediaAssetIndexOk &&
      migrationLedgerOk,
    legacyTablesRemoved: remainingLegacy.length === 0,
    remainingLegacy,
    centralTablesPresent: missingCentral.length === 0,
    missingCentral,
    centralRowCounts: rowCounts,
    mediaPolicyValid: policyOk,
    mediaPolicy: policy,
    mediaAssetUniqueIndexValid: mediaAssetIndexOk,
    mediaAssetUniqueIndex: mediaAssetIndex ?? null,
    migrationLedgerValid: migrationLedgerOk,
    latestMigration: migration,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  connection.destroy();
}
