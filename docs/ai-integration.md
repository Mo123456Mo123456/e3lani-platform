# AI Integration

The AI layer parses contributions and narrates confirmed simulation data. It does not invent world state and does not decide simulation outcomes.

Providers:

- `mock`: always available; Arabic and English keyword heuristics.
- `openai`, `anthropic`, `gemini`: adapter names reserved for production keys; current foundation falls back to mock-like behavior until SDK integrations are enabled.

Narrative guardrail: `narrateFromSimulation(events)` only references provided event titles/ticks.
