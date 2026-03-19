import pytest
import uuid
from datetime import timezone, datetime
from sqlalchemy import select

from models.user import UserProfile
from models.diary import DiaryEntry, Mention


async def test_create_user_profile(db_session):
    user = UserProfile(id=uuid.uuid4(), display_name="Sergio")
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(UserProfile))
    users = result.scalars().all()
    assert len(users) == 1
    assert users[0].display_name == "Sergio"
    assert users[0].is_active is True


async def test_create_diary_entry(db_session):
    user = UserProfile(id=uuid.uuid4(), display_name="Sergio")
    db_session.add(user)
    await db_session.commit()

    entry = DiaryEntry(
        user_id=user.id,
        race_url="race/tour-de-france/2026",
        race_name="Tour de France",
        race_year=2026,
        race_base_slug="race/tour-de-france",
        body="Incredible stage today!",
        rating=5,
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(select(DiaryEntry))
    entries = result.scalars().all()
    assert len(entries) == 1
    assert entries[0].is_public is False
    assert entries[0].like_count == 0
    assert entries[0].comment_count == 0


async def test_create_mention(db_session):
    user = UserProfile(id=uuid.uuid4(), display_name="Sergio")
    entry = DiaryEntry(
        user_id=user.id,
        race_url="race/tour-de-france/2026",
        race_name="Tour de France",
        race_year=2026,
        race_base_slug="race/tour-de-france",
        body="Pogacar was brilliant!",
    )
    db_session.add_all([user, entry])
    await db_session.commit()

    mention = Mention(
        diary_entry_id=entry.id,
        entity_type="rider",
        entity_name="Tadej Pogacar",
        entity_slug="rider/tadej-pogacar",
        confidence=0.95,
        detection_method="fuzzy",
    )
    db_session.add(mention)
    await db_session.commit()

    result = await db_session.execute(
        select(Mention).where(Mention.diary_entry_id == entry.id)
    )
    mentions = result.scalars().all()
    assert len(mentions) == 1
    assert mentions[0].entity_type == "rider"
    assert mentions[0].confirmed_by_user is False


async def test_diary_entry_public_sharing(db_session):
    user = UserProfile(id=uuid.uuid4(), display_name="Sergio")
    db_session.add(user)
    await db_session.commit()

    entry = DiaryEntry(
        user_id=user.id,
        race_url="race/milano-sanremo/2026",
        race_name="Milano-Sanremo",
        race_year=2026,
        race_base_slug="race/milano-sanremo",
        body="Amazing race!",
        is_public=True,
        share_token=uuid.uuid4(),
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(DiaryEntry).where(DiaryEntry.share_token == entry.share_token)
    )
    fetched = result.scalar_one()
    assert fetched.is_public is True
