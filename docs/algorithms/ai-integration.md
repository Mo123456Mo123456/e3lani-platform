# AI Integration

AI is **not** the simulation.

| Layer | Responsibility |
|---|---|
| Parse idea | Free text → structured traits (validated) |
| Balance | Cap god-mode traits; suggest tradeoffs |
| Causal | Built from simulation engine effects |
| Narrative | Explain only provided effects/events |
| Agents | Future: leaders constrained by world state |

## Providers

`AI_PROVIDER=mock|openai|anthropic|gemini`

Missing keys ⇒ documented sandbox mock. Production must not label mock output as a live model.

## Safety

- Regex + moderation table for injection/SQL/script attempts.
- Zod schemas on all AI ingress/egress.
- User text never executed as code or SQL.
