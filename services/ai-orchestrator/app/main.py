"""FastAPI entrypoint for the AI orchestrator."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .providers.factory import get_provider
from .routes.analyze import router as analyze_router
from .schemas import HealthResponse

app = FastAPI(
    title="كوكب يولد أمامك — AI Orchestrator",
    description="Element analysis, moderation, balance, and fact-strict narration.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    provider = get_provider()
    return HealthResponse(
        status="ok",
        service="ai-orchestrator",
        provider=provider.name,
        sandbox=bool(provider.sandbox),
    )
