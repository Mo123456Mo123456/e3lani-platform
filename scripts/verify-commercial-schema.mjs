import "./load-env.js";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const requiredTables = [
  "users",
  "ads",
  "ad_revisions",
  "ad_media",
  "ad_contacts",
  "media_assets",
  "countries",
  "scoped_pricing_rules",
  "coupons",
  "ad_price_snapshots",
  "otp_challenges",
  "auth_sessions",
  "auth_rate_limits",
  "payment_intents",
  "moderation_cases",
  "appeals",
  "reports",
  "favorites",
  "audit_logs",
];

const requiredColumns = {
  users: ["phone", "countryCode", "accountType", "status", "deletedAt"],
  ads: ["publicId", "ownerId", "countryCode", "currentRevisionId", "adStatus", "paymentStatus"],
  ad_revisions: ["title", "description", "customCityName", "reviewStatus"],
  countries: ["code", "flagEmoji", "dialCode", "currency", "isActive"],
  scoped_pricing_rules: [
    "publicId",
    "scopeType",
    "scopeRef",
    "basePrice",
    "discountPrice",
    "currency",
    "startsAt",
    "endsAt",
    "priority",
  ],
  ad_price_snapshots: [
    "adId",
    "basePrice",
    "discount",
    "tax",
    "finalPrice",
    "currency",
    "freeReason",
    "paymentStatus",
  ],
  otp_challenges: ["phone", "codeHash", "attempts", "maxAttempts", "expiresAt", "consumedAt"],
  payment_intents: [
    "publicId",
    "idempotencyKey",
    "userId",
    "adId",
    "provider",
    "environment",
    "amount",
    "currency",
    "status",
    "externalId",
    "webhookVerified",
  ],
};

const requiredIndexes = {
  ads: ["ads_publicId_unique", "ads_country_feed_idx", "ads_owner_idx"],
  ad_media: ["ad_media_asset_uq", "ad_media_order_uq"],
  countries: ["countries_code_unique"],
  scoped_pricing_rules: [
    "scoped_pricing_rules_publicId_unique",
    "scoped_pricing_rules_active_idx",
    "scoped_pricing_rules_scope_idx",
  ],
  favorites: ["favorite_user_ad_uq"],
  auth_sessions: ["auth_sessions_tokenId_unique", "auth_sessions_user_active_idx"],
  auth_rate_limits: ["auth_rate_limits_scope_key_unique"],
  payment_intents: [
    "payment_intents_publicId_unique",
    "payment_intents_idempotency_unique",
    "payment_intents_externalId_unique",
    "payment_intents_ad_idx",
  ],
};

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tableRows] = await connection.query(
    "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const tables = new Set(tableRows.map((row) => row.tableName));
  const missingTables = requiredTables.filter((table) => !tables.has(table));

  const missingColumns = [];
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const [rows] = await connection.execute(
      "SELECT column_name AS columnName FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
      [table],
    );
    const existing = new Set(rows.map((row) => row.columnName));
    for (const column of columns) {
      if (!existing.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }

  const missingIndexes = [];
  for (const [table, indexes] of Object.entries(requiredIndexes)) {
    const [rows] = await connection.execute(
      "SELECT DISTINCT index_name AS indexName FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?",
      [table],
    );
    const existing = new Set(rows.map((row) => row.indexName));
    for (const index of indexes) {
      if (!existing.has(index)) missingIndexes.push(`${table}.${index}`);
    }
  }

  const [countryRows] = await connection.query(
    "SELECT COUNT(*) AS count FROM countries WHERE isActive = 1",
  );
  const activeCountries = Number(countryRows[0]?.count ?? 0);

  const [settingRows] = await connection.execute(
    "SELECT value FROM app_settings WHERE settingKey = ? LIMIT 1",
    ["launch.policy"],
  );
  const launchPolicy = settingRows[0]?.value ?? null;
  const freeLaunchReady = Boolean(
    launchPolicy &&
      launchPolicy.globalFreeMode === true &&
      launchPolicy.paymentsEnabled === false &&
      launchPolicy.paymentRequired === false &&
      launchPolicy.instantPublishing === true &&
      launchPolicy.manualPreApproval === false &&
      launchPolicy.allCountriesVisibility === true &&
      launchPolicy.defaultFeedMarket === "ALL",
  );

  const result = {
    ok:
      missingTables.length === 0 &&
      missingColumns.length === 0 &&
      missingIndexes.length === 0 &&
      activeCountries >= 3 &&
      freeLaunchReady,
    missingTables,
    missingColumns,
    missingIndexes,
    activeCountries,
    freeLaunchReady,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await connection.end();
}
