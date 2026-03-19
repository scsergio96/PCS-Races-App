import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.diary import DiaryEntry
from auth.middleware import require_auth

router = APIRouter(prefix="/diary", tags=["diary"])


class DiaryEntryCreate(BaseModel):
    race_url: str
    race_name: str
    race_year: int
    race_base_slug: str
    body: str = ""
    rating: Optional[int] = None
    key_moment: Optional[str] = None
    protagonist: Optional[str] = None
    dominant_emotion: Optional[str] = None


class DiaryEntryUpdate(BaseModel):
    body: Optional[str] = None
    rating: Optional[int] = None
    key_moment: Optional[str] = None
    protagonist: Optional[str] = None
    dominant_emotion: Optional[str] = None


class DiaryEntryResponse(BaseModel):
    id: uuid.UUID
    race_url: str
    race_name: str
    race_year: int
    race_base_slug: str
    body: str
    rating: Optional[int]
    key_moment: Optional[str]
    protagonist: Optional[str]
    dominant_emotion: Optional[str]
    is_public: bool
    share_token: Optional[uuid.UUID]

    model_config = {"from_attributes": True}


@router.get("", response_model=list[DiaryEntryResponse])
async def list_entries(
    year: Optional[int] = None,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    query = select(DiaryEntry).where(DiaryEntry.user_id == user_id)
    if year:
        query = query.where(DiaryEntry.race_year == year)
    query = query.order_by(DiaryEntry.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{entry_id}", response_model=DiaryEntryResponse)
async def get_entry(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    return entry


@router.post("", response_model=DiaryEntryResponse, status_code=201)
async def create_entry(
    data: DiaryEntryCreate,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    entry = DiaryEntry(
        user_id=user_id,
        race_url=data.race_url,
        race_name=data.race_name,
        race_year=data.race_year,
        race_base_slug=data.race_base_slug,
        body=data.body,
        rating=data.rating,
        key_moment=data.key_moment,
        protagonist=data.protagonist,
        dominant_emotion=data.dominant_emotion,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=DiaryEntryResponse)
async def update_entry(
    entry_id: uuid.UUID,
    data: DiaryEntryUpdate,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")

    await db.delete(entry)
    await db.commit()
