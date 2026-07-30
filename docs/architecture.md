# Architecture

## Overview

```mermaid
flowchart LR
  Web[apps/web R3F] -->|REST/WS| API[services/api]
  Admin[apps/admin] -->|REST RBAC| API
  API --> PG[(PostgreSQL)]
  API --> Redis[(Redis)]
  API --> SimCore[@planet/simulation-core]
  API --> AI[ai-orchestrator]
  API --> PySim[simulation-engine]
  AI --> Providers[OpenAI / Anthropic / Gemini / Sandbox]
```

## Separation of concerns

1. **Simulation core (TypeScript)** — deterministic ticks, world generation, ecology, civilizations, wars, trade (Dijkstra), causal event graph. Source of truth for world outcomes.
2. **Python simulation-engine** — numeric helpers (Lotka–Volterra, climate CA step, war odds) callable by API for heavy batches.
3. **AI orchestrator** — structured extraction, balance suggestions, narrative **from facts only**. Never invents events absent from simulation payloads.
4. **API** — auth, persistence, WebSocket delta fan-out, contribution workflow, admin.
5. **Web** — visualization & UX only; no simulation logic beyond display.

## Event bus

Default: in-process `EventEmitter` (`EVENT_BUS=memory`).  
Production path: set `NATS_URL` (adapter stub ready for JetStream swap).

## Realtime

WebSocket `/ws` sends:

- `world.event`
- `simulation.tick`
- `contribution.status`
- `notification` (user-scoped)
- `delta` patches
- `ai.status`

Clients must not expect full planet state every frame.

## Determinism

`SeededRandom` (Mulberry32) + forked streams per subsystem (`height`, `tick:N`, Monte Carlo sample ids). Same seed + same tick sequence ⇒ identical populations and events (verified by tests).
