# planet-world-generator

Thin FastAPI world generation service.

- `GET /generate?seed=alpha&rows=12&cols=24`
- `POST /generate` with `{ "seed": "alpha", "resolution": [12, 24] }`

By default it returns a deterministic lightweight noise map suitable for admin previews and smoke tests. Set `WORLD_GENERATOR_MODE=proxy` and `SIMULATION_URL=http://simulation:8001` to forward POST generation requests to the simulation engine `/world/generate` endpoint.
