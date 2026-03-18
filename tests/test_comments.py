import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile
from models.diary import DiaryEntry

FAKE_USER_ID = uuid.uuid4()
OTHER_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    if token == "other":
        return {"sub": str(OTHER_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def app_with_public_entry():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
        other = UserProfile(id=OTHER_USER_ID, display_name="Marco")
        entry = DiaryEntry(
            id=uuid.uuid4(),
            user_id=FAKE_USER_ID,
            race_url="race/tour-de-france/2026",
            race_name="Tour de France",
            race_year=2026,
            race_base_slug="race/tour-de-france",
            body="Great race",
            is_public=True,
        )
        session.add_all([user, other, entry])
        await session.commit()
        entry_id = entry.id

    async def override_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, entry_id

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}
OTHER_AUTH = {"Authorization": "Bearer other"}


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_top_level_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "Amazing review!"},
        headers=AUTH,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "Amazing review!"
    assert data["parent_id"] is None


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_reply(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    # Create parent comment
    parent_resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "Parent comment"},
        headers=AUTH,
    )
    parent_id = parent_resp.json()["id"]

    # Reply to it
    reply_resp = await client.post(
        f"/diary/{entry_id}/comments/{parent_id}/reply",
        json={"body": "Reply comment"},
        headers=OTHER_AUTH,
    )
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_id"] == str(parent_id)


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_get_comment_tree(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    await client.post(f"/diary/{entry_id}/comments", json={"body": "C1"}, headers=AUTH)
    await client.post(f"/diary/{entry_id}/comments", json={"body": "C2"}, headers=AUTH)

    resp = await client.get(f"/diary/{entry_id}/comments")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_soft_delete_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Delete me"}, headers=AUTH)
    comment_id = c.json()["id"]

    del_resp = await client.delete(f"/comments/{comment_id}", headers=AUTH)
    assert del_resp.status_code == 204

    # Comment still appears in tree (tombstone), but is_removed=True
    tree = await client.get(f"/diary/{entry_id}/comments")
    removed = [c for c in tree.json() if c["id"] == str(comment_id)]
    assert removed[0]["is_removed"] is True


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_cannot_delete_other_users_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Mine"}, headers=AUTH)
    comment_id = c.json()["id"]

    resp = await client.delete(f"/comments/{comment_id}", headers=OTHER_AUTH)
    assert resp.status_code == 403


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_profanity_blocked(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "This is shit"},
        headers=AUTH,
    )
    assert resp.status_code == 400


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_edit_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Original"}, headers=AUTH)
    comment_id = c.json()["id"]

    resp = await client.put(f"/comments/{comment_id}", json={"body": "Edited"}, headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["body"] == "Edited"


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_cannot_edit_removed_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Will be removed"}, headers=AUTH)
    comment_id = c.json()["id"]

    await client.delete(f"/comments/{comment_id}", headers=AUTH)
    resp = await client.put(f"/comments/{comment_id}", json={"body": "Too late"}, headers=AUTH)
    assert resp.status_code == 400
