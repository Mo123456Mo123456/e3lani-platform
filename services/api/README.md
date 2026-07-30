# كوكب يولد أمامك — API foundation

Fastify/TypeScript service for a causal planet simulation. Production mode uses
PostgreSQL through Drizzle and `postgres-js`; the in-memory repository is
selected **only** when `SANDBOX_MODE=true`.

## Run

From the monorepo root, after the root workspace includes `services/*`:

```bash
pnpm install
cp services/api/.env.example services/api/.env
pnpm --filter @kawkab/api db:migrate
pnpm --filter @kawkab/api db:seed
pnpm --filter @kawkab/api dev
```

For a dependency-free local sandbox (no PostgreSQL and no external AI):

```bash
SANDBOX_MODE=true \
AI_PROVIDER=mock \
JWT_SECRET='replace-this-with-at-least-32-characters' \
pnpm --filter @kawkab/api dev
```

Checks:

```bash
pnpm --filter @kawkab/api typecheck
pnpm --filter @kawkab/api test
pnpm --filter @kawkab/api build
docker build -f services/api/Dockerfile .
```

OpenAPI UI is at `http://localhost:3001/docs`; its JSON document is at
`/docs/json`.

## Runtime adapters

- `SANDBOX_MODE=true`: explicit in-process deterministic repository and mock
  analyzer. The seed summary represents 12 civilizations, 40 cities, 120
  resources, 300 species, 800 plants, and 50 technologies without retaining all
  seed rows in API memory.
- Any other value: `DATABASE_URL` is mandatory and starts
  `PostgresWorldRepository`. There is no automatic memory fallback.
- `NATS_URL` selects the NATS event bus. If omitted, the same interface uses an
  in-process event bus.
- OpenAI, Anthropic, and Gemini adapters perform real HTTP calls only when the
  corresponding provider is selected and its key is present. Their advisory
  classification output is parsed by a strict Zod schema that has no numeric
  effect or causal-link fields. Authoritative effects are derived from the
  proposal and grounded world context using
  `@kawkab/simulation-models` `SeededRandom`, then checked against reference and
  impact budgets. `/health` reports configuration and
  `connectivity: "not_checked"`; startup does not claim vendor connectivity.

## Security model

- JWTs are short-lived auth sessions backed by revocable `auth_sessions` rows
  and sent in an `HttpOnly`, `SameSite=Strict` cookie. Bearer JWTs are also
  accepted.
- Sandbox account creation is unavailable in production. Any role above `user`
  additionally requires `x-sandbox-admin-key`.
- Pause/resume/rollback accepts `simulation_manager`, `admin`, `system_admin`,
  or `super_admin`.
- CORS allowlisting, CSP headers, request/body limits, endpoint rate limits,
  origin checks, Zod input validation, prompt-injection checks, and structured
  AI-output validation are enabled.
- Passwords use Node's scrypt with a random per-password salt. Production should
  terminate TLS at the ingress; cookies become `Secure` in production mode.

## Persistence and rollback

`src/db/migrations/0001_planet_foundation.sql` creates all simulation, auth,
AI, moderation, notification, and audit tables. `pgcrypto` supplies UUID
defaults. PostGIS and pgvector are attempted in guarded blocks because many
managed PostgreSQL roles cannot install them; portable latitude/longitude and
JSONB data remain usable. Add spatial `geography` and vector/HNSW columns in an
operator-controlled online migration after confirming extension availability.

Contribution commit locks the planet and writes the contribution, simulation
tick, event, causal links, snapshot, notification, and updated planet metrics in
one PostgreSQL transaction. The `(user_id, planet_id, idempotency_key)` key
prevents duplicate commits. Rollback restores snapshot metrics, pauses the
planet, marks later ticks rolled back, retracts later events, and writes an audit
record. Snapshots intentionally capture simulation state, not user/auth data.

## Main routes

- `GET /health`
- `POST /auth/sandbox`, `POST|DELETE /auth/session`, `GET /auth/me`
- `GET /world/summary|regions|events|timeline`
- `POST /contribution/analyze|preview|commit`
- `POST /admin/ticks/pause|resume`
- `POST /admin/snapshots/rollback`
- `GET /ws` (authenticated WebSocket delta stream)
