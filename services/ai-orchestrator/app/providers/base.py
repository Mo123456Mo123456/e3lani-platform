from abc import ABC, abstractmethod

from app.models import ElementCategory, Locale, StructuredElement


class ElementProvider(ABC):
    provider_name: str
    is_sandbox: bool

    @abstractmethod
    def parse_element(
        self,
        text: str,
        locale: Locale,
        category_hint: ElementCategory | None = None,
    ) -> StructuredElement:
        """Convert user text into a StructuredElement."""
