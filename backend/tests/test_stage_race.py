import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_stage_entry(async_client: AsyncClient, auth_headers: dict):
    payload = {
        "race_url": "race/tour-de-france/2026/stage-1",
        "race_name": "Tour de France 2026 — Stage 1",
        "race_year": 2026,
        "race_base_slug": "race/tour-de-france",
        "is_stage": True,
        "stage_number": 1,
        "body": "Great stage.",
        "rating": 4,
        "is_public": True,
    }
    resp = await async_client.post("/diary", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_stage"] is True
    assert data["stage_number"] == 1
    assert data["is_public"] is True
