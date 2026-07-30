# كوكب يولد أمامك — Simulation Engine

Deterministic planetary tick engine for the **كوكب يولد أمامك** platform.

## Run

```bash
python3 -m pip install --user -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8001
python3 -m pytest -q
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/simulate/ticks` | Create/advance planet N ticks |
| POST | `/simulate/inject` | Inject a user element into a planet |
| POST | `/simulate/forecast` | Monte Carlo forecast (non-mutating) |
| POST | `/simulate/rebuild` | Replay seed + injections → identical state |
| GET | `/simulate/state/{planet_id}` | Snapshot + causal graph + event log |

## Algorithms

### Seeded RNG (`rng.py`)
xorshift64* PRNG. Subsystems call `derive(label)` so ecology, climate, civs, and trade get independent but fully reproducible streams from the same planet seed.

### Terrain noise (`noise.py`)
Hashed-lattice **value noise** with quintic fade, stacked as **fractional Brownian motion** (FBM). Produces simplex-like elevation / temperature / moisture fields without external noise libraries.

### World generation (`world.py`)
From seed → elevation, temperature (with latitude bias), moisture → biome classification (ocean/coast/plains/forest/desert/tundra/mountain/swamp). Seeds baseline Lotka–Volterra species pools, 2–4 civilizations, and commodity markets.

### Ecology (`ecology.py`)
Discrete Lotka–Volterra step across producers → herbivores → carnivores, with decomposer recycling. Pollution penalizes growth; injected element traits (`fertility`, `toxicity`, `predation`) modulate rates. Every change emits a **caused** event.

### Climate (`climate.py`)
4-neighbor **cellular automata diffusion** on temperature, moisture, and pollution (toroidal). Industry adds pollution; greenhouse / cleanup / aridity traits from injections apply; rare seeded storms; pollution crisis events above threshold.

### Civilizations (`civilization.py`)
Agents choose among expand / fortify / trade / war via utility scores (food, security, growth, aggression). Softmax-biased stochastic pick using the seeded RNG. Pairwise **war probability** is a sigmoid of aggression, wealth gap, pollution, and distance.

### Economy (`economy.py`)
Supply/demand price discovery for food/energy/materials. **Dijkstra** finds least-cost trade paths with biome and pollution edge weights.

### Causal graph (`causal.py`)
Every event **must** include a non-empty `cause`. Rebuild and audits reject causeless events. Nodes are content-hashed for stable IDs.

### Tick engine (`engine.py`)
- **Event sourcing**: append-only log per planet
- **Snapshots**: full state after each tick
- **Inject element**: records user intervention as a caused event
- **run_ticks**: climate → ecology → markets → trade → civs
- **rebuild**: reset from seed, re-apply injections at original ticks, replay
- **forecast**: Monte Carlo branches with sample-indexed RNG; does not mutate live state

## Determinism contract

Same `(seed, width, height, injection sequence, tick count)` ⇒ identical grids, species, civs, markets, and causal causes. Verified by `tests/test_determinism.py`.
