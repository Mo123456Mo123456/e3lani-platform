# Simulation engine / محرك المحاكاة

## World generation

`generateWorld(seed)` creates a 48×24 spherical grid. The same seed produces the
same region UUIDs and values. Elevation combines six-octave fractal value noise
with Worley plate ridges. Climate derives from latitude, elevation, ocean
distance, prevailing-wind rain shadow, moisture noise, and surface water.
Biome classification then uses those computed values; it is not a painted
texture.

The WebGL client receives this grid as a compact GPU data texture. Its shader
uses the actual elevation, temperature, moisture, and biome code to displace and
shade the sphere. Event markers also use region coordinates from the event
store.

## Tick model

Each tick currently represents one year. For every tick:

1. The random stream is forked from `worldSeed:tick:n`.
2. Moisture diffuses to adjacent climate cells.
3. Emissions, vegetation absorption, and volcanic pulses update pollution.
4. Pollution, vegetation, and volcanism update local temperature.
5. Rainfall, water, and vegetation converge toward physical carrying values.
6. Species use habitat suitability and logistic growth.
7. Civilizations use food, regional carrying capacity, stability, innovation,
   technology, and pollution to update population and state.
8. Threshold crossings append explicit domain events.
9. `TICK_COMPLETED` records the replayable state patch.

No wall clock or unseeded random number participates in a result.

## Causality and replay

Events contain cause text, actors, region, simulated year, confidence, direct
impact, root contribution, and parent event IDs. Parent relationships are
stored in `causal_links`. `replayEvents` applies contribution and tick patches
to a known snapshot; tests verify equality with the original computed state.

Snapshots are currently written after every mutation for simple and exact
rollback. A later high-throughput deployment can retain all events while
compacting snapshots to an interval.

## Contributions and forecasts

Provider output is parsed through `contributionAnalysisSchema`. The engine
calculates biome fit and the immediate vegetation, pollution, and surface-water
effects. The language model does not calculate those values.

`forecastContribution` runs 64 deterministic Monte Carlo branches for 1, 10,
100, and 1,000 years. Each response reports median, 10th/90th percentile
outcomes, uncertainty width, and influential factors. These are scenarios, not
guaranteed predictions.

## Current scientific scope

Implemented: procedural terrain/climate/biomes, cellular climate diffusion,
population carrying capacity, habitat suitability, civilization growth,
event sourcing, replay, contribution causality, and scenarios.

Not yet active: explicit river path routing, Lotka–Volterra predator matrices,
GOAP civilization actions, A* trade/migration routing, borders, war resolution,
disease spread, and plate movement. Their database models and event contracts
exist, but the UI labels unavailable layers as pending.
