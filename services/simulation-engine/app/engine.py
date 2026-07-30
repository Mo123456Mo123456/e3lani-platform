from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import causal, climate, civilizations, conflict, economy, ecosystem, monte_carlo, world_generator
from .config import DEFAULT_RESOLUTION, MAX_RESOLUTION, SNAPSHOT_DIR
from .events import EventType, SimulationEvent, make_event
from .models import (
    ContributionRecord,
    PlanetState,
    SnapshotRecord,
    StructuredElement,
)
from .world_generator import planet_id_for


class SimulationEngine:
    def __init__(self, snapshot_dir: Path = SNAPSHOT_DIR) -> None:
        self.snapshot_dir = snapshot_dir
        self.planets: dict[str, PlanetState] = {}
        self.aliases: dict[str, str] = {}
        self.seed_index: dict[str, str] = {}

    def generate_world(
        self,
        seed: str,
        resolution: tuple[int, int] | None = None,
        external_planet_id: str | None = None,
    ) -> PlanetState:
        resolution = resolution or DEFAULT_RESOLUTION
        rows, cols = validate_resolution(resolution)
        planet_id = planet_id_for(seed, (rows, cols))
        if seed in self.seed_index and self.seed_index[seed] in self.planets:
            state = self.planets[self.seed_index[seed]]
            if external_planet_id:
                self.aliases[external_planet_id] = state.planet_id
            return state
        regions = world_generator.generate_regions(seed, (rows, cols))
        state = PlanetState(
            planet_id=planet_id,
            seed=seed,
            resolution=(rows, cols),
            regions=regions,
            resources=world_generator.summarize_resources(regions),
        )
        state.species, species_events = ecosystem.seed_ecosystem(planet_id, seed, state.regions)
        civs, cities, civ_events = civilizations.seed_civilizations(planet_id, seed, state.regions)
        state.civilizations = civs
        state.cities = cities
        state.events.extend(species_events)
        state.events.extend(civ_events)
        trade_events = economy.initialize_trade(state)
        state.events.extend(trade_events)
        self.update_metrics(state)
        self.planets[planet_id] = state
        self.seed_index[seed] = planet_id
        if external_planet_id:
            self.aliases[external_planet_id] = planet_id
        self.create_snapshot(planet_id, "generated")
        return state

    def ensure_world(
        self,
        seed: str,
        planet_id: str | None = None,
        resolution: tuple[int, int] | None = None,
    ) -> PlanetState:
        if planet_id and planet_id in self.aliases:
            return self.get_state(self.aliases[planet_id])
        if planet_id and planet_id in self.planets:
            return self.get_state(planet_id)
        if seed in self.seed_index:
            state = self.get_state(self.seed_index[seed])
            if planet_id:
                self.aliases[planet_id] = state.planet_id
            return state
        return self.generate_world(seed, resolution, external_planet_id=planet_id)

    def resolve_planet_id(self, planet_id: str, seed: str | None = None) -> str:
        if planet_id in self.planets:
            return planet_id
        if planet_id in self.aliases:
            return self.aliases[planet_id]
        if seed and seed in self.seed_index:
            resolved = self.seed_index[seed]
            self.aliases[planet_id] = resolved
            return resolved
        if seed:
            state = self.ensure_world(seed, planet_id=planet_id)
            return state.planet_id
        loaded = self.load_latest_snapshot(planet_id)
        if loaded is not None:
            self.planets[planet_id] = loaded
            return planet_id
        raise KeyError(f"unknown planet_id: {planet_id}")

    def get_state(self, planet_id: str, seed: str | None = None) -> PlanetState:
        resolved = self.resolve_planet_id(planet_id, seed=seed)
        if resolved not in self.planets:
            loaded = self.load_latest_snapshot(resolved)
            if loaded is None:
                raise KeyError(f"unknown planet_id: {planet_id}")
            self.planets[resolved] = loaded
        return self.planets[resolved]

    def resolve_region_id(
        self,
        state: PlanetState,
        region_id: str | None,
        *,
        lat: float | None = None,
        lon: float | None = None,
        grid_x: int | None = None,
        grid_y: int | None = None,
    ) -> str:
        if region_id and region_id in state.regions:
            return region_id
        if grid_x is not None and grid_y is not None:
            for region in state.regions.values():
                if region.x == grid_x and region.y == grid_y:
                    return region.id
        if lat is not None and lon is not None:
            # Map lat/lon to approximate grid cell
            rows, cols = state.resolution
            y = int(round(((lat + 90.0) / 180.0) * (rows - 1)))
            x = int(round(((lon + 180.0) / 360.0) * (cols - 1)))
            y = max(0, min(rows - 1, y))
            x = max(0, min(cols - 1, x))
            for region in state.regions.values():
                if region.x == x and region.y == y:
                    return region.id
            # nearest land-ish cell
            best = min(
                state.regions.values(),
                key=lambda r: (r.x - x) ** 2 + (r.y - y) ** 2,
            )
            return best.id
        # Prefer a fertile non-ocean region
        land = [r for r in state.regions.values() if r.biome != "ocean"]
        pool = land or list(state.regions.values())
        if not pool:
            raise KeyError("planet has no regions")
        return max(pool, key=lambda r: r.fertility).id

    def simulate_ticks(
        self, planet_id: str, ticks: int = 1, unit: str = "year", seed: str | None = None
    ) -> PlanetState:
        state = self.get_state(planet_id, seed=seed)
        for _ in range(ticks):
            self.advance_one_tick(state, unit)
        self.create_snapshot(state.planet_id, f"tick-{state.tick}")
        return state

    def advance_one_tick(self, state: PlanetState, unit: str = "year") -> list[SimulationEvent]:
        state.tick += 1
        emitted: list[SimulationEvent] = []
        emitted.extend(climate.advance_climate(state, len(state.events) + len(emitted)))
        emitted.extend(ecosystem.advance_ecosystem(state, len(state.events) + len(emitted)))
        emitted.extend(civilizations.advance_civilizations(state, len(state.events) + len(emitted)))
        emitted.extend(economy.update_economy(state, len(state.events) + len(emitted)))
        emitted.extend(conflict.evaluate_conflicts(state, len(state.events) + len(emitted)))
        self.update_metrics(state)
        emitted.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.TICK_COMPLETED,
                "engine_tick_loop",
                None,
                1.0,
                {"tick": float(state.tick)},
                {
                    "mean_pollution": state.metrics.get("mean_pollution", 0.0),
                    "total_population": state.metrics.get("total_population", 0.0),
                },
                len(state.events) + len(emitted),
                {"en": "Tick completed", "ar": "اكتمال دورة"},
                {"unit": unit},
            )
        )
        state.events.extend(emitted)
        return emitted

    def apply_contribution(
        self,
        planet_id: str,
        element: StructuredElement,
        region_id: str | None,
        user_id: str,
        *,
        seed: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        grid_x: int | None = None,
        grid_y: int | None = None,
    ) -> tuple[ContributionRecord, PlanetState]:
        state = self.get_state(planet_id, seed=seed)
        resolved_region = self.resolve_region_id(
            state,
            region_id,
            lat=lat,
            lon=lon,
            grid_x=grid_x,
            grid_y=grid_y,
        )
        record, events = causal.apply_contribution(
            state, element, resolved_region, user_id, len(state.events)
        )
        state.events.extend(events)
        self.update_metrics(state)
        self.create_snapshot(state.planet_id, f"contribution-{record.id}")
        return record, state

    def forecast(
        self,
        planet_id: str,
        contribution_id: str | None = None,
        horizons: list[int] | None = None,
        seed: str | None = None,
    ) -> dict[str, Any]:
        state = self.get_state(planet_id, seed=seed)
        return monte_carlo.forecast(state, contribution_id, horizons)

    def rollback(self, planet_id: str, snapshot_id: str, seed: str | None = None) -> PlanetState:
        resolved = self.resolve_planet_id(planet_id, seed=seed)
        snapshot_path = self.snapshot_dir / resolved / f"{snapshot_id}.json"
        if not snapshot_path.exists():
            raise KeyError(f"unknown snapshot_id: {snapshot_id}")
        data = snapshot_path.read_text(encoding="utf-8")
        state = PlanetState.model_validate_json(data)
        self.planets[resolved] = state
        self.create_snapshot(resolved, f"rollback-{snapshot_id}")
        return state

    def create_snapshot(self, planet_id: str, reason: str) -> SnapshotRecord:
        state = self.get_state(planet_id)
        safe_reason = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in reason)[:80]
        snapshot_id = f"snap-{state.tick}-{safe_reason}"
        planet_dir = self.snapshot_dir / planet_id
        planet_dir.mkdir(parents=True, exist_ok=True)
        path = planet_dir / f"{snapshot_id}.json"
        record = SnapshotRecord(id=snapshot_id, tick=state.tick, path=str(path))
        state.snapshots[snapshot_id] = record
        path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        return record

    def load_latest_snapshot(self, planet_id: str) -> PlanetState | None:
        planet_dir = self.snapshot_dir / planet_id
        if not planet_dir.exists():
            return None
        snapshots = sorted(planet_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not snapshots:
            return None
        return PlanetState.model_validate_json(snapshots[0].read_text(encoding="utf-8"))

    def update_metrics(self, state: PlanetState) -> None:
        regions = state.regions.values()
        civs = state.civilizations.values()
        species = state.species.values()
        region_count = max(1, len(state.regions))
        civ_count = max(1, len(state.civilizations))
        state.metrics.update(
            {
                "mean_height": round(sum(r.height for r in regions) / region_count, 6),
                "mean_moisture": round(sum(r.moisture for r in state.regions.values()) / region_count, 6),
                "mean_temperature": round(sum(r.temperature for r in state.regions.values()) / region_count, 6),
                "mean_fertility": round(sum(r.fertility for r in state.regions.values()) / region_count, 6),
                "mean_pollution": round(sum(r.pollution for r in state.regions.values()) / region_count, 6),
                "total_population": round(sum(c.population for c in civs), 6),
                "mean_technology": round(sum(c.technology for c in state.civilizations.values()) / civ_count, 6),
                "living_species": float(sum(1 for sp in species if sp.population > 0)),
                "city_count": float(len(state.cities)),
                "civilization_count": float(len(state.civilizations)),
            }
        )


def validate_resolution(resolution: tuple[int, int]) -> tuple[int, int]:
    rows, cols = int(resolution[0]), int(resolution[1])
    if rows < 12 or cols < 24:
        raise ValueError("resolution must be at least 12x24")
    if rows > MAX_RESOLUTION[0] or cols > MAX_RESOLUTION[1]:
        raise ValueError(f"resolution must be at most {MAX_RESOLUTION[0]}x{MAX_RESOLUTION[1]}")
    return rows, cols


engine = SimulationEngine()

