# كوكب يولد أمامك — AI Orchestrator

Element analysis, moderation, balance, and **fact-strict** narration for the planet platform.

## Sandbox mode (default)

With **no API keys**, the service uses the deterministic `mock` provider:

- `AI_PROVIDER` unset or `mock` / `sandbox`
- No `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`

The mock provider:

- Derives `StructuredElementOutput` fields from the prompt via hashing + keyword rules
- Labels itself as **sandbox/mock** in narratives (never claims to be a production LLM)
- Sets `sandbox: true` on `/health` and `/ai/analyze-element`

```bash
python3 -m pip install --user -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8002
python3 -m pytest -q
```

## Providers

| `AI_PROVIDER` | Requirement | Notes |
|---------------|-------------|-------|
| `mock` (default) | none | Deterministic sandbox |
| `openai` | `OPENAI_API_KEY` | Raises `Unavailable` without key; factory falls back to mock |
| `anthropic` | `ANTHROPIC_API_KEY` | Same pattern |
| `gemini` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Same pattern |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status + active provider + sandbox flag |
| POST | `/ai/analyze-element` | Moderate → provider analyze → schema validate → balance |
| POST | `/ai/narrate` | Template (default) or optional LLM narration from **facts only** |
| POST | `/ai/moderate` | Rule-based bans + prompt-injection detection |
| POST | `/ai/balance` | Cap overpowered traits; propose alternatives |

## Structured output

```json
{
  "category": "flora",
  "name": "Crystal Moss",
  "traits": { "fertility": 0.6, "toxicity": 0.2 },
  "possibleBiomes": ["forest"],
  "risks": ["bloom"],
  "narrative": "..."
}
```

All trait values must be floats in **[0, 1]**.

## Narration contract

Narratives are built **only** from the caller-supplied fact list (plus optional `tick` / `planet_id`). The template path concatenates facts; optional LLM output is rejected if it invents tokens not present in the facts, falling back to the template. `invented` is always `false` in successful responses.

## Moderation

- Banned real-world harm patterns
- Prompt-injection / jailbreak / system-tag detection (EN + AR)
- Soft “rate concept” flags for omnipotence / extinction (passed to balance)
