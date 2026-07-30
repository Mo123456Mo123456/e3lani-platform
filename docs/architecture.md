# Architecture — معمارية كوكب يولد أمامك

## Principles

1. **The engine decides, the AI explains.** Simulation outcomes come from
   deterministic algorithms. LLMs only structure input and narrate verified
   output.
2. **Determinism is a hard contract.** Same seed + same inputs ⇒ identical
   history. This is enforced by tests at every layer, including a
   cross-language RNG parity check (TypeScript ⇄ Python).
3. **Event sourcing as the source of truth.** The journal of `WorldEvent`s is
   authoritative; snapshots are an acceleration, never a second truth.
4. **No fakes.** Anything not wired end-to-end is explicitly marked
   "not activated" (see each service README and the README status table).

## Component map

```mermaid
flowchart TB
  subgraph apps/web (Next.js)
    UI[Panels + Wizard]
    R3F[React Three Fiber]
    WORKER[grid.worker.ts<br/>regenerates planet from seed]
    UI --> R3F --> WORKER
  end
  apps/admin --> |/api proxy| API
  apps/web --> |REST| API
  apps/web --> |WebSocket| API

  subgraph services/api (Fastify)
    ROUTES[REST routes]
    GW[realtime/gateway.ts]
    WM[WorldManager<br/>owns engines per planet]
    AUTH[auth: scrypt + JWT + refresh rotation]
    ORCH[ai/orchestrator.ts<br/>sandbox or remote]
    MOD[moderation]
    ROUTES --> WM --> GW
    ROUTES --> ORCH
    ROUTES --> MOD
    ROUTES --> AUTH
  end

  WM --> ENGINE[@planet/simulation-models<br/>SimulationEngine]
  WORKER -.bit-identical worldgen.- ENGINE

  ORCH --> |AI_ORCHESTRATOR_URL set| AIO[services/ai-orchestrator<br/>FastAPI]
  ORCH --> |fallback| SANDBOX[TS sandbox analyzer<br/>provider=mock]
  API2[scenarios route] --> |SIM_ENGINE_URL set| PYSE[services/simulation-engine]
  API2 --> |default| TSM[TS Monte Carlo in engine]

  WM --> REPO{Repository}
  REPO --> |DATABASE_URL| PG[(PostgreSQL)]
  REPO --> |default| MEM[(in-memory sandbox)]
```

## Why the canonical engine is TypeScript

Two consumers need the *exact same* world math:

- the API's `WorldManager` (authoritative simulation), and
- the browser, which regenerates terrain from the seed to avoid shipping
  megabytes of grid data and to compute suitability for the "best location"
  feature locally.

Sharing one TS package (`@planet/simulation-models`) eliminates a whole
class of drift bugs. The Python `simulation-engine` service exists for
**scale-out batch science** (heavy Monte Carlo ensembles) — its RNG is a
bit-exact port, proven by tests, so its results are interchangeable with the
canonical engine's scenario module.

## Data flow: one contribution

```mermaid
sequenceDiagram
  participant U as User
  participant W as apps/web
  participant A as services/api
  participant AI as ai layer
  participant E as SimulationEngine
  participant R as Repository
  U->>W: writes an idea
  W->>A: POST /contributions/analyze
  A->>A: moderation gate (injection/SQL/XSS)
  A->>AI: parse text
  AI-->>A: StructuredContribution (validated)
  A->>A: validateBalance (power budget)
  A-->>W: analysis + balance + provider
  W->>A: POST /contributions/preview
  A->>E: apply on throwaway branch, run 40 ticks
  E-->>A: predicted events + viability
  A-->>W: preview
  W->>A: POST /contributions/place
  A->>E: applyContribution (live world)
  E-->>A: CONTRIBUTION_PLACED + first effects
  A->>R: persist events + contribution
  A->>W: WS events/delta (all clients)
  Note over A,E: subsequent ticks propagate consequences;<br/>every descendant event inherits originUserId
  A->>R: notifications derived from journal
```

## Realtime protocol

`RealtimeMessage` (`packages/shared-types`): `hello | tick | events | delta |
notification | contribution`. After the handshake, only **deltas** flow —
cell-level owner/pollution/temperature/moisture changes, new/destroyed
cities, new/extinct species, new routes, active wars, stats. Anonymous
sockets may watch the world; `notification` messages are filtered per user.

## Persistence model

Event sourcing with two faces:

- **Hot path**: `world_events` (append-only journal) + `timeline_snapshots`
  (JSONB world state every 25 ticks). Rollback = snapshot + deterministic
  replay, with user placements re-applied at their original ticks.
- **Operational**: users/roles/refresh tokens/contributions/notifications/
  moderation/ai_requests/audit as regular relational rows.
- The remaining simulation entity tables (species, civilizations, cities…)
  exist in the schema (29 tables) and are filled by the seed/snapshot
  denormalization path for browsing; the engine's live truth remains the
  journal + snapshots.

`Repository` is an interface with two implementations:
`MemoryRepository` (dev/tests/sandbox default) and `PgRepository`
(production, `DATABASE_URL`). Zero code paths branch on the implementation
beyond bootstrapping.

## Event bus

In-process pub/sub today (`WorldManager.subscribe`). NATS JetStream is wired
as an optional compose profile (`docker compose --profile bus up`); the
subscriber boundary is the single seam needed to extract the realtime
gateway and notification worker into standalone processes. Not activated —
documented in `services/realtime-gateway/README.md`.

## Security posture

- scrypt password hashing (memory-hard, stdlib)
- JWT access tokens (15 min) + opaque refresh tokens, single-use rotation,
  family revocation on replay detection
- RBAC with 10 ranked roles; route guards per minimum role
- Moderation: prompt-injection, SQL/XSS/shell smuggling, spam entropy;
  blocked content never reaches the analyzer
- Rate limiting: global + stricter per-route on analyze/place/auth
- Zod validation at every input boundary; StructuredContribution re-validated
  after every AI call
- Audit log for administrative operations; AI request cost logging
- No user text is ever executed, queried as SQL, or interpolated into system
  prompts (the orchestrator receives it as data only)
