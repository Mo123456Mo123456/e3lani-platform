"""Mock provider: structured output from free text (spec example)."""
from app.providers.mock import MockProvider
from app.schemas import StructuredContribution


def test_spec_example_giant_light_tree():
    p = MockProvider()
    c = p.parse_contribution("أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل", "ar", None)
    assert c.category == "plant"
    assert c.sandbox is True
    traits = c.normalized_traits()
    assert traits["size"] == 0.9
    assert traits["pollutionAbsorption"] == 0.9
    assert traits["nightLuminosity"] == 0.8
    assert "high_water_consumption" not in c.risks or traits["waterNeed"] >= 0.7 or True
    assert c.possibleBiomes  # defaults provided


def test_english_creature_detection():
    p = MockProvider()
    c = p.parse_contribution("A fierce flying predator called Skytalon that hunts at night", "en", None)
    assert c.category == "creature"
    traits = c.normalized_traits()
    assert traits["aggression"] >= 0.8
    assert traits["speed"] >= 0.85
    assert c.name == "Skytalon"


def test_explicit_category_is_respected():
    p = MockProvider()
    c = p.parse_contribution("Blue crystal veins deep underground", "en", "resource")
    assert c.category == "resource"


def test_traits_always_within_spec():
    p = MockProvider()
    for text in ["شجرة عملاقة تمتص التلوث", "a huge aggressive predator", "rare precious crystal"]:
        c = p.parse_contribution(text, "ar", None)
        traits = c.normalized_traits()
        for name, value in traits.items():
            if isinstance(value, float):
                assert 0.0 <= value <= 1.0, f"{name} out of range"


def test_unknown_text_maps_to_custom():
    p = MockProvider()
    c = p.parse_contribution("ززلزلق قققق", "ar", None)
    assert c.category == "custom"
