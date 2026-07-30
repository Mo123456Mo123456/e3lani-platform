from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import ElementCategory, ElementTraits, Locale, StructuredElement
from app.providers.base import ElementProvider
from app.validation import clamp, normalize_text, unique_preserve_order


@dataclass(frozen=True)
class KeywordRule:
    category: ElementCategory
    keywords: tuple[str, ...]


CATEGORY_RULES: tuple[KeywordRule, ...] = (
    KeywordRule("creature", ("creature", "animal", "beast", "predator", "bird", "fish", "كائن", "مخلوق", "حيوان", "وحش", "طائر", "سمكة")),
    KeywordRule("plant", ("plant", "tree", "forest", "flower", "algae", "moss", "seed", "نبات", "شجرة", "زهرة", "طحلب", "بذرة")),
    KeywordRule("energy", ("energy", "power", "solar", "battery", "electric", "طاقة", "كهرباء", "شمسي")),
    KeywordRule("resource", ("resource", "mineral", "metal", "water", "crystal", "ore", "مورد", "معدن", "ماء", "بلورة", "خام")),
    KeywordRule("disease", ("disease", "virus", "plague", "infection", "مرض", "فيروس", "وباء", "عدوى")),
    KeywordRule("climate_phenomenon", ("climate", "storm", "rain", "wind", "heat", "snow", "مناخ", "عاصفة", "مطر", "رياح", "حرارة", "ثلج")),
    KeywordRule("civilization", ("civilization", "tribe", "kingdom", "society", "حضارة", "قبيلة", "مملكة", "مجتمع")),
    KeywordRule("city", ("city", "village", "settlement", "مدينة", "قرية", "مستوطنة")),
    KeywordRule("technology", ("technology", "machine", "robot", "engine", "تقنية", "آلة", "روبوت", "محرك")),
    KeywordRule("invention", ("invention", "device", "tool", "invent", "اختراع", "جهاز", "أداة")),
    KeywordRule("natural_law", ("law", "gravity", "physics", "rule", "قانون", "جاذبية", "فيزياء")),
    KeywordRule("disaster", ("disaster", "earthquake", "volcano", "meteor", "كارثة", "زلزال", "بركان", "نيزك")),
    KeywordRule("alliance", ("alliance", "treaty", "pact", "تحالف", "معاهدة", "اتفاق")),
    KeywordRule("culture", ("culture", "ritual", "art", "music", "ثقافة", "طقس", "فن", "موسيقى")),
    KeywordRule("language", ("language", "dialect", "script", "لغة", "لهجة", "كتابة")),
    KeywordRule("transport", ("transport", "ship", "road", "train", "نقل", "سفينة", "طريق", "قطار")),
)

BIOME_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ocean", ("ocean", "sea", "reef", "بحر", "محيط", "شعاب")),
    ("coast", ("coast", "shore", "beach", "ساحل", "شاطئ")),
    ("rainforest", ("rainforest", "jungle", "غابة مطيرة", "أدغال")),
    ("temperate_forest", ("forest", "woodland", "غابة")),
    ("desert", ("desert", "dune", "sand", "صحراء", "رمل", "كثبان")),
    ("mountain", ("mountain", "peak", "cave", "جبل", "قمة", "كهف")),
    ("tundra", ("tundra", "تندرا")),
    ("wetland", ("wetland", "swamp", "marsh", "مستنقع", "أهوار")),
    ("steppe", ("steppe", "grassland", "سهب", "مروج")),
    ("volcanic", ("volcanic", "lava", "volcano", "بركاني", "حمم", "بركان")),
    ("ice", ("ice", "frozen", "snow", "جليد", "متجمد", "ثلج")),
)

STOPWORDS = {
    "create",
    "make",
    "add",
    "introduce",
    "please",
    "a",
    "an",
    "the",
    "and",
    "with",
    "that",
    "أنشئ",
    "اصنع",
    "أضف",
    "من",
    "في",
    "على",
    "و",
    "الذي",
    "التي",
}


class SandboxProvider(ElementProvider):
    """Deterministic heuristic parser used when no configured AI key is available."""

    provider_name = "sandbox"
    is_sandbox = True

    def parse_element(
        self,
        text: str,
        locale: Locale,
        category_hint: ElementCategory | None = None,
    ) -> StructuredElement:
        normalized = normalize_text(text)
        lowered = normalized.lower()
        category = category_hint or self._detect_category(lowered)
        traits = self._build_traits(lowered, category)
        biomes = self._detect_biomes(lowered, category)
        risks = self._detect_risks(lowered, category, locale)
        benefits = self._detect_benefits(lowered, category, locale)
        name = self._extract_name(normalized, locale, category)

        return StructuredElement(
            category=category,
            name=name,
            nameAr=name if locale == "ar" else None,
            nameEn=name if locale == "en" else self._english_category_name(category),
            description=normalized,
            traits=traits,
            possibleBiomes=biomes,
            risks=risks,
            benefits=benefits,
            balanceScore=self._score_balance(traits, risks),
            wasBalanced=False,
            balanceNotes=["Parsed by deterministic sandbox heuristics."],
        )

    def _detect_category(self, lowered: str) -> ElementCategory:
        scores: dict[ElementCategory, int] = {}
        for rule in CATEGORY_RULES:
            scores[rule.category] = sum(1 for keyword in rule.keywords if keyword.lower() in lowered)
        best_category, best_score = max(scores.items(), key=lambda item: item[1])
        return best_category if best_score > 0 else "custom"

    def _build_traits(self, lowered: str, category: ElementCategory) -> ElementTraits:
        traits = {
            "size": 0.5,
            "growthRate": 0.5,
            "waterNeed": 0.5,
            "heatResistance": 0.5,
            "coldResistance": 0.5,
        }
        if category in ("creature", "civilization"):
            traits["intelligence"] = 0.55
            traits["fertility"] = 0.45
        if category == "plant":
            traits["growthRate"] = 0.6
            traits["waterNeed"] = 0.6
            traits["fertility"] = 0.55
        if category == "energy":
            traits["energyOutput"] = 0.7
        if category == "disease":
            traits["growthRate"] = 0.75
            traits["adaptability"] = 0.7

        keyword_adjustments = (
            (("giant", "huge", "massive", "عملاق", "ضخم"), "size", 0.85),
            (("tiny", "small", "صغير", "دقيق"), "size", 0.25),
            (("fast", "rapid", "quick", "سريع", "بسرعة"), "growthRate", 0.8),
            (("slow", "بطيء"), "growthRate", 0.3),
            (("dry", "drought", "desert", "جاف", "جفاف", "صحراء"), "waterNeed", 0.25),
            (("water", "rain", "river", "ماء", "مطر", "نهر"), "waterNeed", 0.75),
            (("heat", "fire", "lava", "حرارة", "نار", "حمم"), "heatResistance", 0.85),
            (("ice", "cold", "snow", "جليد", "برد", "ثلج"), "coldResistance", 0.85),
            (("aggressive", "predator", "weapon", "violent", "مفترس", "عدواني", "سلاح"), "aggression", 0.8),
            (("peaceful", "gentle", "مسالم", "لطيف"), "aggression", 0.15),
            (("smart", "intelligent", "wise", "ذكي", "حكيم"), "intelligence", 0.8),
            (("pollution", "toxin", "smog", "تلوث", "سم", "دخان"), "pollutionAbsorption", 0.75),
            (("absorb pollution", "eats pollution", "ينظف التلوث", "يمتص التلوث"), "pollutionAbsorption", 0.9),
            (("glow", "light", "luminous", "ضياء", "مضيء", "مضيئ", "نور"), "nightLuminosity", 0.8),
            (("energy", "power", "electric", "طاقة", "كهرباء"), "energyOutput", 0.8),
            (("reproduce", "fertile", "spawns", "يتكاثر", "خصب"), "fertility", 0.85),
            (("adapt", "survive", "resilient", "يتكيف", "ينجو", "مرن"), "adaptability", 0.8),
        )
        for keywords, trait, value in keyword_adjustments:
            if any(keyword in lowered for keyword in keywords):
                traits[trait] = value

        return ElementTraits(**{key: clamp(value) for key, value in traits.items()})

    def _detect_biomes(self, lowered: str, category: ElementCategory) -> list[str]:
        biomes: list[str] = []
        for biome, keywords in BIOME_KEYWORDS:
            if any(keyword in lowered for keyword in keywords):
                biomes.append(biome)
        if biomes:
            return unique_preserve_order(biomes)
        defaults = {
            "plant": ["plains", "temperate_forest"],
            "creature": ["plains"],
            "energy": ["desert", "plains"],
            "climate_phenomenon": ["plains", "ocean"],
            "resource": ["mountain", "plains"],
            "disease": ["city", "plains"],
        }
        # "city" is not a biome, so disease falls back to plains only through validation-safe list.
        return [biome for biome in defaults.get(category, ["plains"]) if biome != "city"]

    def _detect_risks(self, lowered: str, category: ElementCategory, locale: Locale) -> list[str]:
        risks: list[str] = []
        messages = {
            "aggression": ("May increase conflict risk.", "قد يزيد خطر الصراع."),
            "pollution": ("Could disrupt local pollution balance.", "قد يغير توازن التلوث المحلي."),
            "disease": ("May spread if not constrained by the simulator.", "قد ينتشر إذا لم تقيده المحاكاة."),
            "energy": ("High energy output may destabilize nearby systems.", "إنتاج الطاقة العالي قد يزعزع الأنظمة القريبة."),
            "reproduction": ("Rapid reproduction can pressure resources.", "التكاثر السريع قد يضغط على الموارد."),
        }
        if any(word in lowered for word in ("aggressive", "predator", "weapon", "مفترس", "عدواني", "سلاح")):
            risks.append(messages["aggression"][0 if locale == "en" else 1])
        if any(word in lowered for word in ("pollution", "toxin", "smog", "تلوث", "سم", "دخان")):
            risks.append(messages["pollution"][0 if locale == "en" else 1])
        if category == "disease":
            risks.append(messages["disease"][0 if locale == "en" else 1])
        if any(word in lowered for word in ("infinite energy", "huge energy", "طاقة لا نهائية", "طاقة هائلة")):
            risks.append(messages["energy"][0 if locale == "en" else 1])
        if any(word in lowered for word in ("reproduce", "spawns", "يتكاثر")):
            risks.append(messages["reproduction"][0 if locale == "en" else 1])
        return unique_preserve_order(risks)

    def _detect_benefits(self, lowered: str, category: ElementCategory, locale: Locale) -> list[str]:
        benefits: list[str] = []
        messages = {
            "pollution": ("Can reduce or transform pollution.", "يمكنه تقليل التلوث أو تحويله."),
            "light": ("Adds nighttime visibility.", "يضيف رؤية ليلية."),
            "energy": ("Provides a new energy source.", "يوفر مصدر طاقة جديدا."),
            "plant": ("Supports habitats and food chains.", "يدعم الموائل والسلاسل الغذائية."),
            "culture": ("Adds social variety to the world.", "يضيف تنوعا اجتماعيا للعالم."),
            "resource": ("Adds material value for simulation systems.", "يضيف قيمة مادية لأنظمة المحاكاة."),
        }
        if any(word in lowered for word in ("pollution", "clean", "absorb", "تلوث", "ينظف", "يمتص")):
            benefits.append(messages["pollution"][0 if locale == "en" else 1])
        if any(word in lowered for word in ("glow", "light", "luminous", "ضياء", "مضيء", "مضيئ", "نور")):
            benefits.append(messages["light"][0 if locale == "en" else 1])
        if category == "energy" or any(word in lowered for word in ("energy", "power", "طاقة")):
            benefits.append(messages["energy"][0 if locale == "en" else 1])
        if category == "plant":
            benefits.append(messages["plant"][0 if locale == "en" else 1])
        if category in ("culture", "language"):
            benefits.append(messages["culture"][0 if locale == "en" else 1])
        if category == "resource":
            benefits.append(messages["resource"][0 if locale == "en" else 1])
        if not benefits:
            benefits.append("Adds a new simulated element." if locale == "en" else "يضيف عنصرا جديدا للمحاكاة.")
        return unique_preserve_order(benefits)

    def _extract_name(self, normalized: str, locale: Locale, category: ElementCategory) -> str:
        quoted = re.findall(r"[\"'“”‘’](.{2,60}?)[\"'“”‘’]", normalized)
        if quoted:
            return quoted[0].strip()[:80]
        words = [word.strip(".,،:;!?()[]{}") for word in normalized.split()]
        useful = [word for word in words if word and word.lower() not in STOPWORDS]
        if not useful:
            return self._arabic_category_name(category) if locale == "ar" else self._english_category_name(category)
        return " ".join(useful[:5])[:80]

    def _score_balance(self, traits: ElementTraits, risks: list[str]) -> float:
        values = [value for value in traits.model_dump().values() if isinstance(value, (int, float))]
        high_traits = sum(1 for value in values if value > 0.8)
        risk_penalty = min(0.3, len(risks) * 0.08)
        return clamp(0.75 - (high_traits * 0.06) - risk_penalty)

    def _english_category_name(self, category: ElementCategory) -> str:
        return category.replace("_", " ").title()

    def _arabic_category_name(self, category: ElementCategory) -> str:
        names = {
            "creature": "كائن جديد",
            "plant": "نبات جديد",
            "resource": "مورد جديد",
            "civilization": "حضارة جديدة",
            "city": "مدينة جديدة",
            "invention": "اختراع جديد",
            "technology": "تقنية جديدة",
            "disease": "مرض جديد",
            "climate_phenomenon": "ظاهرة مناخية",
            "natural_law": "قانون طبيعي",
            "disaster": "كارثة",
            "alliance": "تحالف",
            "culture": "ثقافة",
            "language": "لغة",
            "transport": "وسيلة نقل",
            "energy": "مصدر طاقة",
            "custom": "عنصر مخصص",
        }
        return names[category]
