import { pool } from "./client.js";

async function main() {
  await pool.query(`
    DROP TABLE IF EXISTS simulation_ticks CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS moderation_results CASCADE;
    DROP TABLE IF EXISTS ai_requests CASCADE;
    DROP TABLE IF EXISTS timeline_snapshots CASCADE;
    DROP TABLE IF EXISTS user_contributions CASCADE;
    DROP TABLE IF EXISTS causal_links CASCADE;
    DROP TABLE IF EXISTS world_events CASCADE;
    DROP TABLE IF EXISTS planet_regions CASCADE;
    DROP TABLE IF EXISTS planets CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS profiles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
  `);
  console.log("✓ Database reset");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
