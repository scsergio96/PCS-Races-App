import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from models.user import UserProfile
from models.diary import DiaryEntry


FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def seeded_user(db_session):
    user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def client(db_engine):
    # Override get_db to use test DB
    from models.database import get_db
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_diary_entry(mock_jwt, client, seeded_user):
    resp = await client.post(
        "/diary",
        json={
            "race_url": "race/milano-sanremo/2026",
            "race_name": "Milano-Sanremo",
            "race_year": 2026,
            "race_base_slug": "race/milano-sanremo",
            "body": "Amazing race!",
            "rating": 5,
        },
        headers={"Authorization": "Bearer valid"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["race_name"] == "Milano-Sanremo"
    assert data["rating"] == 5
    assert data["is_public"] is False


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_list_diary_entries(mock_jwt, client, seeded_user):
    # Create an entry first
    await client.post(
        "/diary",
        json={
            "race_url": "race/tour-de-france/2025",
            "race_name": "Tour de France",
            "race_year": 2025,
            "race_base_slug": "race/tour-de-france",
            "body": "Pogacar dominated.",
        },
        headers={"Authorization": "Bearer valid"},
    )

    resp = await client.get("/diary", headers={"Authorization": "Bearer valid"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["race_name"] == "Tour de France"


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_get_diary_entry_not_found(mock_jwt, client, seeded_user):
    resp = await client.get(
        f"/diary/{uuid.uuid4()}",
        headers={"Authorization": "Bearer valid"},
    )
    assert resp.status_code == 404


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_unauthenticated_returns_401(mock_jwt, client):
    resp = await client.get("/diary")
    assert resp.status_code == 401
