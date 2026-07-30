# realtime-gateway

**Status: implemented as a module inside `services/api` — not a separate process yet.**

The realtime gateway (WebSocket streaming of ticks, events, deltas and
user-targeted notifications) currently lives at
[`../api/src/realtime/gateway.ts`](../api/src/realtime/gateway.ts) and is
served from the API process at `/planets/:id/stream`.

It is intentionally separated behind the `WorldManager.subscribe()` boundary
so it can be extracted into this directory as its own deployable when scale
demands it (the contract — `RealtimeMessage` in `@planet/shared-types` — is
already transport-stable). Extracting it requires: subscribe to the event
bus (NATS JetStream profile in `docker-compose.yml`) instead of in-process
subscribers. That extraction is **not activated** in this phase.
