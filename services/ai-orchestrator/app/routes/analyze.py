"""AI analysis / narration / moderation routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..balance import balance_element
from ..moderation import moderate
from ..narration import narrate_from_facts
from ..providers.factory import get_provider
from ..schemas import (
    AnalyzeElementRequest,
    AnalyzeElementResponse,
    BalanceRequest,
    BalanceResult,
    ModerateRequest,
    ModerationResult,
    NarrateRequest,
    NarrationResult,
    StructuredElementOutput,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/analyze-element", response_model=AnalyzeElementResponse)
def analyze_element(body: AnalyzeElementRequest) -> AnalyzeElementResponse:
    mod = moderate(body.prompt)
    if not mod.allowed:
        raise HTTPException(status_code=400, detail={"moderation": mod.model_dump()})

    provider = get_provider(body.provider)
    raw = provider.analyze_element(mod.sanitized_text or body.prompt, language=body.language)
    # Drop internal flags before schema validation
    payload = {k: v for k, v in raw.items() if not k.startswith("_")}
    try:
        element = StructuredElementOutput.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Provider output invalid: {exc}") from exc

    bal = balance_element(element)
    return AnalyzeElementResponse(
        element=element,
        moderation=mod,
        balance=bal,
        provider=provider.name,
        sandbox=bool(provider.sandbox),
        raw=raw if provider.sandbox else None,
    )


@router.post("/narrate", response_model=NarrationResult)
def narrate(body: NarrateRequest) -> NarrationResult:
    return narrate_from_facts(
        body.facts,
        language=body.language,
        use_llm=body.use_llm,
        tick=body.tick,
        planet_id=body.planet_id,
    )


@router.post("/moderate", response_model=ModerationResult)
def moderate_route(body: ModerateRequest) -> ModerationResult:
    return moderate(body.text)


@router.post("/balance", response_model=BalanceResult)
def balance_route(body: BalanceRequest) -> BalanceResult:
    return balance_element(body.element)
