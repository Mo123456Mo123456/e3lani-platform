import "dotenv/config";
import { pool } from "./client.js";

async function reset() {
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS analysis_cache CASCADE;
      DROP TABLE IF EXISTS trade_routes CASCADE;
      DROP TABLE IF EXISTS wars CASCADE;
      DROP TABLE IF EXISTS simulation_ticks CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS timeline_snapshots CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS moderation_results CASCADE;
      DROP TABLE IF EXISTS ai_requests CASCADE;
      DROP TABLE IF EXISTS user_contributions CASCADE;
      DROP TABLE IF EXISTS causal_links CASCADE;
      DROP TABLE IF EXISTS world_events CASCADE;
      DROP TABLE IF EXISTS technologies CASCADE;
      DROP TABLE IF EXISTS resources CASCADE;
      DROP TABLE IF EXISTS plants CASCADE;
      DROP TABLE IF EXISTS species CASCADE;
      DROP TABLE IF EXISTS cities CASCADE;
      DROP TABLE IF EXISTS civilizations CASCADE;
      DROP TABLE IF EXISTS planet_regions CASCADE;
      DROP TABLE IF EXISTS planets CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log("✓ Tables dropped");
  } finally {
    client.release();
    await pool.end();
  }
}

reset().catch((e) => {
  console.error(e);
  process.exit(1);
});
