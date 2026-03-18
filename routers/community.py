import uuid
from typing import Literal, Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth
from models.community import ReviewLike, CommunityReport
from models.diary import DiaryEntry
from models.database import get_db

router = APIRouter(tags=["community"])


@router.get("/community/feed")
async def community_feed(
    sort: Literal["recent", "popular", "hot"] = "recent",
    page: int = 1,
    race_level: int | None = None,
    gender: Literal["ME", "WE"] | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Global feed of public reviews with optional filters."""
    page_size = 20
    offset = (page - 1) * page_size

    # Build safe ORDER BY — values come from a Literal enum, not user input
    if sort == "recent":
        order = "created_at DESC"
    elif sort == "popular":
        order = "like_count DESC, comment_count DESC"
    else:  # hot — simplified score without time decay for SQLite compatibility
        order = "(like_count + comment_count * 2) DESC, created_at DESC"

    where_clauses = ["is_public = 1"]  # SQLite uses 1/0 for booleans
    params: dict = {"limit": page_size, "offset": offset}

    if gender is not None:
        where_clauses.append("gender = :gender")
        params["gender"] = gender

    where_sql = " AND ".join(where_clauses)

    result = await db.execute(
        text(f"SELECT * FROM diary_entry WHERE {where_sql} ORDER BY {order} LIMIT :limit OFFSET :offset"),
        params,
    )
    rows = result.mappings().all()
    # Convert boolean fields for JSON compatibility
    return [_serialize_row(dict(r)) for r in rows]


@router.get("/race/{race_url:path}/community")
async def race_community(
    race_url: str,
    sort: Literal["recent", "popular"] = "recent",
    db: AsyncSession = Depends(get_db),
):
    """Public reviews for a specific race."""
    order = "created_at DESC" if sort == "recent" else "like_count DESC"
    result = await db.execute(
        text(f"""
            SELECT * FROM diary_entry
            WHERE is_public = 1 AND race_url = :race_url
            ORDER BY {order}
        """),
        {"race_url": race_url},
    )
    rows = result.mappings().all()
    return [_serialize_row(dict(r)) for r in rows]


@router.post("/diary/{entry_id}/like")
async def toggle_review_like(
    entry_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    """Toggle a like on a public review. Returns current like state and count."""
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.is_public == True)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Public review not found")

    existing = await db.execute(
        select(ReviewLike).where(
            ReviewLike.user_id == user_id,
            ReviewLike.target_type == "review",
            ReviewLike.target_id == entry_id,
        )
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        entry.like_count = max(0, entry.like_count - 1)
        liked = False
    else:
        db.add(ReviewLike(user_id=user_id, target_type="review", target_id=entry_id))
        entry.like_count += 1
        liked = True

    await db.commit()
    return {"liked": liked, "count": entry.like_count}


@router.post("/diary/{entry_id}/report", status_code=201)
async def report_review(
    entry_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Submit a moderation report for a public review."""
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.is_public == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Public review not found")

    db.add(CommunityReport(
        reporter_id=user_id,
        target_type="review",
        target_id=entry_id,
        reason=reason,
    ))
    await db.commit()
    return {"reported": True}


def _serialize_row(row: dict) -> dict:
    """Normalize a raw DB row for JSON serialization.

    Converts integer boolean fields (SQLite stores booleans as 0/1) to
    Python bool so the JSON response contains ``true``/``false``.
    """
    bool_fields = {"is_public"}
    return {
        k: bool(v) if k in bool_fields and isinstance(v, int) else v
        for k, v in row.items()
    }
