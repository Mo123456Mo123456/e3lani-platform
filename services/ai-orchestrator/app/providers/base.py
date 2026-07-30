"""Abstract provider adapter interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class ProviderUnavailable(RuntimeError):
    """Raised when a provider cannot run (missing key, etc.)."""


class ProviderAdapter(ABC):
    name: str = "base"
    sandbox: bool = False

    @abstractmethod
    def analyze_element(self, prompt: str, *, language: str = "ar") -> dict[str, Any]:
        """Return a dict compatible with StructuredElementOutput fields."""

    @abstractmethod
    def narrate(self, facts: list[str], *, language: str = "ar") -> str:
        """Produce a narrative strictly from facts (or raise)."""
