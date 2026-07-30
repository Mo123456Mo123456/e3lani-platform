"""AI Orchestrator — provider adapters + structured analysis + narrative from facts only."""
from __future__ import annotations

import os
import re
from typing import Any, Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

app = FastAPI(title="Planet AI Orchestrator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Category = Literal[
    "creature",
    "plant",
    "resource",
    "civilization",
    "city",
    "invention",
    "technology",
    "disease",
    "climate_phenomenon",
    "natural_law",
    "disaster",
    "alliance",
    "culture",
    "language",
    "transport",
    "energy_source",
    "custom",
]

OVERPOWERED = [
    re.compile(r"لا\s*يموت|immortal|invincible", re.I),
    re.compile(r"غير\s*محدود|unlimited|infinite", re.I),
    re.compile(r"يدمر\s*(الكوكب|العالم)|destroy\s*(planet|world)", re.I),
    re.compile(r"سيطرة\s*مطلقة|omnipotent", re.I),
]


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    category: Category | None = None
    locale: Literal["ar", "en"] = "ar"


class StructuredElement(BaseModel):
    category: Category
    name: str
    nameAr: str | None = None
    description: str | None = None
    traits: dict[str, float]
    possibleBiomes: list[str]
    risks: list[str] = []
    benefits: list[str] = []
    balanceScore: float | None = None
    balanced: bool = True
    balanceNotes: list[str] = []

    @field_validator("traits")
    @classmethod
    def clamp_traits(cls, v: dict[str, float]) -> dict[str, float]:
        return {k: max(0.0, min(1.0, float(val))) for k, val in v.items()}


class AnalyzeOut(BaseModel):
    structured: StructuredElement
    narrative: str
    narrativeAr: str
    provider: str
    sandbox: bool


class ProviderAdapter:
    name: str

    def analyze(self, text: str, category: Category | None) -> StructuredElement:
        raise NotImplementedError


class SandboxProvider(ProviderAdapter):
    name = "sandbox"

    def analyze(self, text: str, category: Category | None) -> StructuredElement:
        cat = category or detect_category(text)
        traits = {
            "size": score(text, [r"عملاق|giant|huge"], [r"صغير|tiny"], 0.5),
            "growthRate": score(text, [r"سريع|fast|rapid"], [r"بطيء|slow"], 0.4),
            "waterNeed": score(text, [r"ماء|water"], [r"صحراء|desert"], 0.5),
            "pollutionAbsorption": score(text, [r"تلوث|pollution|يمتص|تمتص|تنقية"], [], 0.1),
            "nightLuminosity": score(text, [r"يضيء|light|glow|ليل"], [], 0.05),
            "coldResistance": score(text, [r"برد|cold|ثلج"], [], 0.4),
            "heatResistance": score(text, [r"حر|heat|شمس"], [], 0.4),
            "intelligence": score(text, [r"ذكي|smart|intelligent"], [], 0.3),
            "aggression": score(text, [r"عدوان|حرب|war|مفترس"], [r"سلمي"], 0.3),
            "reproduction": score(text, [r"تكاثر|breed"], [], 0.4),
            "adaptability": score(text, [r"تكيف|adapt"], [], 0.5),
        }
        biomes = infer_biomes(text, cat, traits)
        risks, benefits = [], []
        if traits["waterNeed"] > 0.7:
            risks.append("high_water_consumption")
        if traits["aggression"] > 0.7:
            risks.append("conflict_escalation")
        if traits["reproduction"] > 0.85:
            risks.append("ecosystem_competition")
        if traits["pollutionAbsorption"] > 0.5:
            benefits.append("pollution_reduction")
        if traits["nightLuminosity"] > 0.4:
            benefits.append("night_illumination")
        name = extract_name(text, cat)
        el = StructuredElement(
            category=cat,
            name=name,
            nameAr=name,
            description=text[:500],
            traits=traits,
            possibleBiomes=biomes,
            risks=risks,
            benefits=benefits,
        )
        return balance(el)


class OpenAIProvider(ProviderAdapter):
    name = "openai"

    def analyze(self, text: str, category: Category | None) -> StructuredElement:
        # Real HTTP call would go here when OPENAI_API_KEY is set.
        # Falls through to sandbox structuring to avoid inventing unvalidated output.
        return SandboxProvider().analyze(text, category)


class AnthropicProvider(ProviderAdapter):
    name = "anthropic"

    def analyze(self, text: str, category: Category | None) -> StructuredElement:
        return SandboxProvider().analyze(text, category)


class GeminiProvider(ProviderAdapter):
    name = "gemini"

    def analyze(self, text: str, category: Category | None) -> StructuredElement:
        return SandboxProvider().analyze(text, category)


PROVIDERS: dict[str, ProviderAdapter] = {
    "sandbox": SandboxProvider(),
    "openai": OpenAIProvider(),
    "anthropic": AnthropicProvider(),
    "gemini": GeminiProvider(),
}


def get_provider() -> tuple[ProviderAdapter, bool]:
    name = os.getenv("AI_PROVIDER", "sandbox")
    sandbox_flag = os.getenv("AI_SANDBOX_MODE", "true").lower() == "true"
    has_key = bool(
        os.getenv("OPENAI_API_KEY")
        or os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )
    if sandbox_flag or not has_key or name == "sandbox":
        return PROVIDERS["sandbox"], True
    return PROVIDERS.get(name, PROVIDERS["sandbox"]), name == "sandbox"


def detect_category(text: str) -> Category:
    rules: list[tuple[Category, str]] = [
        ("plant", r"نبات|شجر|غابة|plant|tree|forest"),
        ("creature", r"مخلوق|حيوان|creature|animal|beast"),
        ("civilization", r"حضارة|مملكة|civilization|kingdom|tribe"),
        ("resource", r"مورد|معدن|resource|metal|ore"),
        ("disease", r"مرض|وباء|disease|plague|virus"),
        ("disaster", r"كارثة|بركان|disaster|volcano"),
        ("invention", r"اختراع|invention|machine"),
        ("technology", r"تقنية|technology"),
        ("energy_source", r"طاقة|energy|solar"),
        ("climate_phenomenon", r"مناخ|عاصفة|climate|storm"),
        ("culture", r"ثقافة|culture"),
        ("alliance", r"تحالف|alliance"),
    ]
    for cat, pat in rules:
        if re.search(pat, text, re.I):
            return cat
    return "custom"


def score(text: str, pos: list[str], neg: list[str], base: float) -> float:
    s = base
    for p in pos:
        if re.search(p, text, re.I):
            s += 0.25
    for n in neg:
        if re.search(n, text, re.I):
            s -= 0.25
    return max(0.0, min(1.0, s))


def infer_biomes(text: str, cat: Category, traits: dict[str, float]) -> list[str]:
    biomes: list[str] = []
    if re.search(r"غابة|شجر|forest|jungle|tree", text, re.I):
        biomes += ["rainforest", "temperate_forest"]
    if re.search(r"صحراء|desert", text, re.I):
        biomes.append("desert")
    if re.search(r"جبل|mountain", text, re.I):
        biomes.append("mountain")
    if re.search(r"ساحل|coast|بحر|ocean", text, re.I):
        biomes += ["coast", "ocean"]
    if re.search(r"ثلج|ice|tundra", text, re.I):
        biomes += ["tundra", "ice"]
    if not biomes:
        if cat == "plant":
            biomes = (
                ["rainforest", "temperate_forest"]
                if traits.get("waterNeed", 0.5) > 0.6
                or traits.get("pollutionAbsorption", 0) > 0.3
                else ["plains", "steppe"]
            )
        else:
            biomes = ["plains", "coast", "temperate_forest"]
    return list(dict.fromkeys(biomes))


def extract_name(text: str, cat: Category) -> str:
    m = re.search(r"[«\"]([^»\"]+)[»\"]", text)
    if m:
        return m.group(1)[:80]
    first = re.split(r"[.。\n،,]", text)[0].strip()
    first = re.sub(r"^أريد إضافة\s*", "", first)
    first = re.sub(r"^i want to add\s*", "", first, flags=re.I)
    if 3 < len(first) < 80:
        return first
    defaults = {
        "plant": "نبات جديد",
        "creature": "مخلوق جديد",
        "civilization": "حضارة جديدة",
        "resource": "مورد جديد",
    }
    return defaults.get(cat, "عنصر جديد")


def balance(el: StructuredElement) -> StructuredElement:
    notes: list[str] = []
    traits = dict(el.traits)
    blob = f"{el.name} {el.description or ''} {' '.join(el.risks)}"
    for p in OVERPOWERED:
        if p.search(blob):
            notes.append("overpowered_pattern_detected")
    if traits.get("reproduction", 0) > 0.9:
        traits["reproduction"] = 0.7
        notes.append("capped_reproduction_to_0.7")
    if traits.get("size", 0) >= 1 and traits.get("aggression", 0) >= 0.95:
        traits["aggression"] = 0.6
        traits["size"] = 0.85
        notes.append("capped_apex_predator_traits")
    if traits.get("energyOutput", 0) > 0.95 and traits.get("waterNeed", 1) < 0.1:
        traits["energyOutput"] = 0.7
        traits["waterNeed"] = 0.4
        notes.append("balanced_energy_requires_resources")
    score_v = max(0.0, min(1.0, 1 - len(notes) * 0.15))
    return el.model_copy(
        update={
            "traits": traits,
            "balanced": len(notes) == 0,
            "balanceNotes": el.balanceNotes + notes,
            "balanceScore": score_v,
            "risks": list(dict.fromkeys(el.risks + [n for n in notes if "overpowered" in n or "capped" in n])),
        }
    )


def narrate(el: StructuredElement) -> tuple[str, str]:
    traits = ", ".join(f"{k}={v:.2f}" for k, v in el.traits.items() if v >= 0.5) or "baseline"
    biomes = ", ".join(el.possibleBiomes)
    risks = ", ".join(el.risks) if el.risks else "none flagged"
    en = (
        f"{el.name} ({el.category}) structured with [{traits}]. "
        f"Biomes: {biomes}. Risks: {risks}. "
        + (
            f"Balance adjustments: {'; '.join(el.balanceNotes)}."
            if el.balanceNotes
            else "Balance check passed."
        )
        + " Narrative is derived only from structured fields — no invented world events."
    )
    ar = (
        f"{el.nameAr or el.name} ({el.category}) بخصائص [{traits}]. "
        f"البيئات: {biomes}. المخاطر: {risks if el.risks else 'لا توجد'}. "
        + (
            f"تعديلات التوازن: {'؛ '.join(el.balanceNotes)}."
            if el.balanceNotes
            else "اجتاز فحص التوازن."
        )
        + " السرد مستمد فقط من الحقول المنظمة — بلا أحداث مخترعة."
    )
    return en, ar


@app.get("/health")
def health() -> dict[str, Any]:
    provider, sandbox = get_provider()
    return {"ok": True, "provider": provider.name, "sandbox": sandbox}


@app.post("/analyze", response_model=AnalyzeOut)
def analyze(body: AnalyzeIn) -> AnalyzeOut:
    provider, sandbox = get_provider()
    structured = provider.analyze(body.text, body.category)
    en, ar = narrate(structured)
    return AnalyzeOut(
        structured=structured,
        narrative=en,
        narrativeAr=ar,
        provider=provider.name if not sandbox else "sandbox",
        sandbox=sandbox,
    )


@app.post("/narrate")
def narrate_endpoint(payload: dict[str, Any]) -> dict[str, str]:
    """Narrate only from provided simulation facts — refuses extra invention."""
    facts = payload.get("facts", [])
    if not isinstance(facts, list):
        facts = []
    lines_en = [str(f.get("title", f)) for f in facts[:20]]
    lines_ar = [str(f.get("titleAr", f.get("title", f))) for f in facts[:20]]
    return {
        "narrative": "Simulation facts: " + ("; ".join(lines_en) or "none"),
        "narrativeAr": "حقائق المحاكاة: " + ("؛ ".join(lines_ar) or "لا يوجد"),
        "provider": "sandbox",
    }
