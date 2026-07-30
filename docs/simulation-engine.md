# Simulation engine

## Role

The simulation engine is the **source of truth** for planetary time. The API persists what the engine returns; the UI never advances world state on its own.

## Ticks

A tick advances one discrete step (default year-equivalent in models). Pipeline order:

1. Climate CA diffusion (temp / moisture / pollution)
2. Ecology Lotka–Volterra + food web
3. Market price discovery
4. Trade path updates (Dijkstra)
5. Civilization decisions + wars
6. Append events, update snapshot

API entry points:

- `POST /planets/:id/tick` (role `sim_manager+`)
- `POST /admin/simulation/tick` (admin / sim_manager)
- Python: `POST /simulate/ticks`

Planet rows track `currentTick`, `ageYears`, and `status` (`active` | `paused`).

## Event sourcing

Each tick appends:

- `simulation_ticks` — tick index, year, delta summary
- `world_events` — typed events with severity, actors, payload
- `causal_links` — cause → effect edges when available

Rebuild (`POST /simulate/rebuild`) resets from seed and replays injections for bit-identical state (Python engine determinism tests).

## Snapshots

`timeline_snapshots` store labeled state JSON at a tick. Admin rollback:

`POST /admin/snapshots/:id/rollback` → sets planet tick/year from snapshot metadata and publishes `planet.rollback`.

## Pause / resume

Admin:

- `POST /admin/simulation/pause` `{ planetId? }`
- `POST /admin/simulation/resume` `{ planetId? }`

Paused planets reject tick advances with HTTP 409.

## Determinism contract

Same `(seed, resolution, injection sequence, tick count)` ⇒ identical grids, populations, markets, and causal causes.

Verified by `services/simulation-engine/tests/test_determinism.py` and TS tests under `packages/simulation-models`.

## Fallbacks

If the Python service is unreachable, the API tries `@planet/simulation-models`, then `local-sim` — still deterministic, but feature-reduced.

## Related

- [algorithms.md](./algorithms.md)
- [architecture.md](./architecture.md)
