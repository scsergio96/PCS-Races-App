import pytest
from fastapi import HTTPException

from services.moderation import check_public_content


def test_clean_text_passes():
    # Should not raise
    check_public_content("Pogacar won in spectacular fashion on the Alpe d'Huez!")


def test_profane_text_raises():
    with pytest.raises(HTTPException) as exc_info:
        check_public_content("This is a damn shit race")
    assert exc_info.value.status_code == 400


def test_empty_text_passes():
    check_public_content("")


def test_none_text_passes():
    check_public_content(None)
