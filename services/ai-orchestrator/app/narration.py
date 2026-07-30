"""Convert simulation facts to Arabic/English narrative — facts only."""

from __future__ import annotations

import re

from .providers.base import ProviderAdapter, ProviderUnavailable
from .providers.factory import get_provider
from .providers.mock import MockProvider
from .schemas import NarrationResult


def _tokenize(text: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[\w\u0600-\u06FF]+", text) if len(t) > 1}


def narrative_invents(narrative: str, facts: list[str]) -> bool:
    """Heuristic: flag if narrative introduces substantial tokens absent from facts.

    Allows a small set of glue words in AR/EN templates.
    """
    allowed = {
        # English glue
        "summary",
        "strictly",
        "from",
        "provided",
        "facts",
        "the",
        "and",
        "of",
        "to",
        "in",
        "a",
        "an",
        "on",
        "at",
        "for",
        "with",
        "by",
        "is",
        "are",
        "was",
        "were",
        "tick",
        "planet",
        # Arabic glue / template
        "ملخص",
        "مبني",
        "فقط",
        "على",
        "الوقائع",
        "المقدمة",
        "في",
        "من",
        "إلى",
        "عن",
        "هذا",
        "هذه",
        "ذلك",
        "التي",
        "الذي",
        "تم",
        "حدث",
        "القراد",
        "الكوكب",
        "وفقا",
        "للوقائع",
    }
    fact_tokens: set[str] = set()
    for f in facts:
        fact_tokens |= _tokenize(f)
    narr_tokens = _tokenize(narrative)
    extra = {t for t in narr_tokens if t not in fact_tokens and t not in allowed}
    # Allow numbers already present as substrings
    suspicious = {t for t in extra if not t.isdigit()}
    return len(suspicious) > 3


def narrate_from_facts(
    facts: list[str],
    *,
    language: str = "ar",
    use_llm: bool = False,
    provider: ProviderAdapter | None = None,
    tick: int | None = None,
    planet_id: str | None = None,
) -> NarrationResult:
    """Build narrative strictly from facts.

    Template path never invents. Optional LLM path is validated; on invention
    or failure, falls back to template.
    """
    cleaned = [str(f).strip() for f in facts if str(f).strip()]
    if tick is not None:
        cleaned = [f"tick={tick}", *cleaned]
    if planet_id:
        cleaned = [f"planet_id={planet_id}", *cleaned]

    template_provider = MockProvider()
    template_text = template_provider.narrate(cleaned, language=language)

    if not use_llm:
        return NarrationResult(
            language=language,  # type: ignore[arg-type]
            narrative=template_text,
            facts_used=cleaned,
            invented=False,
            provider="template",
        )

    adapter = provider or get_provider()
    try:
        llm_text = adapter.narrate(cleaned, language=language)
    except ProviderUnavailable:
        return NarrationResult(
            language=language,  # type: ignore[arg-type]
            narrative=template_text,
            facts_used=cleaned,
            invented=False,
            provider="template",
        )

    if narrative_invents(llm_text, cleaned):
        return NarrationResult(
            language=language,  # type: ignore[arg-type]
            narrative=template_text,
            facts_used=cleaned,
            invented=False,
            provider="template",
        )

    return NarrationResult(
        language=language,  # type: ignore[arg-type]
        narrative=llm_text.strip(),
        facts_used=cleaned,
        invented=False,
        provider=adapter.name,
    )
