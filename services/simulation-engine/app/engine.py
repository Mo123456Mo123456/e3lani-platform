"""Tick orchestration and deterministic replay.

System order per tick is fixed: climate -> ecology -> civilizations ->
economy -> conflicts -> diseases -> technology -> pending effects ->
housekeeping. Given (seed, tick count, injections), replay always
reproduces the exact same history.
"""
from __future__ import annotations

import copy
from typing import Any

from .events import EventLog
from .generator import generate_world
from .inject import inject_contribution
from .rng import Rng
from .systems.civilizations import apply_civilizations
from .systems.climate import apply_climate
from .systems.conflicts import apply_conflicts
from .systems.diseases import apply_diseases
from .systems.economy import apply_economy
from .systems.ecology import apply_ecology
from .systems.technology import apply_technology

MAX_TICKS_PER_CALL = 2000


def tick_once(state: dict[str, Any]) -> None:
    state["meta"]["tick"] += 1
    apply_climate(state)
    apply_ecology(state)
    apply_civilizations(state)
    apply_economy(state)
    apply_conflicts(state)
    apply_diseases(state)
    apply_technology(state)
    _apply_pending(state)
    _housekeeping(state)


def advance(state: dict[str, Any], ticks: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    ticks = max(1, min(int(ticks), MAX_TICKS_PER_CALL))
    before = len(state["events"])
    for _ in range(ticks):
        tick_once(state)
    return state, state["events"][before:]


def run_history(
    seed: int,
    total_ticks: int,
    injections: list[dict[str, Any]] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Full deterministic replay: genesis + scheduled injections + ticks."""
    state = generate_world(seed, params)
    schedule = sorted((injections or []), key=lambda i: i["tick"])
    cursor = 0
    for item in schedule:
        target = int(item["tick"])
        if target > cursor:
            advance(state, target - cursor)
            cursor = target
        inject_contribution(state, item["contribution"])
    if total_ticks > cursor:
        advance(state, total_ticks - cursor)
    return state


# ---------------------------------------------------------------------
# Pending effects (delayed causal consequences)
# ---------------------------------------------------------------------

def schedule_effect(state: dict[str, Any], trigger_tick: int, kind: str,
                    payload: dict[str, Any], cause_event_id: str | None) -> None:
    state["pendingEffects"].append({
        "id": f"pe_{len(state['pendingEffects'])}_{trigger_tick}",
        "triggerTick": trigger_tick,
        "kind": kind,
        "payload": payload,
        "causeEventId": cause_event_id,
    })


def _apply_pending(state: dict[str, Any]) -> None:
    tick = state["meta"]["tick"]
    log = EventLog(state)
    rng = Rng(state["meta"]["seed"], "pending", tick)
    due = [e for e in state["pendingEffects"] if e["triggerTick"] <= tick]
    if not due:
        return
    state["pendingEffects"] = [e for e in state["pendingEffects"] if e["triggerTick"] > tick]
    for effect in due:
        _resolve_effect(state, effect, log, rng, tick)


def _resolve_effect(state: dict[str, Any], effect: dict[str, Any], log: EventLog, rng: Rng, tick: int) -> None:
    kind = effect["kind"]
    payload = effect["payload"]
    cause = effect["causeEventId"]

    if kind == "weather_pattern":
        # a contributed climate phenomenon pulses moisture/temp in a region
        cell_ids = payload.get("cells", [])
        for cid in cell_ids:
            if 0 <= cid < len(state["cells"]):
                cell = state["cells"][cid]
                cell["moisture"] = max(0.0, min(1.0, cell["moisture"] + payload.get("moistureDelta", 0.0)))
                cell["temp"] += payload.get("tempDelta", 0.0)
        log.emit(tick, "CLIMATE_CHANGED", importance=3, cause_event_id=cause,
                 contribution_id=payload.get("contributionId"),
                 payload={"driver": "phenomenon", "cells": len(cell_ids)})
    elif kind == "world_law":
        # global modifiers re-assert themselves (e.g. boosted photosynthesis)
        factor = payload.get("vegetationFactor")
        if factor:
            for plant in state["plants"].values():
                if plant["extinct"]:
                    continue
                for key in plant["presence"]:
                    plant["presence"][key] = round(min(3.0, plant["presence"][key] * factor), 3)
        log.emit(tick, "CLIMATE_CHANGED", importance=3, cause_event_id=cause,
                 contribution_id=payload.get("contributionId"),
                 payload={"driver": "world_law", "name": payload.get("name")})


def _housekeeping(state: dict[str, Any]) -> None:
    tick = state["meta"]["tick"]
    # keep migration records bounded (historical record stays in events)
    if len(state["migrations"]) > 500:
        state["migrations"] = state["migrations"][-500:]
    # drop fully consumed transient storm state
    meta = state["meta"]
    if meta.get("storms"):
        meta["storms"] = [s for s in meta["storms"] if s["ttl"] > 0]


def fork_state(state: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(state)
