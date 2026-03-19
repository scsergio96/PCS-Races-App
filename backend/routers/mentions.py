import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth
from models.database import get_db
from models.diary import DiaryEntry, Mention
from routers.diary import DiaryEntryResponse

router = APIRouter(prefix="/mentions", tags=["mentions"])


@router.get("/entity/{entity_slug}", response_model=list[DiaryEntryResponse])
async def entries_by_entity(
    entity_slug: str,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """All diary entries by the current user that mention the given entity slug."""
    result = await db.execute(
        select(DiaryEntry)
        .join(Mention, Mention.diary_entry_id == DiaryEntry.id)
        .where(DiaryEntry.user_id == user_id)
        .where(Mention.entity_slug == entity_slug)
        .order_by(DiaryEntry.created_at.desc())
    )
    return result.scalars().all()
