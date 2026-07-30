"""World events and causal links.

Every mutation the engine performs emits an event. Events form a causal
DAG through ``cause_event_id``; roots are either world genesis or a user
contribution (``contribution_id`` set). Downstream consumers (API,
narrator, notifications) may only describe what exists in this log.
"""
from __future__ import annotations

from typing import Any

# Event type catalog (public contract — mirrored in packages/shared-types).
WORLD_GENESIS = "WORLD_GENESIS"
RESOURCE_DISCOVERED = "RESOURCE_DISCOVERED"
RESOURCE_DEPLETED = "RESOURCE_DEPLETED"
SPECIES_CREATED = "SPECIES_CREATED"
SPECIES_MUTATED = "SPECIES_MUTATED"
SPECIES_EXTINCT = "SPECIES_EXTINCT"
SPECIES_MIGRATED = "SPECIES_MIGRATED"
PLANT_SPREAD = "PLANT_SPREAD"
CIVILIZATION_FOUNDED = "CIVILIZATION_FOUNDED"
CIVILIZATION_COLLAPSED = "CIVILIZATION_COLLAPSED"
CITY_CREATED = "CITY_CREATED"
CITY_CAPTURED = "CITY_CAPTURED"
TECHNOLOGY_DISCOVERED = "TECHNOLOGY_DISCOVERED"
WAR_STARTED = "WAR_STARTED"
WAR_ENDED = "WAR_ENDED"
TERRITORY_CHANGED = "TERRITORY_CHANGED"
MIGRATION_STARTED = "MIGRATION_STARTED"
ALLIANCE_CREATED = "ALLIANCE_CREATED"
ALLIANCE_BROKEN = "ALLIANCE_BROKEN"
DISEASE_OUTBREAK = "DISEASE_OUTBREAK"
DISEASE_CONTAINED = "DISEASE_CONTAINED"
CLIMATE_CHANGED = "CLIMATE_CHANGED"
STORM_FORMED = "STORM_FORMED"
DROUGHT_STARTED = "DROUGHT_STARTED"
WILDFIRE_STARTED = "WILDFIRE_STARTED"
FLOOD_OCCURRED = "FLOOD_OCCURRED"
VOLCANO_ERUPTED = "VOLCANO_ERUPTED"
TRADE_ROUTE_CREATED = "TRADE_ROUTE_CREATED"
GOVERNMENT_CHANGED = "GOVERNMENT_CHANGED"
CULTURE_EVOLVED = "CULTURE_EVOLVED"
CONTRIBUTION_APPLIED = "CONTRIBUTION_APPLIED"

ALL_EVENT_TYPES = [
    WORLD_GENESIS, RESOURCE_DISCOVERED, RESOURCE_DEPLETED, SPECIES_CREATED,
    SPECIES_MUTATED, SPECIES_EXTINCT, SPECIES_MIGRATED, PLANT_SPREAD,
    CIVILIZATION_FOUNDED, CIVILIZATION_COLLAPSED, CITY_CREATED, CITY_CAPTURED,
    TECHNOLOGY_DISCOVERED, WAR_STARTED, WAR_ENDED, TERRITORY_CHANGED,
    MIGRATION_STARTED, ALLIANCE_CREATED, ALLIANCE_BROKEN, DISEASE_OUTBREAK,
    DISEASE_CONTAINED, CLIMATE_CHANGED, STORM_FORMED, DROUGHT_STARTED,
    WILDFIRE_STARTED, FLOOD_OCCURRED, VOLCANO_ERUPTED, TRADE_ROUTE_CREATED,
    GOVERNMENT_CHANGED, CULTURE_EVOLVED, CONTRIBUTION_APPLIED,
]


class EventLog:
    """Append-only event factory bound to one world state."""

    def __init__(self, state: dict[str, Any]) -> None:
        self.state = state

    def emit(
        self,
        tick: int,
        type_: str,
        *,
        importance: int = 2,
        cell_id: int | None = None,
        civ_ids: list[str] | None = None,
        species_ids: list[str] | None = None,
        plant_ids: list[str] | None = None,
        cause_event_id: str | None = None,
        contribution_id: str | None = None,
        confidence: float = 1.0,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.state["eventCounter"] += 1
        evt = {
            "id": f"ev_{self.state['eventCounter']}",
            "tick": tick,
            "type": type_,
            "importance": max(1, min(5, int(importance))),
            "cellId": cell_id,
            "civIds": civ_ids or [],
            "speciesIds": species_ids or [],
            "plantIds": plant_ids or [],
            "causeEventId": cause_event_id,
            "contributionId": contribution_id,
            "confidence": round(confidence, 3),
            "payload": payload or {},
        }
        self.state["events"].append(evt)
        return evt


def descendant_ids(events: list[dict[str, Any]], root_id: str) -> set[str]:
    """All event ids in the causal subtree of ``root_id`` (inclusive)."""
    children: dict[str | None, list[str]] = {}
    for e in events:
        children.setdefault(e["causeEventId"], []).append(e["id"])
    out: set[str] = set()
    stack = [root_id]
    while stack:
        cur = stack.pop()
        if cur in out:
            continue
        out.add(cur)
        stack.extend(children.get(cur, []))
    return out
