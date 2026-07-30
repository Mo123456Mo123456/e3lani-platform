# Simulation Engine

Package: `@planet/simulation-core`

## Pipeline

1. `generatePlanet(seed)` — FBM height/moisture/temperature, Worley ridges, river approximation, biome classification, region sampling.
2. `SimulationEngine.bootstrapInitialWorld` — 12 civilizations, 36+ cities, 300 species, 800 plants, 120 resources, 50 technologies (configurable).
3. Each `tick(years)`:
   - Climate drift
   - Ecology (plant growth, Lotka–Volterra-inspired predator/prey)
   - Civilization Utility AI (research / expand / war / ally / migrate / trade)
   - War resolution (terrain, supply, morale proxies, border transfer)
   - Economy (resource renewal/depletion, trade routes via Dijkstra)
   - Disease spread
4. Events appended to `EventStore` with **cause** + optional causal edges.
5. Snapshots every 10 ticks; `rollbackTo(tick)` restores state + RNG.

## User contributions

`applyContribution(structured, regionId, contributionId)`:

- Emits `USER_CONTRIBUTION` root event
- Creates entity (plant/species/civ/resource/…)
- Emits typed follow-up events with causal links (e.g. water stress from thirsty plants)
- Persisted by API into PostgreSQL

## Future projection

`projectFuture([1,10,100,1000], samples)` — Monte Carlo by forking RNG, running bounded ticks, reporting best / worst / median + uncertainty. Always labeled probabilistic.

## Key invariants (tested)

- Same seed ⇒ same history
- Rollback restores snapshot
- Civilizations always have population & cities at bootstrap
- Every event has a non-null `cause`
- Overpowered free-text patterns are balanced/capped
- Populations do not explode unboundedly past soft carrying capacity
