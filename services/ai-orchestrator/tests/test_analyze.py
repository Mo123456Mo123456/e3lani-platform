from app.main import app, SandboxProvider, balance


def test_sandbox_plant():
    el = SandboxProvider().analyze(
        "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل.",
        "plant",
    )
    assert el.category == "plant"
    assert el.traits["pollutionAbsorption"] > 0.2
    assert "rainforest" in el.possibleBiomes or "temperate_forest" in el.possibleBiomes


def test_balance_caps_reproduction():
    from app.main import StructuredElement

    el = StructuredElement(
        category="creature",
        name="X",
        traits={"reproduction": 0.99, "aggression": 0.99, "size": 1.0},
        possibleBiomes=["plains"],
        risks=[],
        benefits=[],
    )
    out = balance(el)
    assert out.traits["reproduction"] <= 0.7
    assert out.balanceNotes
