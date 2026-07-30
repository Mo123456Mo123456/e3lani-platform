"""Tick engine: event sourcing, snapshots, injection, forecast."""

from __future__ import annotations

import copy
from typing import Any

import numpy as np

from .causal import CausalGraph
from .civilization import step_civilizations
from .climate import step_climate
from .ecology import step_ecology
from .economy import step_trade_routes, update_markets
from .rng import SeededRNG
from .world import PlanetWorld, generate_world


class TickEngine:
    """Deterministic planetary simulation with event-sourced history."""

    def __init__(self) -> None:
        self.worlds: dict[str, PlanetWorld] = {}
        self.graphs: dict[str, CausalGraph] = {}
        self.event_logs: dict[str, list[dict[str, Any]]] = {}
        self.snapshots: dict[str, dict[int, dict[str, Any]]] = {}

    def create_or_get(
        self,
        planet_id: str,
        seed: int,
        width: int = 32,
        height: int = 32,
    ) -> PlanetWorld:
        if planet_id not in self.worlds:
            world = generate_world(planet_id, seed, width=width, height=height)
            self.worlds[planet_id] = world
            self.graphs[planet_id] = CausalGraph()
            self.event_logs[planet_id] = []
            self.snapshots[planet_id] = {0: world.snapshot()}
            self.graphs[planet_id].add(
                tick=0,
                event_type="world.created",
                cause=f"seed:{seed}",
                effect={"planet_id": planet_id, "width": width, "height": height},
            )
        return self.worlds[planet_id]

    def inject_element(self, planet_id: str, element: dict[str, Any]) -> dict[str, Any]:
        world = self.worlds.get(planet_id)
        if world is None:
            raise KeyError(f"Unknown planet_id: {planet_id}")
        payload = {
            "name": element.get("name", "unnamed"),
            "category": element.get("category", "unknown"),
            "traits": dict(element.get("traits") or {}),
            "possibleBiomes": list(element.get("possibleBiomes") or []),
            "risks": list(element.get("risks") or []),
            "tick_injected": world.tick,
        }
        world.injected.append(payload)
        node = self.graphs[planet_id].add(
            tick=world.tick,
            event_type="element.injected",
            cause=f"user_inject:{payload['name']}",
            effect=payload,
        )
        record = {
            "tick": world.tick,
            "type": "element.injected",
            "cause": f"user_inject:{payload['name']}",
            "effect": payload,
            "event_id": node.event_id,
        }
        self.event_logs[planet_id].append(record)
        return record

    def _active_injections(self, world: PlanetWorld) -> list[dict[str, Any]]:
        return list(world.injected)

    def run_ticks(self, planet_id: str, n: int = 1) -> dict[str, Any]:
        world = self.worlds.get(planet_id)
        if world is None:
            raise KeyError(f"Unknown planet_id: {planet_id}")
        graph = self.graphs[planet_id]
        tick_events: list[dict[str, Any]] = []

        for _ in range(max(0, n)):
            next_tick = world.tick + 1
            rng = SeededRNG(f"{world.seed}:tick:{next_tick}")
            injections = self._active_injections(world)
            parent_ids: list[str] = []

            # Climate
            industrial = sum(float(c.get("population", 0)) for c in world.civs) * 0.001
            temp, moist, poll, climate_events = step_climate(
                world.temperature,
                world.moisture,
                world.pollution,
                industrial_output=industrial,
                injected_traits=injections,
                rng=rng.derive("climate"),
            )
            world.temperature, world.moisture, world.pollution = temp, moist, poll
            ids = graph.ingest_events(next_tick, climate_events, parent_ids)
            parent_ids.extend(ids)
            tick_events.extend(climate_events)

            # Ecology
            new_species, eco_events = step_ecology(
                world.species,
                pollution_mean=float(np.mean(world.pollution)),
                moisture_mean=float(np.mean(world.moisture)),
                injected_traits=injections,
                rng=rng.derive("ecology"),
            )
            world.species = new_species
            ids = graph.ingest_events(next_tick, eco_events, parent_ids)
            parent_ids.extend(ids)
            tick_events.extend(eco_events)

            # Economy
            pop_total = sum(float(c.get("population", 0)) for c in world.civs)
            markets, market_events = update_markets(
                world.markets,
                producers=float(world.species.get("producers", 0)),
                population_total=pop_total,
                injected_traits=injections,
            )
            world.markets = markets
            ids = graph.ingest_events(next_tick, market_events, parent_ids)
            parent_ids.extend(ids)
            tick_events.extend(market_events)

            trade_events = step_trade_routes(
                world.civs,
                width=world.width,
                height=world.height,
                pollution=world.pollution,
                biomes=world.biomes,
                rng=rng.derive("trade"),
            )
            ids = graph.ingest_events(next_tick, trade_events, parent_ids)
            parent_ids.extend(ids)
            tick_events.extend(trade_events)

            # Civilizations
            civs, civ_events = step_civilizations(
                world.civs,
                markets=world.markets,
                pollution_mean=float(np.mean(world.pollution)),
                herbivores=float(world.species.get("herbivores", 0)),
                injected_traits=injections,
                rng=rng.derive("civ"),
            )
            world.civs = civs
            ids = graph.ingest_events(next_tick, civ_events, parent_ids)
            parent_ids.extend(ids)
            tick_events.extend(civ_events)

            # Tick marker
            tick_node = graph.add(
                tick=next_tick,
                event_type="tick.completed",
                cause=f"tick_engine:{next_tick}",
                effect={"event_count": len(tick_events)},
                parents=parent_ids,
            )
            world.tick = next_tick
            self.snapshots[planet_id][next_tick] = world.snapshot()
            batch = climate_events + eco_events + market_events + trade_events + civ_events
            for ev in batch:
                self.event_logs[planet_id].append({"tick": next_tick, **ev})
            self.event_logs[planet_id].append(
                {
                    "tick": next_tick,
                    "type": "tick.completed",
                    "cause": f"tick_engine:{next_tick}",
                    "effect": {"event_count": len(batch)},
                    "event_id": tick_node.event_id,
                }
            )
            tick_events.clear()

        return {
            "planet_id": planet_id,
            "tick": world.tick,
            "summary": world.summary(),
            "events": [e for e in self.event_logs[planet_id] if e.get("tick") == world.tick],
        }

    def get_state(self, planet_id: str) -> dict[str, Any]:
        world = self.worlds.get(planet_id)
        if world is None:
            raise KeyError(f"Unknown planet_id: {planet_id}")
        return {
            "summary": world.summary(),
            "snapshot": world.snapshot(),
            "causal": self.graphs[planet_id].to_list(),
            "events": list(self.event_logs[planet_id]),
        }

    def rebuild(self, planet_id: str, seed: int, width: int = 32, height: int = 32) -> dict[str, Any]:
        """Replay from seed + injection log to rebuild identical state."""
        existing_log = list(self.event_logs.get(planet_id, []))
        injections = [
            e["effect"]
            for e in existing_log
            if e.get("type") == "element.injected"
        ]
        target_tick = self.worlds[planet_id].tick if planet_id in self.worlds else 0

        # Reset
        self.worlds.pop(planet_id, None)
        self.graphs.pop(planet_id, None)
        self.event_logs.pop(planet_id, None)
        self.snapshots.pop(planet_id, None)

        self.create_or_get(planet_id, seed, width=width, height=height)
        # Re-apply injections at their original ticks by stepping
        inj_by_tick: dict[int, list[dict[str, Any]]] = {}
        for inj in injections:
            t = int(inj.get("tick_injected", 0))
            inj_by_tick.setdefault(t, []).append(inj)

        for t in range(0, target_tick + 1):
            for inj in inj_by_tick.get(t, []):
                # strip meta before re-inject
                element = {
                    "name": inj.get("name"),
                    "category": inj.get("category"),
                    "traits": inj.get("traits"),
                    "possibleBiomes": inj.get("possibleBiomes"),
                    "risks": inj.get("risks"),
                }
                self.inject_element(planet_id, element)
            if t < target_tick:
                self.run_ticks(planet_id, 1)

        return self.get_state(planet_id)

    def forecast(
        self,
        planet_id: str,
        ticks: int = 10,
        samples: int = 8,
    ) -> dict[str, Any]:
        """Monte Carlo forecast: branch RNG streams from current snapshot."""
        world = self.worlds.get(planet_id)
        if world is None:
            raise KeyError(f"Unknown planet_id: {planet_id}")

        base_snap = world.snapshot()
        trajectories: list[dict[str, Any]] = []

        for s in range(samples):
            branch = PlanetWorld.from_snapshot(copy.deepcopy(base_snap))
            # Perturb seed stream via sample index while keeping base seed
            for step in range(ticks):
                next_tick = branch.tick + 1
                rng = SeededRNG(f"{branch.seed}:forecast:{s}:tick:{next_tick}")
                injections = list(branch.injected)
                industrial = sum(float(c.get("population", 0)) for c in branch.civs) * 0.001
                temp, moist, poll, _ = step_climate(
                    branch.temperature,
                    branch.moisture,
                    branch.pollution,
                    industrial_output=industrial,
                    injected_traits=injections,
                    rng=rng.derive("climate"),
                )
                branch.temperature, branch.moisture, branch.pollution = temp, moist, poll
                branch.species, _ = step_ecology(
                    branch.species,
                    pollution_mean=float(np.mean(branch.pollution)),
                    moisture_mean=float(np.mean(branch.moisture)),
                    injected_traits=injections,
                    rng=rng.derive("ecology"),
                )
                pop_total = sum(float(c.get("population", 0)) for c in branch.civs)
                branch.markets, _ = update_markets(
                    branch.markets,
                    producers=float(branch.species.get("producers", 0)),
                    population_total=pop_total,
                    injected_traits=injections,
                )
                branch.civs, _ = step_civilizations(
                    branch.civs,
                    markets=branch.markets,
                    pollution_mean=float(np.mean(branch.pollution)),
                    herbivores=float(branch.species.get("herbivores", 0)),
                    injected_traits=injections,
                    rng=rng.derive("civ"),
                )
                branch.tick = next_tick
            trajectories.append(branch.summary())

        # Aggregate means
        def mean_key(key: str) -> float:
            vals = [float(t.get(key, 0)) for t in trajectories]
            return sum(vals) / len(vals) if vals else 0.0

        species_keys = set()
        for t in trajectories:
            species_keys.update((t.get("species") or {}).keys())
        mean_species = {
            k: sum(float((t.get("species") or {}).get(k, 0)) for t in trajectories) / len(trajectories)
            for k in species_keys
        }

        return {
            "planet_id": planet_id,
            "from_tick": world.tick,
            "horizon": ticks,
            "samples": samples,
            "mean_temperature": mean_key("mean_temperature"),
            "mean_pollution": mean_key("mean_pollution"),
            "mean_species": mean_species,
            "trajectories": trajectories,
        }


# Process-local singleton used by routes
engine = TickEngine()
