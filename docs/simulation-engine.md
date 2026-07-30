# Simulation Engine

## Tick model

Each tick advances climate, ecosystem, economy, civilizations (utility AI), wars (cause-scored), migrations (graph-constrained), diseases, and contribution echoes.

Tick units: `day | month | year | decade`.

## Determinism

- `SeededRandom` (Mulberry32) with forkable state
- World hash via FNV-1a over authoritative fields
- Replaying `advanceTick(base, n)` twice yields identical hashes

## World generation

Procedural from seed:

- Fractal/Perlin-like height, moisture, temperature
- Worley perturbation
- Biome classification from elevation/temp/moisture/latitude
- Neighbor graph for CA-style spread & pathfinding

Demo targets: 12 civilizations, 40 cities, 120 resources, 300 species, 800 plants, 50 technologies.

## Causal graph

Events carry `causes` and `effects`. Contribution echoes create `CausalEdge` links (`led_to`, `long_term_effect`).

## Wars

Never random-only. Score from proximity, resources, food, historical memory, aggression, military balance. Require at least one cause string.

## Migrations

Only across land neighbor edges (oceans blocked unless explicitly allowed).

## Tests

See `packages/simulation-models/src/simulation.test.ts`.
