"""Provider interface. All providers produce the same structured
contract; only the language understanding backend differs."""
from __future__ import annotations

from typing import Any, Protocol

from ..schemas import StructuredContribution


class Provider(Protocol):
    name: str

    def configured(self) -> bool: ...

    def parse_contribution(self, text: str, locale: str, category: str | None) -> StructuredContribution: ...

    def narrate(self, events: list[dict[str, Any]], locale: str) -> str: ...
