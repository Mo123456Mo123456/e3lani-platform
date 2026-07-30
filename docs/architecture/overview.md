# Architecture Overview — كوكب يولد أمامك

```
apps/web ──────────────┐
apps/admin ────────────┤
                       ▼
                 services/api  (Nest-like Fastify gateway)
                    │  │  │
        ┌───────────┘  │  └────────────┐
        ▼              ▼               ▼
 ai-orchestrator  simulation-engine  PostgreSQL + Redis
 (provider adapters) (deterministic ticks)
        │
   OpenAI / Anthropic / Gemini / Mock
```

## Separation of concerns

1. **World generation & ticks** live in `@planet/simulation-models` and `services/simulation-engine`.
2. **AI** only structures ideas, balances traits, and narrates *given* simulation effects.
3. **API** owns auth, persistence, moderation, WebSocket deltas, and admin RBAC.
4. **Web** renders the living planet (R3F/WebGL) and never runs authoritative simulation logic.

## Determinism

- Planet seed → fractal height/moisture/temperature maps → biomes → entities.
- Tick RNG is `hash(seed:tick)` so replaying events reproduces the same history.
- Snapshots support rollback/compare.

## Realtime

- Clients subscribe on `ws://api/ws` with `{ type: "subscribe", planetId }`.
- API broadcasts `delta` envelopes (events + region patches), not full planet dumps.
