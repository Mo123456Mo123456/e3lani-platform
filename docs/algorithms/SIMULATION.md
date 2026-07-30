# Simulation Engine

Package: `@planet-born/simulation-models`

## Core pieces

| Module | Role |
|---|---|
| `rng.ts` | Mulberry32 seeded PRNG + forks |
| `world-generator.ts` | FBM height/moisture/temperature → biomes + rivers |
| `climate.ts` | Neighbor diffusion CA for temp/moisture/pollution/storms |
| `ecology.ts` | Lotka–Volterra-inspired populations, mutations, extinctions |
| `civilizations.ts` | Utility AI decisions (expand/trade/ally/war/research) |
| `economy.ts` | Resources + Dijkstra trade paths |
| `causal-graph.ts` | Forward/backward causal traversal |
| `balance.ts` | Clamp god-mode traits |
| `engine.ts` | World state, ticks, contributions, Monte Carlo futures |

## Tick loop

1. Advance tick/year  
2. Optional volcano (seeded chance)  
3. Climate step (emissions from civ pollution)  
4. Plant absorption / growth  
5. Species populations + food web  
6. Resource economy  
7. Civilization Utility AI actions → events  
8. Climate extremes → events  

Every event is appended with `causeIds` when linked to a contribution.

## Determinism contract

`serializeWorldState(stepSimulation(createInitialWorld(seed), n))` is identical across runs.

## Demo seed density

Default `createInitialWorld` targets:

- 12 civilizations  
- 40 cities  
- 120 resources  
- 300 species  
- 800 plants  
- 50 technologies  
- milestone timeline + bootstrap ticks  
