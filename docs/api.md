# API reference

Base URL: `http://localhost:4000`  
Interactive OpenAPI: **`/docs`**

Auth: `Authorization: Bearer <accessToken>` unless noted.

## Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | — | Liveness + db path |
| GET | `/ready` | — | Readiness |

## Auth

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/auth/register` | — | `{ email, password, displayName }` |
| POST | `/auth/login` | — | `{ email, password }` → tokens + user |
| POST | `/auth/refresh` | — | `{ refreshToken }` |
| POST | `/auth/logout` | JWT | `{ refreshToken? }` |
| GET | `/auth/me` | JWT | Current id/email/roles |

## Planets & world

| Method | Path | Auth |
|--------|------|------|
| GET | `/planets` | — |
| GET | `/planets/:id` | — |
| GET | `/planets/:id/civilizations` | — |
| GET | `/planets/:id/species` | — |
| POST | `/planets/:id/tick` | `sim_manager+` |
| GET | `/planets/:planetId/events` | — |
| GET | `/events/:id` | — |
| GET | `/planets/:planetId/timeline` | — |
| GET | `/planets/:planetId/timeline/:tick` | — |
| GET | `/planets/:id/regions` (regions router) | — |

## Contributions & notifications

| Method | Path | Auth |
|--------|------|------|
| POST | `/contributions` | `user` / `explorer` / `life_maker`… |
| GET | `/contributions` | JWT (own) |
| GET | `/contributions/:id` | JWT |
| POST | `/contributions/:id/inject` | `life_maker` / `sim_manager` |
| GET/PATCH | `/notifications`… | JWT |

## Admin (RBAC)

Minimum roles noted; `admin` / `super_admin` generally pass hierarchy checks.

| Method | Path | Roles |
|--------|------|-------|
| GET | `/admin/stats` | admin, sim_manager, content_mod |
| GET | `/admin/users` | admin |
| PATCH | `/admin/users/:id/roles` | admin / super_admin |
| POST | `/admin/users/:id/roles` | admin / super_admin (compat) |
| GET | `/admin/planets` | admin, sim_manager |
| POST | `/admin/simulation/pause` | admin, sim_manager |
| POST | `/admin/simulation/resume` | admin, sim_manager |
| POST | `/admin/simulation/tick` | admin, sim_manager |
| GET | `/admin/simulation/ticks` | admin, sim_manager |
| GET | `/admin/snapshots` | admin, sim_manager |
| POST | `/admin/snapshots/:id/rollback` | admin, sim_manager |
| GET | `/admin/contributions` | admin, content_mod |
| POST | `/admin/contributions/:id/approve` | admin, content_mod |
| POST | `/admin/contributions/:id/reject` | admin, content_mod |
| GET | `/admin/moderation` | admin, content_mod |
| GET | `/admin/events` | admin, sim_manager, content_mod |
| GET | `/admin/ai-requests` | admin |
| GET | `/admin/audit` | admin |
| GET | `/admin/health-detail` | admin, sim_manager |
| GET | `/admin/settings` | admin |
| PATCH | `/admin/settings` | admin / super_admin |

## Internal

| Method | Path | Auth |
|--------|------|------|
| POST | `/internal/publish` | header `x-internal-key` |

## WebSocket delta events

Gateway: `ws://localhost:4001` (see realtime service).

Envelope shape (API bus → gateway):

```ts
{
  type: 'planet.delta' | 'planet.rollback' | string;
  planetId?: string;
  userId?: string;
  tick?: number;
  events?: unknown[];
  patches?: unknown[];
  payload?: Record<string, unknown>;
}
```

Clients subscribe per planet; UI applies patches and appends events without re-fetching full state when possible.

## Simulation / AI microservices

Documented in service READMEs:

- Sim: `/simulate/ticks`, `/simulate/inject`, `/simulate/forecast`, `/simulate/rebuild`, `/simulate/state/:id`
- AI: `/ai/analyze-element`, `/ai/narrate`, `/ai/moderate`, `/ai/balance`
