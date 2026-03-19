import pytest
from services.entity_recognition import extract_mentions_layer1


def test_location_detection():
    """Known climbs are detected in entry body."""
    body = "The riders attacked on the Alpe d'Huez and then again on the Col du Galibier."
    mentions = extract_mentions_layer1(body, startlist_riders=[])
    entity_names = [m["entity_name"] for m in mentions]
    assert any("Alpe d'Huez" in name or "huez" in name.lower() for name in entity_names)


def test_rider_detection():
    """Rider names from startlist are fuzzy-matched."""
    body = "Tadej Pogačar attacked brilliantly from far out today in the mountains."
    riders = ["Tadej Pogačar", "Mathieu van der Poel"]
    mentions = extract_mentions_layer1(body, startlist_riders=riders)
    assert len(mentions) >= 1
    assert any("Pogačar" in m["entity_name"] or "van der Poel" in m["entity_name"] for m in mentions)


def test_no_false_positives_on_short_body():
    """Short or empty body produces no mentions."""
    mentions = extract_mentions_layer1("Great race!", startlist_riders=[])
    assert mentions == []
