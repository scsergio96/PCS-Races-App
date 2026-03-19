import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport


async def test_get_races_returns_cached_data(db_engine):
    """GET /races should return data from cache, not scrape live."""
    from main import app

    mock_races = [
        {"name": "Milano-Sanremo", "race_url": "race/milano-sanremo/2026",
         "year": 2026, "is_future": True}
    ]

    with patch("services.cache.CacheService.get", new_callable=AsyncMock, return_value=mock_races):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/races?year_from=2026&year_to=2026")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert data[0]["name"] == "Milano-Sanremo"


async def test_health_still_works(db_engine):
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
