"""Lotka–Volterra inspired multi-species ecology stepping."""

from __future__ import annotations

from typing import Any

from .rng import SeededRNG


def step_ecology(
    species: dict[str, float],
    *,
    pollution_mean: float = 0.0,
    moisture_mean: float = 0.0,
    injected_traits: list[dict[str, Any]] | None = None,
    rng: SeededRNG | None = None,
    dt: float = 0.1,
) -> tuple[dict[str, float], list[dict[str, Any]]]:
    """Advance one ecology tick.

    Classic coupled ODE intuition:
      dP/dt = rP - a P H
      dH/dt = e a P H - m H - b H C
      dC/dt = e2 b H C - d C
    Decomposers recycle death into producer growth.
    """
    events: list[dict[str, Any]] = []
    p = max(species.get("producers", 0.0), 0.0)
    h = max(species.get("herbivores", 0.0), 0.0)
    c = max(species.get("carnivores", 0.0), 0.0)
    d = max(species.get("decomposers", 0.0), 0.0)

    # Environmental modifiers
    pollution_penalty = max(0.0, pollution_mean) * 0.15
    moisture_bonus = max(-0.1, min(0.15, moisture_mean * 0.1))

    r = 0.35 + moisture_bonus - pollution_penalty  # producer growth
    a = 0.02  # predation herbivore on producers
    e = 0.45  # conversion efficiency
    m = 0.12 + pollution_penalty * 0.5  # herbivore mortality
    b = 0.03  # predation carnivore on herbivores
    e2 = 0.35
    death_c = 0.1 + pollution_penalty * 0.3
    recycle = 0.05

    # Injected element modifiers (traits 0-1)
    for inj in injected_traits or []:
        traits = inj.get("traits") or {}
        toxicity = float(traits.get("toxicity", 0.0))
        fertility = float(traits.get("fertility", 0.0))
        predation = float(traits.get("predation", 0.0))
        r += fertility * 0.2 - toxicity * 0.25
        m += toxicity * 0.1
        b += predation * 0.02
        events.append(
            {
                "type": "ecology.injection_effect",
                "cause": f"element:{inj.get('name', 'unknown')}",
                "effect": {
                    "toxicity": toxicity,
                    "fertility": fertility,
                    "predation": predation,
                },
            }
        )

    dp = (r * p - a * p * h + recycle * d) * dt
    dh = (e * a * p * h - m * h - b * h * c) * dt
    dc = (e2 * b * h * c - death_c * c) * dt
    dd = (0.08 * (h * m + c * death_c) - 0.06 * d + 0.02 * p) * dt

    # Tiny deterministic noise if rng provided (keeps reproducibility)
    if rng is not None:
        dp += rng.uniform(-0.05, 0.05)
        dh += rng.uniform(-0.03, 0.03)

    new_species = {
        "producers": max(0.0, p + dp),
        "herbivores": max(0.0, h + dh),
        "carnivores": max(0.0, c + dc),
        "decomposers": max(0.0, d + dd),
    }

    if new_species["herbivores"] < 1.0 and h >= 1.0:
        events.append(
            {
                "type": "ecology.herbivore_collapse",
                "cause": "low_prey_or_pollution",
                "effect": {"herbivores": new_species["herbivores"]},
            }
        )
    if new_species["producers"] > p * 1.15:
        events.append(
            {
                "type": "ecology.bloom",
                "cause": "producer_growth",
                "effect": {"producers": new_species["producers"]},
            }
        )

    return new_species, events
