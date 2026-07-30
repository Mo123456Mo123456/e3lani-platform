from __future__ import annotations

import hashlib
import json
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventType(str, Enum):
    RESOURCE_DISCOVERED = "RESOURCE_DISCOVERED"
    SPECIES_CREATED = "SPECIES_CREATED"
    SPECIES_MUTATED = "SPECIES_MUTATED"
    SPECIES_EXTINCT = "SPECIES_EXTINCT"
    CIVILIZATION_FOUNDED = "CIVILIZATION_FOUNDED"
    CITY_CREATED = "CITY_CREATED"
    TECHNOLOGY_DISCOVERED = "TECHNOLOGY_DISCOVERED"
    WAR_STARTED = "WAR_STARTED"
    WAR_ENDED = "WAR_ENDED"
    MIGRATION_STARTED = "MIGRATION_STARTED"
    ALLIANCE_CREATED = "ALLIANCE_CREATED"
    DISEASE_OUTBREAK = "DISEASE_OUTBREAK"
    CLIMATE_CHANGED = "CLIMATE_CHANGED"
    VOLCANO_ERUPTED = "VOLCANO_ERUPTED"
    RESOURCE_DEPLETED = "RESOURCE_DEPLETED"
    TRADE_ROUTE_CREATED = "TRADE_ROUTE_CREATED"
    PLANT_SPREAD = "PLANT_SPREAD"
    POLLUTION_CHANGED = "POLLUTION_CHANGED"
    CONTRIBUTION_APPLIED = "CONTRIBUTION_APPLIED"
    TICK_COMPLETED = "TICK_COMPLETED"


class SimulationEvent(BaseModel):
    id: str
    type: EventType
    tick: int
    cause: str
    region_id: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    direct_impacts: dict[str, float] = Field(default_factory=dict)
    indirect_impacts: dict[str, float] = Field(default_factory=dict)
    labels: dict[str, str] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


def event_id(
    planet_id: str,
    tick: int,
    event_type: EventType,
    cause: str,
    region_id: str | None,
    index: int,
    impacts: dict[str, float] | None = None,
) -> str:
    payload = {
        "planet_id": planet_id,
        "tick": tick,
        "type": event_type.value,
        "cause": cause,
        "region_id": region_id,
        "index": index,
        "impacts": impacts or {},
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()[:20]


def make_event(
    planet_id: str,
    tick: int,
    event_type: EventType,
    cause: str,
    region_id: str | None,
    confidence: float,
    direct_impacts: dict[str, float] | None,
    indirect_impacts: dict[str, float] | None,
    index: int,
    labels: dict[str, str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> SimulationEvent:
    direct = {k: round(float(v), 6) for k, v in (direct_impacts or {}).items()}
    indirect = {k: round(float(v), 6) for k, v in (indirect_impacts or {}).items()}
    return SimulationEvent(
        id=event_id(planet_id, tick, event_type, cause, region_id, index, direct),
        type=event_type,
        tick=tick,
        cause=cause,
        region_id=region_id,
        confidence=round(max(0.0, min(1.0, confidence)), 6),
        direct_impacts=direct,
        indirect_impacts=indirect,
        labels=labels or {},
        metadata=metadata or {},
    )

