# Database

PostgreSQL schema (Drizzle + SQL migrate):

- `users`, `profiles`, `refresh_tokens`
- `planets`, `planet_regions`
- `world_events`, `causal_links`
- `user_contributions`
- `timeline_snapshots`
- `simulation_ticks`
- `ai_requests`, `moderation_results`
- `notifications`, `audit_logs`

Authoritative simulation blob: `planets.state_json` (full `WorldState`).  
Events/regions denormalized for query & UI.

## Commands

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset   # destructive
```

PostGIS/pgvector: reserved for geo queries & semantic memory in later depth phase — schema ready to extend.
