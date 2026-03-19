import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_memories_returns_entries_for_slug(async_client: AsyncClient, auth_headers: dict):
    for year, body in [(2025, "Great race last year"), (2024, "Also good")]:
        await async_client.post("/diary", json={
            "race_url": f"race/tour-de-france/{year}",
            "race_name": f"Tour de France {year}",
            "race_year": year,
            "race_base_slug": "race/tour-de-france",
            "body": body,
        }, headers=auth_headers)

    resp = await async_client.get("/memories/race/tour-de-france", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    assert data[0]["race_year"] == 2025  # DESC order


@pytest.mark.asyncio
async def test_memories_exclude_year(async_client: AsyncClient, auth_headers: dict):
    for year in [2025, 2024]:
        await async_client.post("/diary", json={
            "race_url": f"race/giro/{year}",
            "race_name": f"Giro {year}",
            "race_year": year,
            "race_base_slug": "race/giro-d-italia",
            "body": "Entry",
        }, headers=auth_headers)

    resp = await async_client.get(
        "/memories/race/giro-d-italia?exclude_year=2025",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["race_year"] != 2025 for e in data)


@pytest.mark.asyncio
async def test_suggestions_returns_related(async_client: AsyncClient, auth_headers: dict):
    r1 = await async_client.post("/diary", json={
        "race_url": "race/paris-roubaix/2025",
        "race_name": "Paris-Roubaix 2025",
        "race_year": 2025,
        "race_base_slug": "race/paris-roubaix",
        "body": "Entry one",
    }, headers=auth_headers)
    r2 = await async_client.post("/diary", json={
        "race_url": "race/paris-roubaix/2024",
        "race_name": "Paris-Roubaix 2024",
        "race_year": 2024,
        "race_base_slug": "race/paris-roubaix",
        "body": "Entry two",
    }, headers=auth_headers)

    entry_id = r1.json()["id"]
    resp = await async_client.get(f"/diary/{entry_id}/suggestions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "related_entries" in data
    assert any(e["id"] == r2.json()["id"] for e in data["related_entries"])
