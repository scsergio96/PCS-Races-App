import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_share_and_public_view(async_client: AsyncClient, auth_headers: dict):
    resp = await async_client.post("/diary", json={
        "race_url": "race/strade-bianche/2026",
        "race_name": "Strade Bianche 2026",
        "race_year": 2026,
        "race_base_slug": "race/strade-bianche",
        "body": "Epic race through Tuscany.",
        "rating": 5,
        "is_public": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    entry_id = resp.json()["id"]

    resp = await async_client.post(f"/diary/{entry_id}/share", headers=auth_headers)
    assert resp.status_code == 200
    share_token = resp.json()["share_token"]
    assert share_token is not None

    resp = await async_client.get(f"/share/{share_token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["race_name"] == "Strade Bianche 2026"
    assert data["rating"] == 5

    resp = await async_client.delete(f"/diary/{entry_id}/share", headers=auth_headers)
    assert resp.status_code == 204

    resp = await async_client.get(f"/share/{share_token}")
    assert resp.status_code == 404
