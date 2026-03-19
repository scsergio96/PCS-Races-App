import pytest
import uuid
from datetime import timezone, datetime
from sqlalchemy import select

from models.community import ReviewComment, ReviewLike, CommunityReport
from models.user import UserProfile
from models.diary import DiaryEntry


@pytest.fixture
async def seed_data(db_session):
    user = UserProfile(id=uuid.uuid4(), display_name="Tester")
    entry = DiaryEntry(
        id=uuid.uuid4(),
        user_id=user.id,
        race_url="race/tour-de-france/2026",
        race_name="Tour de France",
        race_year=2026,
        race_base_slug="race/tour-de-france",
        body="Great race",
        is_public=True,
    )
    db_session.add_all([user, entry])
    await db_session.commit()
    return {"user": user, "entry": entry}


async def test_create_top_level_comment(db_session, seed_data):
    comment = ReviewComment(
        diary_entry_id=seed_data["entry"].id,
        user_id=seed_data["user"].id,
        body="Great review!",
    )
    db_session.add(comment)
    await db_session.commit()

    result = await db_session.execute(
        select(ReviewComment).where(ReviewComment.diary_entry_id == seed_data["entry"].id)
    )
    comments = result.scalars().all()
    assert len(comments) == 1
    assert comments[0].parent_id is None
    assert comments[0].is_removed is False


async def test_create_nested_reply(db_session, seed_data):
    parent = ReviewComment(
        diary_entry_id=seed_data["entry"].id,
        user_id=seed_data["user"].id,
        body="Top level",
    )
    db_session.add(parent)
    await db_session.commit()

    reply = ReviewComment(
        diary_entry_id=seed_data["entry"].id,
        parent_id=parent.id,
        user_id=seed_data["user"].id,
        body="Nested reply",
    )
    db_session.add(reply)
    await db_session.commit()

    result = await db_session.execute(
        select(ReviewComment).where(ReviewComment.parent_id == parent.id)
    )
    replies = result.scalars().all()
    assert len(replies) == 1
    assert replies[0].body == "Nested reply"


async def test_review_like_unique_constraint(db_session, seed_data):
    """A user can only like a review once."""
    like = ReviewLike(
        user_id=seed_data["user"].id,
        target_type="review",
        target_id=seed_data["entry"].id,
    )
    db_session.add(like)
    await db_session.commit()

    duplicate = ReviewLike(
        user_id=seed_data["user"].id,
        target_type="review",
        target_id=seed_data["entry"].id,
    )
    db_session.add(duplicate)
    with pytest.raises(Exception):  # UniqueViolation
        await db_session.commit()


async def test_diary_entry_has_like_count(db_session, seed_data):
    entry = seed_data["entry"]
    assert entry.like_count == 0
    assert entry.comment_count == 0
