"""Causal event graph: every simulation event must cite a cause."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import hashlib
import json


@dataclass
class CausalNode:
    event_id: str
    tick: int
    type: str
    cause: str
    effect: dict[str, Any]
    parents: list[str] = field(default_factory=list)


class CausalGraph:
    """Directed graph of caused events for audit / rebuild integrity."""

    def __init__(self) -> None:
        self.nodes: dict[str, CausalNode] = {}
        self.order: list[str] = []

    def _make_id(self, tick: int, event_type: str, cause: str, effect: dict[str, Any]) -> str:
        payload = json.dumps(
            {"tick": tick, "type": event_type, "cause": cause, "effect": effect},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def add(
        self,
        *,
        tick: int,
        event_type: str,
        cause: str,
        effect: dict[str, Any] | None = None,
        parents: list[str] | None = None,
    ) -> CausalNode:
        if not cause:
            raise ValueError("Causeless events are forbidden")
        effect = effect or {}
        event_id = self._make_id(tick, event_type, cause, effect)
        node = CausalNode(
            event_id=event_id,
            tick=tick,
            type=event_type,
            cause=cause,
            effect=effect,
            parents=list(parents or []),
        )
        self.nodes[event_id] = node
        self.order.append(event_id)
        return node

    def ingest_events(self, tick: int, events: list[dict[str, Any]], parent_ids: list[str] | None = None) -> list[str]:
        ids: list[str] = []
        for ev in events:
            cause = ev.get("cause")
            if not cause:
                raise ValueError(f"Causeless event rejected: {ev}")
            node = self.add(
                tick=tick,
                event_type=str(ev.get("type", "unknown")),
                cause=str(cause),
                effect=dict(ev.get("effect") or {}),
                parents=parent_ids,
            )
            ids.append(node.event_id)
        return ids

    def validate_no_causeless(self) -> bool:
        return all(bool(n.cause) for n in self.nodes.values())

    def to_list(self) -> list[dict[str, Any]]:
        return [
            {
                "event_id": self.nodes[eid].event_id,
                "tick": self.nodes[eid].tick,
                "type": self.nodes[eid].type,
                "cause": self.nodes[eid].cause,
                "effect": self.nodes[eid].effect,
                "parents": list(self.nodes[eid].parents),
            }
            for eid in self.order
        ]

    @classmethod
    def from_list(cls, items: list[dict[str, Any]]) -> "CausalGraph":
        g = cls()
        for item in items:
            node = CausalNode(
                event_id=item["event_id"],
                tick=int(item["tick"]),
                type=item["type"],
                cause=item["cause"],
                effect=dict(item.get("effect") or {}),
                parents=list(item.get("parents") or []),
            )
            if not node.cause:
                raise ValueError("Cannot load causeless event")
            g.nodes[node.event_id] = node
            g.order.append(node.event_id)
        return g
