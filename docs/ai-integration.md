# AI Integration

## Layers

| Layer | Responsibility | Invents world events? |
|---|---|---|
| Understand | Text → `StructuredElement` | No |
| Balance | Cap immortality / infinite growth / planet-killers; suggest balanced traits | No |
| Causal sim | Algorithms in simulation-core | N/A (source of truth) |
| Narrative | Explain structured fields + provided simulation facts | **Forbidden** |
| Agents | Future: leaders constrained by world state | Must not freestyle outcomes |

## Providers

Adapters in `services/ai-orchestrator`:

- `sandbox` (default when keys absent — **explicitly labeled**)
- `openai`
- `anthropic`
- `gemini`

Set `AI_PROVIDER` and the matching `*_API_KEY`. With `AI_SANDBOX_MODE=true`, sandbox is forced.

## API flow

`POST /contributions/analyze` → moderation (injection patterns) → provider → Zod/Pydantic validation → balance → analysis cache.

`POST /contributions/confirm` → simulation apply → DB events → notifications → optional Monte Carlo projection.

## Cost tracking

Rows in `ai_requests` with `provider`, `sandbox`, `cost_usd`. Admin `/admin/ai-usage`.
