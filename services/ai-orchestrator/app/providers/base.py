"""Provider protocol — every AI backend implements this interface."""
from __future__ import annotations

from typing import List, Optional, Protocol

from ..schemas import Category, StructuredContribution


class ProviderError(Exception):
    """Raised when a remote provider fails; callers fall back to sandbox."""


class ContributionProvider(Protocol):
    name: str

    async def parse_contribution(
        self, text: str, category: Optional[Category], locale: str
    ) -> StructuredContribution: ...

    async def narrate(self, contribution_name: str, facts: List[str], locale: str) -> str: ...
