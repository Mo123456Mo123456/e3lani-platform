"""Narration: templates render real events; validator rejects invention."""
from app.narrative import template_narrative, validate_narrative

EVENTS = [
    {"id": "ev_1", "type": "WAR_STARTED", "importance": 5, "tick": 31,
     "payload": {"attacker": "Nithkok", "defender": "Vitush",
                 "causes": [{"factor": "aggression", "weight": 0.2}]}},
    {"id": "ev_2", "type": "CITY_CREATED", "importance": 3, "tick": 40,
     "payload": {"name": "Korval"}},
    {"id": "ev_3", "type": "SPECIES_EXTINCT", "importance": 3, "tick": 44,
     "payload": {"name": "Feroth"}},
]


def test_template_arabic_mentions_real_names():
    text = template_narrative(EVENTS, "ar")
    assert "Nithkok" in text
    assert "Vitush" in text


def test_template_english():
    text = template_narrative(EVENTS, "en")
    assert "war" in text.lower()
    assert "Korval" in text


def test_empty_events_says_so():
    text = template_narrative([], "ar")
    assert "لم تُسجَّل" in text


def test_validator_accepts_supported_numbers():
    ok = validate_narrative("انتهت حرب بعد 31 عامًا", EVENTS)
    assert ok


def test_validator_rejects_fabricated_statistics():
    text = "انخفض التلوث بنسبة 87% وازداد السكان 45000 نسمة وظهرت 99 مدينة"
    assert not validate_narrative(text, EVENTS)
