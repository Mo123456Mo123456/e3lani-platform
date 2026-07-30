"""Cellular-automata style climate and pollution diffusion."""

from __future__ import annotations

from typing import Any

import numpy as np

from .rng import SeededRNG


def diffuse(field: np.ndarray, rate: float = 0.2) -> np.ndarray:
    """Average each cell with its 4-neighbors (toroidal wrap)."""
    up = np.roll(field, -1, axis=0)
    down = np.roll(field, 1, axis=0)
    left = np.roll(field, -1, axis=1)
    right = np.roll(field, 1, axis=1)
    neighbor_avg = (up + down + left + right) * 0.25
    return field * (1.0 - rate) + neighbor_avg * rate


def step_climate(
    temperature: np.ndarray,
    moisture: np.ndarray,
    pollution: np.ndarray,
    *,
    industrial_output: float = 0.0,
    injected_traits: list[dict[str, Any]] | None = None,
    rng: SeededRNG | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[dict[str, Any]]]:
    """One climate tick: diffuse heat/moisture/pollution and apply sources."""
    events: list[dict[str, Any]] = []

    temp = diffuse(temperature, rate=0.15)
    moist = diffuse(moisture, rate=0.18)
    poll = diffuse(pollution, rate=0.25)

    # Industrial pollution source (spread evenly as baseline)
    poll = poll + industrial_output * 0.002

    warming = 0.0
    for inj in injected_traits or []:
        traits = inj.get("traits") or {}
        greenhouse = float(traits.get("greenhouse", 0.0))
        cleanup = float(traits.get("cleanup", 0.0))
        arid = float(traits.get("aridity", 0.0))
        warming += greenhouse * 0.01
        poll = poll * (1.0 - cleanup * 0.05)
        moist = moist - arid * 0.01
        events.append(
            {
                "type": "climate.injection_effect",
                "cause": f"element:{inj.get('name', 'unknown')}",
                "effect": {
                    "greenhouse": greenhouse,
                    "cleanup": cleanup,
                    "aridity": arid,
                },
            }
        )

    temp = temp + warming + float(np.mean(poll)) * 0.005

    # Natural decay of pollution
    poll = np.maximum(poll * 0.98, 0.0)

    if rng is not None and rng.random() < 0.05:
        # Rare storm: boost moisture in a patch
        h, w = moist.shape
        cy, cx = rng.randint(0, h - 1), rng.randint(0, w - 1)
        y0, y1 = max(0, cy - 2), min(h, cy + 3)
        x0, x1 = max(0, cx - 2), min(w, cx + 3)
        moist[y0:y1, x0:x1] += 0.08
        events.append(
            {
                "type": "climate.storm",
                "cause": "stochastic_weather",
                "effect": {"center": [cy, cx], "moisture_boost": 0.08},
            }
        )

    if float(np.mean(poll)) > 0.35:
        events.append(
            {
                "type": "climate.pollution_crisis",
                "cause": "high_mean_pollution",
                "effect": {"mean_pollution": float(np.mean(poll))},
            }
        )

    return temp, moist, poll, events
