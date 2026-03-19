import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_watchlist_crud(async_client: AsyncClient, auth_headers: dict):
    payload = {
        "race_url": "race/tour-de-france/2026",
        "race_name": "Tour de France 2026",
        "race_date": "2026-07-04",
    }
    resp = await async_client.post("/watchlist", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    resp = await async_client.get("/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    assert any(w["id"] == item_id for w in resp.json())

    resp = await async_client.delete(f"/watchlist/{item_id}", headers=auth_headers)
    assert resp.status_code == 204

    resp = await async_client.get("/watchlist", headers=auth_headers)
    assert all(w["id"] != item_id for w in resp.json())


@pytest.mark.asyncio
async def test_watchlist_upcoming(async_client: AsyncClient, auth_headers: dict):
    resp = await async_client.get("/watchlist/upcoming", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
