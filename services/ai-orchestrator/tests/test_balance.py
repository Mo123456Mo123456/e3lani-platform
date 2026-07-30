"""Balance rules: budgets, taxes, constructive rejection."""
from app.balance import balance_check
from app.schemas import StructuredContribution


def _contrib(cat, traits, name="test", desc=""):
    return StructuredContribution(category=cat, name=name, description=desc, traits=traits)


def test_overpowered_plant_gets_adjusted_not_rejected():
    c = _contrib("plant", {
        "size": 1.0, "growthRate": 0.95, "pollutionAbsorption": 0.95,
        "energyStorage": 0.9, "spreadRate": 0.9, "waterNeed": 0.9,
    })
    report = balance_check(c)
    assert report["verdict"] == "adjusted"
    assert report["suggested"]
    total = sum(report["suggested"]["traits"][n] for n in
                ["size", "growthRate", "pollutionAbsorption", "energyStorage", "spreadRate"])
    assert total <= 2.6 + 0.01
    assert report["issues"]


def test_planet_destruction_rejected_with_suggestion():
    c = _contrib("world_law", {"potency": 0.8}, name="ممحاة", desc="يدمر الكوكب فورًا")
    report = balance_check(c)
    assert report["verdict"] == "rejected"
    assert any(i["code"] == "planet_destruction" for i in report["issues"])
    assert report["suggested"] is not None
    assert report["suggested"]["traits"]["potency"] <= 0.8 * 0.6 + 1e-9


def test_energy_storage_water_tax():
    c = _contrib("plant", {"energyStorage": 0.8, "waterNeed": 0.2})
    report = balance_check(c)
    assert report["suggested"]["traits"]["waterNeed"] == 0.6


def test_reasonable_element_passes():
    c = _contrib("plant", {"size": 0.4, "growthRate": 0.4, "waterNeed": 0.4})
    report = balance_check(c)
    assert report["verdict"] == "ok"
    assert report["suggested"] is None


def test_large_creature_reproduction_cap():
    c = _contrib("creature", {"size": 0.9, "reproductionRate": 0.9})
    report = balance_check(c)
    assert report["verdict"] == "adjusted"
    assert report["suggested"]["traits"]["reproductionRate"] <= 0.6
