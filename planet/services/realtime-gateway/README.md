# realtime-gateway — consolidated (not a separate process)

**Status: intentionally consolidated into `@planet/api`.**

The WebSocket gateway runs inside the API service (`src/realtime/realtime.gateway.ts`)
in the current topology, because the API already authenticates JWTs and owns the
event fan-out from `WorldsService`. Splitting it into its own process only makes
sense with a shared event bus (NATS JetStream) in front of it.

Extraction path (documented, not yet activated):

1. Deploy NATS JetStream (`docker-compose.yml` includes a `nats` service).
2. API publishes deltas to subjects `world.<id>.event` instead of in-process fan-out.
3. This package becomes a thin WS edge that subscribes to NATS and serves clients.

Until then this directory holds no running code — nothing here is presented as active.
