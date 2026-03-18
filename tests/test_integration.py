"""
Integration test: verifies the full flow from cache through diary CRUD.
Uses SQLite in-memory, mock auth, and mock PCS scraping.
"""
import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile

FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def full_app():
    """Set up app with test DB and seeded user."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Seed user
    async with session_factory() as session:
        session.add(UserProfile(id=FAKE_USER_ID, display_name="Sergio"))
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_full_diary_flow(mock_jwt, full_app):
    client = full_app

    # 1. No entries yet
    resp = await client.get("/diary", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == []

    # 2. Create entry
    resp = await client.post("/diary", json={
        "race_url": "race/milano-sanremo/2026",
        "race_name": "Milano-Sanremo",
        "race_year": 2026,
        "race_base_slug": "race/milano-sanremo",
        "body": "Pogacar wins!",
        "rating": 5,
        "key_moment": "Poggio attack",
        "dominant_emotion": "excitement",
    }, headers=AUTH)
    assert resp.status_code == 201
    entry_id = resp.json()["id"]

    # 3. Read it back
    resp = await client.get(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["body"] == "Pogacar wins!"

    # 4. Update it
    resp = await client.put(f"/diary/{entry_id}", json={
        "body": "Pogacar wins in spectacular fashion!",
        "rating": 5,
    }, headers=AUTH)
    assert resp.status_code == 200
    assert "spectacular" in resp.json()["body"]

    # 5. List shows the entry
    resp = await client.get("/diary", headers=AUTH)
    assert len(resp.json()) == 1

    # 6. Delete it
    resp = await client.delete(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 204

    # 7. Gone
    resp = await client.get(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 404
