"""Deterministic mock/sandbox provider — no external APIs."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from .base import ProviderAdapter

BIOME_KEYWORDS = {
    "ocean": ["ocean", "sea", "marine", "بحر", "محيط"],
    "forest": ["forest", "tree", "wood", "غابة", "شجر"],
    "desert": ["desert", "sand", "صحراء", "رمل"],
    "tundra": ["tundra", "ice", "قطب", "جليد"],
    "mountain": ["mountain", "peak", "جبل"],
    "swamp": ["swamp", "marsh", "مستنقع"],
    "plains": ["plain", "grass", "سهل", "عشب"],
    "coast": ["coast", "shore", "ساحل"],
}


def _stable_unit(prompt: str, key: str) -> float:
    digest = hashlib.sha256(f"{prompt}:{key}".encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 1000) / 1000.0


class MockProvider(ProviderAdapter):
    """Sandbox provider for local/dev use without API keys.

    This is explicitly a mock. It does not claim to be a production LLM.
    """

    name = "mock"
    sandbox = True

    def analyze_element(self, prompt: str, *, language: str = "ar") -> dict[str, Any]:
        text = prompt.strip()
        lower = text.lower()

        category = "custom"
        if any(w in lower for w in ("animal", "beast", "fauna", "حيوان", "كائن")):
            category = "fauna"
        elif any(w in lower for w in ("plant", "flora", "moss", "نبات", "شجر")):
            category = "flora"
        elif any(w in lower for w in ("storm", "weather", "climate", "طقس", "عاصفة")):
            category = "weather"
        elif any(w in lower for w in ("mineral", "crystal", "معدن", "بلور")):
            category = "mineral"
        elif any(w in lower for w in ("tech", "machine", "تقنية", "آلة")):
            category = "technology"

        biomes: list[str] = []
        for biome, keys in BIOME_KEYWORDS.items():
            if any(k in lower for k in keys):
                biomes.append(biome)
        if not biomes:
            biomes = ["plains", "forest"]

        # Derive a short name from the prompt
        words = re.findall(r"[\w\u0600-\u06FF]+", text)
        name = " ".join(words[:3]) if words else "Unnamed Element"
        if language == "ar" and not any("\u0600" <= ch <= "\u06FF" for ch in name):
            name = f"عنصر: {name}"

        traits = {
            "fertility": round(_stable_unit(text, "fertility") * 0.8, 3),
            "toxicity": round(_stable_unit(text, "toxicity") * 0.6, 3),
            "predation": round(_stable_unit(text, "predation") * 0.5, 3),
            "greenhouse": round(_stable_unit(text, "greenhouse") * 0.4, 3),
            "cleanup": round(_stable_unit(text, "cleanup") * 0.5, 3),
            "aggression": round(_stable_unit(text, "aggression") * 0.5, 3),
            "productivity": round(_stable_unit(text, "productivity") * 0.6, 3),
        }

        risks = []
        if traits["toxicity"] > 0.4:
            risks.append("toxic_spread")
        if traits["predation"] > 0.4:
            risks.append("food_web_shock")
        if traits["greenhouse"] > 0.3:
            risks.append("warming")
        if not risks:
            risks.append("localized_impact")

        if language == "ar":
            narrative = (
                f"عنصر محاكاة «{name}» من فئة {category}. "
                f"السمات مستخرجة بشكل حتمي من النص المدخل داخل وضع الصندوق الرملي (mock). "
                f"البيئات المحتملة: {', '.join(biomes)}."
            )
        else:
            narrative = (
                f"Sandbox element '{name}' in category {category}. "
                f"Traits are derived deterministically from the input prompt "
                f"(mock provider, not a production LLM). "
                f"Possible biomes: {', '.join(biomes)}."
            )

        return {
            "category": category,
            "name": name,
            "traits": traits,
            "possibleBiomes": biomes,
            "risks": risks,
            "narrative": narrative,
            "_provider": self.name,
            "_sandbox": True,
        }

    def narrate(self, facts: list[str], *, language: str = "ar") -> str:
        # Strict: only join provided facts — never invent
        cleaned = [f.strip() for f in facts if f and str(f).strip()]
        if not cleaned:
            return ""
        if language == "ar":
            header = "ملخص مبني فقط على الوقائع المقدمة:"
            return header + " " + " | ".join(cleaned)
        header = "Summary strictly from provided facts:"
        return header + " " + " | ".join(cleaned)
