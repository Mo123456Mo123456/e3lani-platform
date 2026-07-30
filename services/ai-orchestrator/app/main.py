"""AI Orchestrator service (FastAPI).

/v1/parse-contribution — free text -> validated StructuredContribution
/v1/narrate            — constrained narration over allowlisted facts only
/v1/balance            — power-budget validation + balanced suggestion
/health                — liveness + active provider

Provider selection: env AI_PROVIDER=mock|openai|anthropic|gemini. Remote
failures degrade gracefully to the deterministic mock sandbox; the response
always states which provider actually produced the result.
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .balance import validate_balance
from .providers.base import ProviderError
from .providers.factory import create_provider
from .providers.mock import MockProvider
from .schemas import (
    BalanceReport,
    NarrateRequest,
    NarrateResponse,
    ParseRequest,
    ParseResponse,
    StructuredContribution,
)

sandbox = MockProvider()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.provider = create_provider()
    yield


app = FastAPI(
    title="Planet Genesis — AI Orchestrator",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    provider = app.state.provider
    return {
        "status": "ok",
        "provider": provider.name,
        "sandbox": isinstance(provider, MockProvider),
    }


@app.post("/v1/parse-contribution", response_model=ParseResponse)
async def parse_contribution(request: ParseRequest) -> ParseResponse:
    provider = app.state.provider
    started = time.perf_counter()
    try:
        structured = await provider.parse_contribution(request.text, request.category, request.locale)
        used = provider.name
    except ProviderError:
        structured = await sandbox.parse_contribution(request.text, request.category, request.locale)
        used = sandbox.name
    # clamp traits into [0,1] regardless of provider behavior
    structured = structured.model_copy(update={"traits": structured.normalized_traits()})
    balance: BalanceReport = validate_balance(structured)
    _ = started  # latency measured by the API gateway's AIRequest log
    return ParseResponse(
        structured=structured,
        balance=balance,
        provider=used,
        sandbox=used == "mock",
    )


@app.post("/v1/narrate", response_model=NarrateResponse)
async def narrate(request: NarrateRequest) -> NarrateResponse:
    provider = app.state.provider
    # the service only ever receives allowlisted facts; if a remote provider
    # is unavailable the deterministic template narrator takes over
    try:
        text = await provider.narrate(request.contribution_name, request.facts, request.locale)
        used = provider.name
    except ProviderError:
        text = await sandbox.narrate(request.contribution_name, request.facts, request.locale)
        used = sandbox.name
    return NarrateResponse(text=text, provider=used)


@app.post("/v1/balance", response_model=BalanceReport)
async def balance(contribution: StructuredContribution) -> BalanceReport:
    return validate_balance(contribution)
