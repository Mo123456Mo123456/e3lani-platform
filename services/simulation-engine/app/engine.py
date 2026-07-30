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

    def generate_world(self, seed: str, resolution: tuple[int, int] | None = None) -> PlanetState:
        resolution = resolution or DEFAULT_RESOLUTION
        rows, cols = validate_resolution(resolution)
        planet_id = planet_id_for(seed, (rows, cols))
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
        self.create_snapshot(planet_id, "generated")
        return state

    def get_state(self, planet_id: str) -> PlanetState:
        if planet_id not in self.planets:
            loaded = self.load_latest_snapshot(planet_id)
            if loaded is None:
                raise KeyError(f"unknown planet_id: {planet_id}")
            self.planets[planet_id] = loaded
        return self.planets[planet_id]

    def simulate_ticks(self, planet_id: str, ticks: int = 1, unit: str = "year") -> PlanetState:
        state = self.get_state(planet_id)
        for _ in range(ticks):
            self.advance_one_tick(state, unit)
        self.create_snapshot(planet_id, f"tick-{state.tick}")
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
        self, planet_id: str, element: StructuredElement, region_id: str, user_id: str
    ) -> tuple[ContributionRecord, PlanetState]:
        state = self.get_state(planet_id)
        record, events = causal.apply_contribution(state, element, region_id, user_id, len(state.events))
        state.events.extend(events)
        self.update_metrics(state)
        self.create_snapshot(planet_id, f"contribution-{record.id}")
        return record, state

    def forecast(
        self, planet_id: str, contribution_id: str | None = None, horizons: list[int] | None = None
    ) -> dict[str, Any]:
        state = self.get_state(planet_id)
        return monte_carlo.forecast(state, contribution_id, horizons)

    def rollback(self, planet_id: str, snapshot_id: str) -> PlanetState:
        snapshot_path = self.snapshot_dir / planet_id / f"{snapshot_id}.json"
        if not snapshot_path.exists():
            raise KeyError(f"unknown snapshot_id: {snapshot_id}")
        data = snapshot_path.read_text(encoding="utf-8")
        state = PlanetState.model_validate_json(data)
        self.planets[planet_id] = state
        self.create_snapshot(planet_id, f"rollback-{snapshot_id}")
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

