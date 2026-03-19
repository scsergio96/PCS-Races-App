import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.diary import DiaryEntry
from auth.middleware import require_auth
from routers.diary import DiaryEntryResponse

router = APIRouter(tags=["memories"])


@router.get("/memories/{race_base_slug:path}", response_model=list[DiaryEntryResponse])
async def get_memories(
    race_base_slug: str,
    exclude_year: Optional[int] = None,
    is_stage: Optional[bool] = None,
    stage_number: Optional[int] = None,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id)
        .where(DiaryEntry.race_base_slug == race_base_slug)
    )
    if exclude_year is not None:
        query = query.where(DiaryEntry.race_year != exclude_year)
    if is_stage is not None:
        query = query.where(DiaryEntry.is_stage == is_stage)
    if stage_number is not None:
        query = query.where(DiaryEntry.stage_number == stage_number)

    query = query.order_by(DiaryEntry.race_year.desc())
    result = await db.execute(query)
    return result.scalars().all()
