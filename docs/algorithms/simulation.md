# Simulation Algorithms

## Determinism

`SeededRng` (xorshift / hash-derived) ensures:

- same planet seed → same terrain & biome map
- same event stream replay → same state

Tests in `services/simulation-engine/tests/test_determinism.py` lock this contract.

## World generation

1. Fractal / value noise → height map  
2. Moisture & temperature fields from latitude + elevation + noise  
3. Biome classification rules (ocean → ice continuum)  
4. Civilization & resource placement on viable land cells  

## Climate

Grid / cellular-automata style updates for moisture diffusion, storm intensity, pollution spread, drought stress. Changes require drivers (emissions, volcanoes, vegetation), not pure noise.

## Ecosystem

Species carry numeric traits. Population updates use Lotka–Volterra-inspired discrete steps, carrying capacity from biome fertility, and extinction thresholds.

## Civilizations

Utility-AI style scoring for expand / trade / ally / war / research. Memory JSON stores prior attacks/alliances influencing future scores.

## Economy & paths

Resources have quantity, regen, value, environmental impact. Trade routes use graph distance (Dijkstra / NetworkX) with risk weights.

## Conflict

War probability is a weighted function of resource contention, proximity, military balance, hunger, aggression, alliances — not a coin flip.

## Causal graph

Contribution → direct deltas → secondary effects → long-horizon events. Edges store relation + weight for UI explanation.

## Monte Carlo foresight

Multiple seeded branches for horizons (1 / 10 / 100 / 1000 years) produce most-likely / best / worst with uncertainty score.
