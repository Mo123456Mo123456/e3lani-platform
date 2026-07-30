# Database

`services/api/src/db/schema.ts` defines Drizzle tables for users, planets, world events, contributions, and notifications.

Local development uses SQLite through `better-sqlite3` when no production database is configured. Docker Compose provisions PostgreSQL 16 for the intended deployment target; the schema boundaries match shared types so a Postgres Drizzle migration can be added without changing API contracts.

The API now persists:

- current simulation state JSON in `planets.payload`;
- append-only `world_events`;
- timeline/state snapshots in `state_snapshots`;
- contribution payloads including preview/compare metadata;
- notification records generated when confirmed contributions produce events.

Commands:

```bash
pnpm db:migrate
pnpm db:seed
```
