# Simulation Algorithms

## Procedural planet

- Fractal value noise (fBm) for elevation, moisture, temperature.
- Biome classification from elevation × moisture × latitude.
- Deterministic placement of civilizations, cities, resources, species, plants, technologies.

## Ecology

- Discrete Lotka–Volterra-inspired growth with carrying capacity.
- Food-web links (predator/prey arrays).
- Extinction when population collapses.

## Civilizations (Utility AI)

Per tick, each civilization scores: expand, trade, research, war, ally.
Actions use Dijkstra paths over the region graph for migration/trade/army logistics.
Wars require rivalry factors (resources, hostility memory, aggression) — not pure randomness.

## Economy

Trade routes created along lowest-cost paths; value updates economy stats.
Resources carry quantity, renewal, value, and environmental impact.

## Causal graph

`addition → direct effects → secondary → long-term` edges with magnitudes derived from algorithmic deltas.

## Monte Carlo forecast

Multiple seeded forks advance N years; scenarios expose most-likely / best / worst with uncertainty.
