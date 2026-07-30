from app.main import lotka, LotkaVolterraIn, war_probability, WarOddsIn


def test_lotka_runs():
    out = lotka(LotkaVolterraIn(prey=100, predator=20, steps=20))
    assert out["finalPrey"] >= 0
    assert len(out["prey"]) == 21


def test_war_allied_lowers_p():
    base = war_probability(
        WarOddsIn(
            aggressionA=0.8,
            aggressionB=0.5,
            militaryA=0.5,
            militaryB=0.5,
            foodA=0.2,
            foodB=0.2,
            allied=False,
            proximity=0.3,
        )
    )["probability"]
    allied = war_probability(
        WarOddsIn(
            aggressionA=0.8,
            aggressionB=0.5,
            militaryA=0.5,
            militaryB=0.5,
            foodA=0.2,
            foodB=0.2,
            allied=True,
            proximity=0.3,
        )
    )["probability"]
    assert allied < base
