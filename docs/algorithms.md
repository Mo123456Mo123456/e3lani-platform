# Algorithms overview

Implementations live in `packages/simulation-models` (TypeScript) and `services/simulation-engine` (Python). Both aim for the same contracts; prefer the Python engine for production ticks and the TS package for unit tests / API fallback.

## Noise & terrain

- **Seeded RNG** — xorshift / Mulberry-style streams; subsystems `derive(label)` for independent reproducible channels.
- **Value / simplex-style noise** with quintic fade; stacked as **fBm**, **ridged**, and **Worley** (`noise.ts` / `noise.py`).
- **World generator** maps elevation + latitude-biased temperature + moisture → biome IDs (ocean, coast, plains, forest, desert, tundra, mountain, swamp, …).

## Biomes

`classifyBiome` thresholds on elev/temp/moisture. Habitability and carrying-capacity tables bias ecology and settlement.

## Ecology (Lotka–Volterra)

Discrete multi-trophic step:

\[
\frac{dN}{dt} = r N \big(1 - \frac{N}{K}\big) - P
\]

- \(K\) from habitat suitability × biome base capacity × resources.
- Predation pressure from food-web edges.
- User injections can modulate fertility, toxicity, predation.
- Extinction / bloom events are emitted into the causal log.

## Civilization utility AI

Actions: `expand | trade | alliance | war | research | migrate`.

Each action gets a utility score from food pressure, expansionism, diplomacy, economy, tech gap, and neighbor relations. Choice is softmax-biased with the seeded RNG (`chooseAction`).

## War probability

Sigmoid of aggression, resource conflict, military balance, war history, and pollution/distance terms (`warProbability`). Combat resolves casualties and outcomes via `resolveWar`.

## Dijkstra trade

Region graph with edge costs (biome difficulty, pollution). `tradeRouteCost` runs Dijkstra for least-cost paths; markets update prices from supply/demand (`priceFromSupplyDemand`).

## Causal graph

Directed multigraph of events/effects with edge types: `causes | enables | amplifies | inhibits | triggers`. Paths can be explained for timeline UI. Sim contract: events should carry non-empty causes when produced by the Python engine.

## Monte Carlo forecast

Non-mutating branches: sample-indexed RNG forks run N years; aggregate **mostLikely / best / worst** scenarios with uncertainty (`ForecastResult` in shared-types). Exposed on sim as `POST /simulate/forecast`.

## Balance

`balanceUserElement` clamps overpowered traits into \([0,1]\) ranges and proposes alternatives before injection.

## Further reading

- Package entry: `packages/simulation-models/src/index.ts`
- Engine README: `services/simulation-engine/README.md`
- Tick lifecycle: [simulation-engine.md](./simulation-engine.md)
