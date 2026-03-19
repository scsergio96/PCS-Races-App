import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile
from models.diary import DiaryEntry

FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def app_with_reviews():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
        public_entry = DiaryEntry(
            id=uuid.uuid4(), user_id=FAKE_USER_ID,
            race_url="race/tour-de-france/2026", race_name="TdF",
            race_year=2026, race_base_slug="race/tour-de-france",
            body="Public review", is_public=True,
        )
        private_entry = DiaryEntry(
            id=uuid.uuid4(), user_id=FAKE_USER_ID,
            race_url="race/giro/2026", race_name="Giro",
            race_year=2026, race_base_slug="race/giro",
            body="Private review", is_public=False,
        )
        session.add_all([user, public_entry, private_entry])
        await session.commit()
        public_id = public_entry.id

    async def override_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, public_id

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}


async def test_community_feed_only_public(app_with_reviews):
    client, _ = app_with_reviews
    resp = await client.get("/community/feed")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["is_public"] is True


async def test_community_feed_sort_options(app_with_reviews):
    client, _ = app_with_reviews
    for sort in ("recent", "popular", "hot"):
        resp = await client.get(f"/community/feed?sort={sort}")
        assert resp.status_code == 200


async def test_race_community_feed(app_with_reviews):
    client, _ = app_with_reviews
    resp = await client.get("/race/race/tour-de-france/2026/community")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_toggle_review_like(mock_jwt, app_with_reviews):
    client, public_id = app_with_reviews
    resp = await client.post(f"/diary/{public_id}/like", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["liked"] is True
    assert resp.json()["count"] == 1

    # Toggle off
    resp2 = await client.post(f"/diary/{public_id}/like", headers=AUTH)
    assert resp2.json()["liked"] is False
    assert resp2.json()["count"] == 0


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_report_review(mock_jwt, app_with_reviews):
    client, public_id = app_with_reviews
    resp = await client.post(f"/diary/{public_id}/report", headers=AUTH)
    assert resp.status_code == 201
    assert resp.json()["reported"] is True
