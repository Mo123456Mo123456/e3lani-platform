# API and realtime contract

Interactive OpenAPI is served at `http://localhost:4000/docs`.

## Core REST flow

1. `POST /v1/auth/register` — create user/profile and receive access token.
2. `GET /v1/world` — PostgreSQL-backed state, events, and current version.
3. `POST /v1/contributions/analyze` — validated provider output plus scenarios.
4. `POST /v1/contributions` — optimistic version check and atomic event append.
5. `POST /v1/world/ticks` — run 1–10 deterministic ticks.
6. `GET /v1/world/events/:id/causes` — recursive causal links.
7. `GET /v1/world/timeline` and `/v1/world/compare` — snapshot history.

Write routes require `Authorization: Bearer <accessToken>`. Refresh tokens are
opaque HttpOnly cookies and can only be sent to `/v1/auth`.

## WebSocket

Connect to:

```text
ws://localhost:4000/v1/realtime?token=<short-lived-access-token>
```

Ready message:

```json
{"type":"realtime.ready","payload":{"deltaUpdates":true}}
```

World delta:

```json
{
  "type": "world.delta",
  "payload": {
    "planetId": "uuid",
    "fromVersion": 12,
    "toVersion": 13,
    "tick": 12,
    "year": 12,
    "changedRegions": [{"id":"uuid","temperature":0.51}],
    "changedCivilizations": [{"id":"uuid","population":125000}],
    "events": []
  }
}
```

The client applies a delta only when `fromVersion` matches its state. A mismatch
triggers the normal REST refetch path; silently applying an out-of-order delta
is forbidden.

## NATS subjects

- `world.delta`
- `world.events.<lowercase_event_type>`

JetStream is enabled in Docker Compose. The API publishes after PostgreSQL
commits; WebSocket delivery is local in this first deployment slice.
