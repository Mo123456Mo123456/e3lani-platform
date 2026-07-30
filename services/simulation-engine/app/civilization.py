"""Civilization agents: utility maximization and war probability."""

from __future__ import annotations

import math
from typing import Any

from .rng import SeededRNG


def _utility(civ: dict[str, Any], action: str, context: dict[str, Any]) -> float:
    food = float(context.get("food_price", 1.0))
    pollution = float(context.get("pollution", 0.0))
    species_prey = float(context.get("herbivores", 1.0))

    u_food = float(civ.get("utility_food", 0.5))
    u_sec = float(civ.get("utility_security", 0.5))
    u_growth = float(civ.get("utility_growth", 0.5))

    if action == "expand":
        return u_growth * (1.2 - pollution) + u_food * (species_prey / 50.0) - food * 0.1
    if action == "fortify":
        return u_sec * (0.8 + pollution) + float(civ.get("aggression", 0.3)) * -0.2
    if action == "trade":
        return u_food * (2.0 - food) + u_growth * 0.3
    if action == "war":
        return float(civ.get("aggression", 0.3)) * 1.5 + u_sec * -0.4 + float(civ.get("tech", 0.3)) * 0.5
    return 0.0


def war_probability(a: dict[str, Any], b: dict[str, Any], pollution: float) -> float:
    """Sigmoid of aggression + resource pressure - distance penalty."""
    dx = int(a["x"]) - int(b["x"])
    dy = int(a["y"]) - int(b["y"])
    dist = math.sqrt(dx * dx + dy * dy) + 1.0
    pressure = (float(a.get("aggression", 0.3)) + float(b.get("aggression", 0.3))) * 0.5
    wealth_gap = abs(float(a.get("wealth", 0)) - float(b.get("wealth", 0))) / 100.0
    score = pressure + wealth_gap * 0.3 + pollution * 0.4 - dist * 0.05
    return 1.0 / (1.0 + math.exp(-score * 3.0))


def step_civilizations(
    civs: list[dict[str, Any]],
    *,
    markets: dict[str, dict[str, float]],
    pollution_mean: float,
    herbivores: float,
    injected_traits: list[dict[str, Any]] | None = None,
    rng: SeededRNG,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    events: list[dict[str, Any]] = []
    context = {
        "food_price": float((markets.get("food") or {}).get("price", 1.0)),
        "pollution": pollution_mean,
        "herbivores": herbivores,
    }

    aggression_boost = 0.0
    for inj in injected_traits or []:
        traits = inj.get("traits") or {}
        aggression_boost += float(traits.get("aggression", 0.0)) * 0.1
        if aggression_boost:
            events.append(
                {
                    "type": "civ.injection_effect",
                    "cause": f"element:{inj.get('name', 'unknown')}",
                    "effect": {"aggression_boost": aggression_boost},
                }
            )

    updated: list[dict[str, Any]] = []
    actions = ("expand", "fortify", "trade", "war")

    for civ in civs:
        c = dict(civ)
        c["aggression"] = min(1.0, float(c.get("aggression", 0.3)) + aggression_boost)
        scores = {act: _utility(c, act, context) for act in actions}
        best = max(scores, key=scores.get)
        # Softmax-ish stochastic pick biased to best (deterministic via rng)
        weights = [math.exp(scores[a]) for a in actions]
        total = sum(weights) or 1.0
        pick = rng.random()
        cumulative = 0.0
        chosen = best
        for act, w in zip(actions, weights):
            cumulative += w / total
            if pick <= cumulative:
                chosen = act
                break

        c["last_action"] = chosen
        if chosen == "expand":
            c["population"] = float(c["population"]) * 1.03
            c["wealth"] = float(c["wealth"]) - 2.0
        elif chosen == "fortify":
            c["tech"] = min(1.0, float(c["tech"]) + 0.01)
        elif chosen == "trade":
            c["wealth"] = float(c["wealth"]) + 3.0
        elif chosen == "war":
            c["wealth"] = float(c["wealth"]) - 5.0

        events.append(
            {
                "type": "civ.decision",
                "cause": f"utility:{chosen}",
                "effect": {"civ_id": c["id"], "action": chosen, "scores": scores},
            }
        )
        updated.append(c)

    # Pairwise war checks
    for i in range(len(updated)):
        for j in range(i + 1, len(updated)):
            p_war = war_probability(updated[i], updated[j], pollution_mean)
            if updated[i].get("last_action") == "war" or updated[j].get("last_action") == "war":
                p_war = min(1.0, p_war + 0.2)
            roll = rng.random()
            if roll < p_war * 0.15:  # rare but possible
                loser = updated[i] if updated[i]["population"] < updated[j]["population"] else updated[j]
                winner = updated[j] if loser is updated[i] else updated[i]
                loser["population"] = max(10.0, float(loser["population"]) * 0.85)
                winner["wealth"] = float(winner["wealth"]) + 5.0
                events.append(
                    {
                        "type": "civ.war",
                        "cause": f"war_probability:{p_war:.4f}",
                        "effect": {
                            "attacker": winner["id"],
                            "defender": loser["id"],
                            "p_war": p_war,
                        },
                    }
                )

    return updated, events
