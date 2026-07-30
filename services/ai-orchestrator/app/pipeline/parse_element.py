from app.models import ElementCategory, Locale, StructuredElement
from app.providers.base import ElementProvider
from app.validation import detect_locale, normalize_text


def parse_element(
    provider: ElementProvider,
    text: str,
    locale: Locale | None = None,
    category_hint: ElementCategory | None = None,
) -> StructuredElement:
    normalized = normalize_text(text)
    active_locale = detect_locale(normalized, locale)
    return provider.parse_element(normalized, active_locale, category_hint)
