import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from models.base import CamelModel
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth, optional_auth
from models.community import ReviewComment, ReviewLike, CommunityReport
from models.diary import DiaryEntry
from models.database import get_db
from services.moderation import check_public_content

router = APIRouter(tags=["comments"])


class CommentCreate(BaseModel):
    body: str


class CommentResponse(CamelModel):
    id: uuid.UUID
    diary_entry_id: uuid.UUID
    parent_id: uuid.UUID | None
    user_id: uuid.UUID
    body: str
    is_removed: bool
    like_count: int
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def coerce_created_at(cls, v: object) -> datetime:
        """Accept both datetime objects and ISO strings (SQLite text query returns strings)."""
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            return datetime.fromisoformat(v)
        raise ValueError(f"Cannot parse created_at: {v!r}")


async def _get_public_entry(entry_id: uuid.UUID, db: AsyncSession) -> DiaryEntry:
    result = await db.execute(select(DiaryEntry).where(DiaryEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Review not found")
    if not entry.is_public:
        raise HTTPException(status_code=403, detail="Review is not public")
    return entry


@router.get("/diary/{entry_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return all comments for a public review as a flat list (client builds tree)."""
    await _get_public_entry(entry_id, db)

    # Recursive CTE — returns all comments including is_removed=True (tombstones).
    # SQLite stores UUIDs as hex strings without dashes; pass both forms so the
    # query works on both SQLite (tests) and PostgreSQL (production).
    result = await db.execute(
        text("""
            WITH RECURSIVE comment_tree AS (
                SELECT * FROM review_comment
                WHERE (diary_entry_id = :entry_id OR diary_entry_id = :entry_id_hex)
                  AND parent_id IS NULL
                UNION ALL
                SELECT c.* FROM review_comment c
                JOIN comment_tree ct ON c.parent_id = ct.id
            )
            SELECT * FROM comment_tree ORDER BY created_at ASC
        """),
        {
            "entry_id": str(entry_id),
            "entry_id_hex": entry_id.hex,
        },
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.post("/diary/{entry_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    entry_id: uuid.UUID,
    payload: CommentCreate,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    await _get_public_entry(entry_id, db)
    check_public_content(payload.body)

    comment = ReviewComment(
        diary_entry_id=entry_id,
        user_id=user_id,
        body=payload.body,
    )
    db.add(comment)
    await db.execute(
        update(DiaryEntry)
        .where(DiaryEntry.id == entry_id)
        .values(comment_count=DiaryEntry.comment_count + 1)
    )
    await db.commit()
    await db.refresh(comment)
    return comment


@router.post(
    "/diary/{entry_id}/comments/{parent_id}/reply",
    response_model=CommentResponse,
    status_code=201,
)
async def reply_to_comment(
    entry_id: uuid.UUID,
    parent_id: uuid.UUID,
    payload: CommentCreate,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    await _get_public_entry(entry_id, db)
    check_public_content(payload.body)

    # Verify parent exists and belongs to same entry
    result = await db.execute(
        select(ReviewComment).where(
            ReviewComment.id == parent_id,
            ReviewComment.diary_entry_id == entry_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = ReviewComment(
        diary_entry_id=entry_id,
        parent_id=parent_id,
        user_id=user_id,
        body=payload.body,
    )
    db.add(comment)
    await db.execute(
        update(DiaryEntry)
        .where(DiaryEntry.id == entry_id)
        .values(comment_count=DiaryEntry.comment_count + 1)
    )
    await db.commit()
    await db.refresh(comment)
    return comment


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def edit_comment(
    comment_id: uuid.UUID,
    payload: CommentCreate,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReviewComment).where(ReviewComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your comment")
    if comment.is_removed:
        raise HTTPException(status_code=400, detail="Cannot edit a removed comment")

    check_public_content(payload.body)
    comment.body = payload.body
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReviewComment).where(ReviewComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your comment")

    comment.is_removed = True
    comment.body = ""  # Clear content but preserve structure (tombstone)
    await db.commit()


@router.post("/comments/{comment_id}/like")
async def toggle_comment_like(
    comment_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReviewComment).where(ReviewComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.execute(
        select(ReviewLike).where(
            ReviewLike.user_id == user_id,
            ReviewLike.target_type == "comment",
            ReviewLike.target_id == comment_id,
        )
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        comment.like_count = max(0, comment.like_count - 1)
        liked = False
    else:
        db.add(ReviewLike(user_id=user_id, target_type="comment", target_id=comment_id))
        comment.like_count += 1
        liked = True

    await db.commit()
    return {"liked": liked, "count": comment.like_count}


@router.post("/comments/{comment_id}/report", status_code=201)
async def report_comment(
    comment_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReviewComment).where(ReviewComment.id == comment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Comment not found")

    db.add(CommunityReport(
        reporter_id=user_id,
        target_type="comment",
        target_id=comment_id,
        reason=reason,
    ))
    await db.commit()
    return {"reported": True}
