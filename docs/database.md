# Database

`services/api/src/db/schema.ts` defines Drizzle tables for users, planets, world events, contributions, and notifications.

Local development uses SQLite through `better-sqlite3` when no production database is configured. Docker Compose provisions PostgreSQL 16 for the intended deployment target; the schema boundaries match shared types so a Postgres Drizzle migration can be added without changing API contracts.

Commands:

```bash
pnpm db:migrate
pnpm db:seed
```
