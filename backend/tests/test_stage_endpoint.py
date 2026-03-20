import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient

from scrapers.races_scraper import StageFullDetail, GCEntry, RaceResultEntry


def _make_stage_detail() -> StageFullDetail:
    return StageFullDetail(
        stage_name="Stage 2",
        stage_url="race/volta-a-catalunya/2026/stage-2",
        date="2026-03-18",
        distance=178.2,
        departure="Girona",
        arrival="Olot",
        stage_type="RR",
        profile_icon="p4",
        vertical_meters=3200,
        won_how="Solo",
        results=[
            RaceResultEntry(
                rank=1,
                rider_name="POGACAR Tadej",
                rider_url="rider/tadej-pogacar",
                team_name="UAE Team Emirates",
                nationality="SI",
                time="4:22:14",
            )
        ],
        gc=[
            GCEntry(
                rank=1,
                rider_name="POGACAR Tadej",
                rider_url="rider/tadej-pogacar",
                nationality="SI",
                time="0:00:00",
            )
        ],
    )


@pytest.mark.asyncio
async def test_get_stage_detail_returns_200(async_client: AsyncClient):
    """GET /stage/{url} returns StageFullDetail with results and GC."""
    with patch(
        "routers.races.fetch_stage_detail",
        return_value=_make_stage_detail(),
    ):
        resp = await async_client.get(
            "/stage/race/volta-a-catalunya/2026/stage-2"
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["stage_url"] == "race/volta-a-catalunya/2026/stage-2"
    assert data["distance"] == 178.2
    assert data["departure"] == "Girona"
    assert data["arrival"] == "Olot"
    assert len(data["results"]) == 1
    assert data["results"][0]["rider_name"] == "POGACAR Tadej"
    assert len(data["gc"]) == 1
    assert data["gc"][0]["time"] == "0:00:00"


@pytest.mark.asyncio
async def test_get_stage_detail_cached_on_second_call(async_client: AsyncClient):
    """Second call returns cached data without calling the scraper again."""
    mock_fn = MagicMock(return_value=_make_stage_detail())
    with patch("routers.races.fetch_stage_detail", mock_fn):
        await async_client.get("/stage/race/volta-a-catalunya/2026/stage-2")
        await async_client.get("/stage/race/volta-a-catalunya/2026/stage-2")

    # Scraper called only once (second response served from cache)
    assert mock_fn.call_count == 1


@pytest.mark.asyncio
async def test_get_stage_detail_scraper_error_returns_404(async_client: AsyncClient):
    """Scraper failure produces 404."""
    with patch(
        "routers.races.fetch_stage_detail",
        side_effect=Exception("PCS unavailable"),
    ):
        resp = await async_client.get(
            "/stage/race/volta-a-catalunya/2026/stage-99"
        )

    assert resp.status_code == 404
