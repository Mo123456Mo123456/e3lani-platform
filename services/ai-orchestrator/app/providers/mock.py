"""Deterministic heuristic provider (Arabic + English).

This is the always-available sandbox: it does real rule-based extraction —
keyword categories, trait bumps, biome inference, risk derivation — and is
honestly labeled "mock". It never pretends to be an LLM.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

from ..schemas import Biome, Category, StructuredContribution

CATEGORY_PATTERNS = [
    (re.compile(r"شجر|نبات|زهرة|عشب|غابة|plant|tree|flower|forest|crop", re.I), Category.plant),
    (re.compile(r"مخلوق|كائن|حيوان|وحش|طائر|سمكة|creature|animal|beast|bird", re.I), Category.creature),
    (re.compile(r"حضارة|إمبراطورية|مملكة|قبيلة|شعب|civilization|empire|kingdom|tribe", re.I), Category.civilization),
    (re.compile(r"اختراع|جهاز|آلة|تقنية|تكنولوجيا|invention|device|machine|technology", re.I), Category.invention),
    (re.compile(r"مورد|ذهب|حديد|نفط|فحم|معدن|كريستال|resource|gold|iron|oil|coal|crystal|mineral", re.I), Category.resource),
    (re.compile(r"مرض|وباء|طاعون|فيروس|disease|plague|virus|pandemic", re.I), Category.disease),
    (re.compile(r"بركان|عاصفة|زلزال|ظاهرة|مناخ|volcano|storm|earthquake|phenomenon|climate", re.I), Category.phenomenon),
    (re.compile(r"ثقافة|عادة|تقليد|فن|موسيقى|culture|tradition|art|music", re.I), Category.culture),
    (re.compile(r"قانون|دستور|حكم|law|constitution|edict", re.I), Category.law),
]

# effect: ("set", value) takes the max; ("bump", delta) adds to the default 0.4
TRAIT_RULES = [
    (re.compile(r"عملاق|ضخم|كبير|giant|huge|massive|colossal", re.I), {"size": ("bump", 0.35)}, None),
    (re.compile(r"صغير|دقيق|tiny|small|micro", re.I), {"size": ("bump", -0.2)}, None),
    (re.compile(r"سريع الانتشار|ينتشر|يتكاثر|spreads|multiplies|reproduc", re.I), {"growthRate": ("bump", 0.3), "reproductionRate": ("bump", 0.3)}, None),
    (re.compile(r"التلوث|ينقي الهواء|pollution|absorb", re.I), {"pollutionAbsorption": ("set", 0.85)}, None),
    (re.compile(r"تضيء|مضيء|متوهج|ضوء|glow|luminous|light", re.I), {"nightLuminosity": ("set", 0.7)}, None),
    (re.compile(r"تخزن الطاقة|طاقة شمسية|طاقة|energy|solar", re.I), {"energyStorage": ("set", 0.7)}, "future_resource_conflicts"),
    (re.compile(r"مقاوم للحر|يتحمل الحر|heat.?resist|heat.?tolerant", re.I), {"heatResistance": ("set", 0.8)}, None),
    (re.compile(r"مقاوم للبرد|يتحمل البرد|cold.?resist|frost", re.I), {"coldResistance": ("set", 0.8)}, None),
    (re.compile(r"عطش|مياه كثيرة|thirsty|water", re.I), {"waterNeed": ("bump", 0.3)}, "high_water_consumption"),
    (re.compile(r"سام|سامة|قاتل|toxic|poison|venom|lethal", re.I), {"toxicity": ("set", 0.7)}, "ecosystem_poisoning"),
    (re.compile(r"ذكي|عاقل|intelligent|smart|sentient", re.I), {"intelligence": ("set", 0.7)}, None),
    (re.compile(r"عدواني|مفترس|شرس|aggressive|predator|fierce", re.I), {"aggression": ("set", 0.75)}, "predation_pressure"),
    (re.compile(r"مسالم|لطيف|peaceful|gentle", re.I), {"aggression": ("set", 0.1)}, None),
    (re.compile(r"طويل العمر|يعيش طويلاً|long.?lived|immortal", re.I), {"lifespan": ("set", 0.85)}, None),
    (re.compile(r"طائر|يطير|fly|flying|winged", re.I), {"mobility": ("set", 0.85)}, None),
    (re.compile(r"معدي|شديد العدوى|contagious|infectious", re.I), {"contagiousness": ("set", 0.8)}, None),
    (re.compile(r"خصب|غلال|محصول|fertile|yield|harvest", re.I), {"yield": ("set", 0.75)}, None),
    (re.compile(r"نادر|rare|scarce", re.I), {"rarity": ("set", 0.8)}, None),
    (re.compile(r"قيّم|ثمين|valuable|precious", re.I), {"value": ("set", 0.8)}, None),
]

BIOME_PATTERNS = [
    (re.compile(r"صحراء|رمال|desert|sand", re.I), Biome.desert),
    (re.compile(r"غابة مطيرة|استوائي|rainforest|tropical|jungle", re.I), Biome.rainforest),
    (re.compile(r"غابة|forest|woods", re.I), Biome.temperate_forest),
    (re.compile(r"محيط|بحر|ماء|ocean|sea|marine|aquatic", re.I), Biome.ocean),
    (re.compile(r"ساحل|شاطئ|coast|shore", re.I), Biome.coast),
    (re.compile(r"جبل|جبال|mountain", re.I), Biome.mountains),
    (re.compile(r"تندرا|قطبي|جليد|tundra|arctic|ice|frozen", re.I), Biome.tundra),
    (re.compile(r"سهول|مرج|plain|meadow|grassland", re.I), Biome.plains),
    (re.compile(r"مستنقع|swamp|marsh|wetland", re.I), Biome.swamp),
    (re.compile(r"بركان|volcan", re.I), Biome.volcanic),
    (re.compile(r"سهب|ستيب|steppe", re.I), Biome.steppe),
]

BASELINES: Dict[Category, Dict[str, float]] = {
    Category.plant: {"size": 0.4, "growthRate": 0.35, "waterNeed": 0.5, "pollutionAbsorption": 0.3, "coldResistance": 0.4, "heatResistance": 0.4},
    Category.creature: {"size": 0.4, "reproductionRate": 0.4, "waterNeed": 0.5, "aggression": 0.3, "mobility": 0.4, "adaptability": 0.4, "mutationRate": 0.2, "intelligence": 0.2},
    Category.resource: {"yield": 0.5, "value": 0.6, "rarity": 0.4},
    Category.civilization: {"intelligence": 0.5, "aggression": 0.3, "adaptability": 0.5},
    Category.invention: {"efficiency": 0.4, "yield": 0.3, "energyStorage": 0.3},
    Category.disease: {"severity": 0.4, "contagiousness": 0.4},
    Category.phenomenon: {"severity": 0.4, "warming": 0.1, "wetness": 0.1},
}

FALLBACK_NAMES = {
    Category.plant: ("نبتة", "plant"), Category.creature: ("مخلوق", "creature"),
    Category.resource: ("مورد", "resource"), Category.civilization: ("حضارة", "civilization"),
    Category.invention: ("اختراع", "invention"), Category.phenomenon: ("ظاهرة", "phenomenon"),
    Category.disease: ("وباء", "disease"), Category.culture: ("ثقافة", "culture"),
    Category.law: ("قانون", "law"), Category.custom: ("عنصر", "element"),
}


def _fnv(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


class MockProvider:
    name = "mock"

    async def parse_contribution(
        self, text: str, category: Optional[Category], locale: str
    ) -> StructuredContribution:
        resolved = category
        if resolved is None:
            resolved = Category.custom
            for pattern, cat in CATEGORY_PATTERNS:
                if pattern.search(text):
                    resolved = cat
                    break

        traits: Dict[str, float] = {}
        risks: List[str] = []
        for pattern, effect, risk in TRAIT_RULES:
            if pattern.search(text):
                for key, (mode, value) in effect.items():
                    if mode == "set":
                        traits[key] = max(traits.get(key, 0.0), value)
                    else:
                        base = traits.get(key, 0.4)
                        traits[key] = round(min(1.0, max(0.0, base + value)), 3)
                if risk and risk not in risks:
                    risks.append(risk)

        biomes: List[Biome] = []
        for pattern, biome in BIOME_PATTERNS:
            if pattern.search(text) and biome not in biomes:
                biomes.append(biome)
        if not biomes:
            biomes = [Biome.plains] if resolved != Category.resource else [Biome.mountains]
            if resolved == Category.plant:
                biomes = [Biome.plains, Biome.temperate_forest]

        for key, value in BASELINES.get(resolved, {"adaptability": 0.4, "intelligence": 0.3}).items():
            traits.setdefault(key, value)

        # deterministic jitter: identical text -> identical output
        seed = _fnv(text)
        for key in list(traits):
            jitter = ((seed % 100) - 50) / 2500
            traits[key] = round(min(0.95, max(0.05, traits[key] + jitter)), 3)

        if traits.get("waterNeed", 0) > 0.6 and "high_water_consumption" not in risks:
            risks.append("high_water_consumption")
        if traits.get("reproductionRate", 0) > 0.7:
            risks.append("overpopulation_pressure")

        return StructuredContribution(
            category=resolved,
            name=_extract_name(text, resolved, locale),
            description=text[:600],
            traits=traits,
            possible_biomes=biomes[:6],
            risks=risks[:6],
        )

    async def narrate(self, contribution_name: str, facts: List[str], locale: str) -> str:
        if not facts:
            return (
                f"أُضيف «{contribution_name}» إلى العالم، ولم تتراكم آثاره بعد."
                if locale == "ar"
                else f'"{contribution_name}" entered the world; its effects have not accumulated yet.'
            )
        joined = " ".join(f"- {fact}" for fact in facts[:12])
        header = (
            f"سلسلة الآثار الموثقة لـ«{contribution_name}»:\n"
            if locale == "ar"
            else f'The documented causal chain of "{contribution_name}":\n'
        )
        return header + joined


def _extract_name(text: str, category: Category, locale: str) -> str:
    quoted = re.search(r"[«\"“]([^»\"”]{2,60})[»\"”]", text)
    if quoted:
        return quoted.group(1).strip()
    named = re.search(r"(?:اسم(?:ه|ها)?\s+|called\s+|named\s+)([\w\u0600-\u06FF][\w\u0600-\u06FF\s-]{1,40})", text)
    if named:
        return " ".join(named.group(1).strip().split()[:4])
    first = " ".join(text.strip().split()[:3])
    if len(first) >= 4:
        return first
    ar, en = FALLBACK_NAMES[category]
    return f"{ar if locale == 'ar' else en} {len(text) % 97}"
