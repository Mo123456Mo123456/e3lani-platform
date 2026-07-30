import { pool } from "./client.js";

async function main() {
  await pool.query(`
    DROP TABLE IF EXISTS
      world_state_blobs,
      audit_logs,
      notifications,
      moderation_results,
      ai_requests,
      timeline_snapshots,
      causal_links,
      world_events,
      simulation_ticks,
      user_contributions,
      migrations,
      diseases,
      wars,
      alliances,
      trade_routes,
      languages,
      cultures,
      technologies,
      cities,
      civilizations,
      resources,
      plants,
      species,
      planet_regions,
      planets,
      refresh_tokens,
      profiles,
      users
    CASCADE;
  `);
  console.log("Database wiped.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
