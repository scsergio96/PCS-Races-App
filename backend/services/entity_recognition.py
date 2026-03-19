"""
Layer 1 entity recognition: RapidFuzz fuzzy matching.
Returns a list of mention dicts (not ORM objects) to keep this layer pure/testable.
"""
from rapidfuzz import process, fuzz
from typing import Any

# Curated location dictionary — iconic cycling climbs and locations
LOCATION_DICT = [
    "Alpe d'Huez", "Col du Galibier", "Mont Ventoux", "Col du Tourmalet",
    "Stelvio", "Mortirolo", "Zoncolan", "Col de la Loze", "Col d'Izoard",
    "Colle delle Finestre", "Angliru", "Lagos de Covadonga", "Paterberg",
    "Koppenberg", "Mur de Huy", "Roubaix", "Arenberg", "Flanders",
    "Poggio", "La Redoute", "Liège", "Col de la Croix de Fer",
    "Croix de Chazelles", "Super Planche des Belles Filles",
]

CONFIDENCE_THRESHOLD = 0.72
MIN_BODY_WORDS = 5


def extract_mentions_layer1(
    body: str,
    startlist_riders: list[str],
) -> list[dict[str, Any]]:
    """
    Fuzzy-match body text against locations + riders.
    Returns list of mention dicts with keys:
      entity_type, entity_name, entity_slug, confidence, detection_method, mention_text
    """
    words = body.split()
    if len(words) < MIN_BODY_WORDS:
        return []

    mentions: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()

    def _slug(name: str) -> str:
        return name.lower().replace(" ", "-").replace("'", "")

    def _add(entity_type: str, entity_name: str, confidence: float, snippet: str):
        slug = _slug(entity_name)
        if slug in seen_slugs:
            return
        seen_slugs.add(slug)
        mentions.append({
            "entity_type": entity_type,
            "entity_name": entity_name,
            "entity_slug": slug,
            "confidence": round(confidence, 3),
            "detection_method": "fuzzy",
            "mention_text": snippet,
        })

    # Match locations
    for location in LOCATION_DICT:
        result = process.extractOne(
            location, [body],
            scorer=fuzz.partial_ratio,
            score_cutoff=CONFIDENCE_THRESHOLD * 100,
        )
        if result:
            _add("location", location, result[1] / 100, location)

    # Match riders from startlist
    if startlist_riders:
        for rider in startlist_riders:
            result = process.extractOne(
                rider, [body],
                scorer=fuzz.partial_ratio,
                score_cutoff=CONFIDENCE_THRESHOLD * 100,
            )
            if result:
                _add("rider", rider, result[1] / 100, rider)

    return mentions
