from fastapi import Depends, FastAPI

from app.config import Settings, get_settings
from app.models import (
    AnalyzeContributionRequest,
    AnalyzeContributionResponse,
    BalanceRequest,
    BalanceResponse,
    ModerationRequest,
    ModerationResponse,
    NarrateRequest,
    NarrateResponse,
    ParseRequest,
    ParseResponse,
)
from app.pipeline.balance import balance_element
from app.pipeline.moderate import moderate_text
from app.pipeline.narrate import narrate
from app.pipeline.parse_element import parse_element
from app.providers import get_provider
from app.providers.base import ElementProvider


app = FastAPI(
    title="كوكب يولد أمامك AI Orchestrator",
    version="0.1.0",
    description="Structured parsing, moderation, balancing, and factual narration for simulation contributions.",
)


def provider_dependency(settings: Settings = Depends(get_settings)) -> ElementProvider:
    return get_provider(settings)


@app.get("/health")
def health(settings: Settings = Depends(get_settings), provider: ElementProvider = Depends(provider_dependency)) -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "provider": provider.provider_name,
        "sandbox": provider.is_sandbox,
    }


@app.post("/moderate", response_model=ModerationResponse)
def moderate(request: ModerationRequest) -> ModerationResponse:
    return ModerationResponse(moderation=moderate_text(request.text, request.locale))


@app.post("/parse", response_model=ParseResponse)
def parse(request: ParseRequest, provider: ElementProvider = Depends(provider_dependency)) -> ParseResponse:
    moderation = moderate_text(request.text, request.locale)
    element = parse_element(provider, request.text, request.locale, request.category_hint)
    return ParseResponse(
        element=element,
        moderation=moderation,
        provider=provider.provider_name,
        sandbox=provider.is_sandbox,
    )


@app.post("/balance", response_model=BalanceResponse)
def balance(request: BalanceRequest) -> BalanceResponse:
    return balance_element(request.element)


@app.post("/narrate", response_model=NarrateResponse)
def narrate_results(request: NarrateRequest) -> NarrateResponse:
    return narrate(request.events, request.metrics, request.locale)


@app.post("/analyze-contribution", response_model=AnalyzeContributionResponse)
def analyze_contribution(
    request: AnalyzeContributionRequest,
    provider: ElementProvider = Depends(provider_dependency),
) -> AnalyzeContributionResponse:
    moderation = moderate_text(request.text, request.locale)
    if not moderation.allowed:
        return AnalyzeContributionResponse(
            moderation=moderation,
            rejected=True,
            provider=provider.provider_name,
            sandbox=provider.is_sandbox,
        )

    parsed = parse_element(provider, request.text, request.locale, request.category_hint)
    balanced = balance_element(parsed)
    return AnalyzeContributionResponse(
        moderation=moderation,
        parsed=parsed,
        balanced=balanced.element,
        balance_notes=balanced.notes,
        rejected=balanced.rejected,
        provider=provider.provider_name,
        sandbox=provider.is_sandbox,
    )
