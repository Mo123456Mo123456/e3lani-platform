from __future__ import annotations

import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .models import (
    AnalyzeRequest,
    ContributionAnalysis,
    Moderation,
    NarrativeRequest,
    NarrativeResponse,
)
from .providers import Provider, get_provider

INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"ignore (all|the|previous) instructions",
        r"system prompt",
        r"developer message",
        r"<\s*/?\s*(system|assistant|tool)",
        r"تجاهل (كل|جميع|التعليمات)",
        r"رسالة النظام",
        r"نفذ (هذا )?(الكود|الأمر)",
        r"\b(drop|truncate|delete)\s+table\b",
    )
]
UNBOUNDED_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"لا يموت",
        r"طاقة (لا نهائية|غير محدودة)",
        r"يتكاثر بلا حدود",
        r"يدمر الكوكب فور",
        r"سيطرة مطلقة",
        r"\b(immortal|infinite energy|unlimited reproduction|absolute control)\b",
    )
]

provider: Provider | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global provider
    provider = get_provider()
    yield
    provider = None


app = FastAPI(
    title="Planet AI Orchestrator",
    version="0.1.0",
    description=(
        "Provider-neutral structured-output boundary. Algorithms, not this service, "
        "determine world-state transitions."
    ),
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "provider": provider.name if provider else None,
        "sandbox": provider.sandbox if provider else None,
    }


@app.post("/v1/contributions/analyze", response_model=ContributionAnalysis)
async def analyze_contribution(request: AnalyzeRequest) -> ContributionAnalysis:
    injection_matches = [
        pattern.pattern for pattern in INJECTION_PATTERNS if pattern.search(request.idea)
    ]
    if injection_matches:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "PROMPT_INJECTION_DETECTED",
                "message": "The contribution contains instruction-like content.",
                "ruleMatches": injection_matches,
            },
        )
    if provider is None:
        raise HTTPException(status_code=503, detail="AI provider is not initialized")

    try:
        analysis = await provider.analyze(request)
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail={"code": "AI_PROVIDER_FAILURE", "message": type(error).__name__},
        ) from error

    return balance_analysis(request, analysis)


@app.post("/v1/narratives", response_model=NarrativeResponse)
async def narrate(request: NarrativeRequest) -> NarrativeResponse:
    # The deterministic renderer deliberately cites every sentence's source event.
    # Provider-generated prose can be added only with an equivalent citation check.
    clauses: list[str] = []
    for event in request.events:
        impact = ", ".join(
            f"{key} {value:+.3f}" for key, value in sorted(event.directImpact.items())
        )
        if request.locale == "ar":
            clauses.append(
                f"في سنة {event.year} وقع {event.type} بسبب {event.cause}"
                + (f"، وكان أثره المباشر: {impact}" if impact else "")
                + f" [حدث {event.id}]."
            )
        else:
            clauses.append(
                f"In year {event.year}, {event.type} occurred because {event.cause}"
                + (f"; direct impact: {impact}" if impact else "")
                + f" [event {event.id}]."
            )
    return NarrativeResponse(
        narrative=" ".join(clauses),
        citedEventIds=[event.id for event in request.events],
        provider="deterministic-grounded-renderer",
        sandbox=False,
    )


def balance_analysis(
    request: AnalyzeRequest, analysis: ContributionAnalysis
) -> ContributionAnalysis:
    unbounded = [
        pattern.pattern for pattern in UNBOUNDED_PATTERNS if pattern.search(request.idea)
    ]
    traits = analysis.traits.model_copy()
    adjusted = bool(unbounded)
    reasons = list(analysis.moderation.reasons)

    if unbounded:
        # Preserve the concept while enforcing finite ecological and energy budgets.
        traits.growthRate = min(traits.growthRate, 0.42)
        traits.energyYield = min(traits.energyYield, 0.72)
        traits.adaptability = min(traits.adaptability, 0.72)
        traits.pollutionAbsorption = min(traits.pollutionAbsorption, 0.95)
        reasons.append("unbounded_traits_were_limited")

    ecological_load = (
        traits.size * 0.22
        + traits.growthRate * 0.25
        + traits.waterNeed * 0.18
        + traits.aggression * 0.2
        + traits.contagion * 0.15
    )
    if ecological_load > 0.78:
        traits.growthRate = min(traits.growthRate, 0.5)
        traits.adaptability = min(traits.adaptability, 0.65)
        adjusted = True
        reasons.append("ecological_load_rebalanced")

    balance_score = max(0.05, min(0.95, 1 - ecological_load * 0.42))
    moderation = Moderation(
        accepted=True,
        reasons=list(dict.fromkeys(reasons))[:8],
        adjusted=adjusted or analysis.moderation.adjusted,
    )
    return analysis.model_copy(
        update={
            "traits": traits,
            "balanceScore": round(balance_score, 4),
            "moderation": moderation,
            "provider": provider.name if provider else analysis.provider,
            "sandbox": provider.sandbox if provider else analysis.sandbox,
        }
    )
