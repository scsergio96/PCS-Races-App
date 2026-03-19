import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timezone

from tasks.scheduled import build_refresh_keys, determine_immutability


def test_build_refresh_keys_current_year():
    keys = build_refresh_keys(current_year=2026)
    # Should include current year and next year for both genders
    assert "race_list:2026:ME:::1" in keys
    assert "race_list:2026:WE:::1" in keys
    assert "race_list:2027:ME:::1" in keys
    assert "race_list:2027:WE:::1" in keys


def test_determine_immutability_past_race():
    assert determine_immutability("race_detail:race/tour-de-france/2024", 2026) is True


def test_determine_immutability_current_race():
    assert determine_immutability("race_detail:race/tour-de-france/2026", 2026) is False


def test_determine_immutability_race_list():
    assert determine_immutability("race_list:2024:ME:::1", 2026) is True
    assert determine_immutability("race_list:2026:ME:::1", 2026) is False
