# AI Integration

## Providers

Adapters in `services/ai-orchestrator`:

- `sandbox` (default) — deterministic local structured parser
- `openai` — Chat Completions JSON (requires `OPENAI_API_KEY`)
- `anthropic` / `gemini` — adapters ready, fall back to sandbox without keys

Set `AI_PROVIDER` and keys in `.env`. Without keys, responses are clearly `sandbox: true`.

## Layers

1. **Understand** — idea → `StructuredContribution`
2. **Balance** — hard caps, tradeoffs, forbidden overpowered patterns
3. **Simulate** — algorithmic engine (not LLM)
4. **Narrate** — language model rephrases **only** simulation events
5. **Agents** — civilization decisions use utility scores over world state (not chat)

## Safety

- Prompt injection patterns blocked (`@planet/validation`)
- User text sanitized
- No code/SQL execution from ideas
- Narration refuses empty event lists (no invented history)
