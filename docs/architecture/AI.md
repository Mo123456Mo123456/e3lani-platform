# AI Orchestration

Service: `services/ai-orchestrator` (`AI_PROVIDER=mock|openai|anthropic|gemini`)

## Layers

1. **Moderation** — `@planet-born/validation` (injection + forbidden powers flags)
2. **Analyze** — idea → `StructuredContribution` (Zod)
3. **Balance** — `balanceContribution()` algorithmic clamp
4. **Narrate** — text only from provided event titles/descriptions (`sandbox: true` when mock)
5. **Scenarios** — numerical Monte Carlo in simulation-models; AI may phrase but must not invent metrics

## Provider adapters

| Provider | Env |
|---|---|
| Mock | default / missing keys |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |

Missing keys ⇒ MockProvider with explicit `sandbox: true`. Never present mock output as production AI.

## Hard rule

Narration endpoints must only reference event IDs supplied by the caller. Tests assert no invented events.
