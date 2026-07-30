"""Deterministic sandbox provider.

Rule-based Arabic/English text analysis that maps free-form ideas to
the structured contribution contract. Clearly marked ``sandbox=True``:
in production this is the documented fallback, never disguised as a
real LLM.
"""
from __future__ import annotations

import re
from typing import Any

from ..schemas import CATEGORY_TRAIT_SPEC, StructuredContribution

_CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("plant", ["شجرة", "نبات", "عشب", "زهرة", "غابة", "plant", "tree", "flora", "flower", "forest"]),
    ("creature", ["مخلوق", "حيوان", "وحش", "طائر", "سمكة", "زاحف", "مفترس", "creature", "animal", "beast", "bird", "dragon", "species", "predator", "insect", "reptile"]),
    ("resource", ["مورد", "معدن", "ذهب", "نفط", "كريستال", "بلور", "resource", "mineral", "crystal", "ore", "metal", "oil"]),
    ("civilization", ["حضارة", "إمبراطورية", "مملكة", "قبيلة", "شعب", "civilization", "empire", "kingdom", "tribe", "nation"]),
    ("invention", ["اختراع", "تقنية", "تكنولوجيا", "آلة", "محرك", "invention", "technology", "machine", "device", "engine"]),
    ("natural_phenomenon", ["ظاهرة", "مناخ", "عاصفة", "مطر", "بركان", "زلزال", "phenomenon", "storm", "rain", "volcano", "climate", "aurora"]),
    ("disease", ["مرض", "وباء", "فيروس", "طاعون", "disease", "plague", "virus", "epidemic"]),
    ("culture", ["ثقافة", "لغة", "دين", "فن", "موسيقى", "culture", "language", "religion", "art", "music"]),
    ("world_law", ["قانون عالمي", "قانون طبيعي", "فيزياء", "جاذبية", "world law", "law of nature", "physics", "gravity"]),
]

_TRAIT_RULES: list[tuple[str, str, float]] = [
    # (keyword, trait, value)
    ("عملاق|ضخم|هائل|giant|huge|massive|colossal", "size", 0.9),
    ("صغير|دقيق|small|tiny", "size", 0.15),
    ("سريع النمو|يتكاثر بسرعة|fast.growing|rapid", "growthRate", 0.8),
    ("بطيء|slow", "growthRate", 0.2),
    ("التلوث|ينقي الهواء|pollution|absorb", "pollutionAbsorption", 0.9),
    ("يضيء|تضيء|مضيء|يضيئ|يتوهج|متوهج|glow|glowing|luminous|shine", "nightLuminosity", 0.8),
    ("البرد|الجليد|cold|frost|ice", "coldResistance", 0.85),
    ("الحرارة|الصحراء|الحر|heat|hot", "heatResistance", 0.85),
    ("الماء|الأنهار|ماء|water", "waterNeed", 0.75),
    ("الطاقة الشمسية|طاقة|solar|energy", "energyStorage", 0.75),
    ("سام|toxic|venom|poison", "toxicity", 0.7),
    ("عدواني|مفترس|شرس|aggressive|predator|fierce", "aggression", 0.8),
    ("ذكي|عاقل|intelligent|smart", "intelligence", 0.8),
    ("طائر|يطير|fly|flying|wing", "speed", 0.85),
    ("نادر|rare", "abundance", 0.2),
    ("وفير|منتشر|abundant|common", "abundance", 0.85),
    ("متجدد|renewable", "renewable", 0.8),
    ("ثمين|قيّم|valuable|precious", "value", 0.85),
    ("معدني|mining|منجم", "envImpact", 0.6),
    ("مطري|أمطار|rain", "rainfulness", 0.7),
    ("دافئ|warm", "warmth", 0.6),
    ("بارد|coldness", "coldness", 0.6),
    ("قاتل|deadly|lethal", "severity", 0.7),
    ("معدي|contagious|infectious", "transmission", 0.75),
    ("سلمي|peaceful", "aggression", 0.15),
]

_BIOME_KEYWORDS: list[tuple[str, str]] = [
    ("غابة مطيرة|rainforest", "rainforest"),
    ("غابة|forest", "temperate_forest"),
    ("صحراء|desert", "desert"),
    ("جبل|جبال|mountain", "mountain"),
    ("سهل|سهول|plain", "plains"),
    ("مستنقع|swamp", "swamp"),
    ("جليد|قطب|ice|polar", "ice"),
    ("سافانا|savanna", "savanna"),
    ("بركان|volcan", "volcanic"),
]

_NAME_PATTERNS = [
    r"(?:اسمها|اسمه|تسمى|يسمى|أطلق عليها)\s+[\"«]?([^\"».,؛\n]{2,60})",
    r"(?:called|named|name it)\s+[\"']?([^\"'.,\n]{2,60})",
    r"[\"«]([^\"»\n]{2,60})[\"»]",
]

_RISK_BY_TRAIT = {
    "waterNeed": (0.7, "high_water_consumption"),
    "growthRate": (0.75, "ecosystem_competition"),
    "spreadRate": (0.7, "invasive_spread"),
    "aggression": (0.7, "predation_pressure"),
    "toxicity": (0.6, "toxicity_spillover"),
    "pollutionAbsorption": (0.8, "soil_chemistry_shift"),
    "energyStorage": (0.7, "energy_dependence"),
    "envImpact": (0.6, "extraction_damage"),
    "severity": (0.6, "mortality_risk"),
    "transmission": (0.6, "pandemic_risk"),
}


class MockProvider:
    name = "mock"

    def configured(self) -> bool:
        return True

    def parse_contribution(self, text: str, locale: str, category: str | None) -> StructuredContribution:
        lowered = text.lower()
        cat = category or self._detect_category(lowered)
        traits: dict[str, float | str] = {}
        for pattern, trait, value in _TRAIT_RULES:
            if trait in CATEGORY_TRAIT_SPEC[cat] and re.search(pattern, lowered, re.IGNORECASE):
                traits[trait] = value
        if cat == "creature":
            if re.search("لاحم|آكل لحوم|carnivore", lowered):
                traits["diet"] = "carnivore"
            elif re.search("قارت|omnivore", lowered):
                traits["diet"] = "omnivore"
            else:
                traits.setdefault("diet", "herbivore")
        name = self._extract_name(text)
        biomes = [b for pat, b in _BIOME_KEYWORDS if re.search(pat, lowered, re.IGNORECASE)]
        if not biomes:
            biomes = {"plant": ["temperate_forest", "rainforest"],
                      "creature": ["grassland", "savanna"],
                      "resource": ["mountain"],
                      "natural_phenomenon": [],
                      }.get(cat, [])
        spec = CATEGORY_TRAIT_SPEC[cat]
        merged = {k: traits.get(k, default) for k, (_, _, default) in spec.items()}
        merged.update({k: v for k, v in traits.items() if isinstance(v, str)})
        risks = [risk for trait, (threshold, risk) in _RISK_BY_TRAIT.items()
                 if isinstance(merged.get(trait), (int, float)) and merged[trait] >= threshold]
        return StructuredContribution(
            category=cat, name=name, description=text[:400],
            traits=merged, possibleBiomes=biomes, risks=sorted(set(risks)),
            provider=self.name, sandbox=True,
        )

    def _detect_category(self, text: str) -> str:
        for cat, keywords in _CATEGORY_KEYWORDS:
            if any(k in text for k in keywords):
                return cat
        return "custom"

    def _extract_name(self, text: str) -> str:
        for pattern in _NAME_PATTERNS:
            m = re.search(pattern, text)
            if m:
                raw = m.group(1).strip()
                raw = re.split(r"\s+(?:that|which|who|is|are|was|were|with|the|a|an)\s+",
                               raw, maxsplit=1, flags=re.IGNORECASE)[0]
                raw = re.split(r"\s+(?:التي|الذي|اللذين|هو|هي|من|في|على)\s+", raw, maxsplit=1)[0]
                words = raw.split()[:4]
                if words:
                    return " ".join(words)[:60]
        words = [w for w in re.split(r"\s+", text.strip()) if len(w) > 1]
        return " ".join(words[:4])[:60] if words else "عنصر مجهول"

    # ------------------------------------------------------------------
    def narrate(self, events: list[dict[str, Any]], locale: str) -> str:
        from ..narrative import template_narrative
        return template_narrative(events, locale)
