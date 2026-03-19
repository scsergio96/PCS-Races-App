import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from models.base import CamelModel
from typing import Optional
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.diary import DiaryEntry, Mention as MentionModel
from auth.middleware import require_auth

router = APIRouter(prefix="/diary", tags=["diary"])


class DiaryEntryCreate(CamelModel):
    race_url: str
    race_name: str
    race_year: int
    race_base_slug: str
    body: str = ""
    rating: Optional[int] = None
    key_moment: Optional[str] = None
    protagonist: Optional[str] = None
    dominant_emotion: Optional[str] = None
    is_public: bool = False
    is_stage: bool = False
    stage_number: Optional[int] = None


class DiaryEntryUpdate(CamelModel):
    body: Optional[str] = None
    rating: Optional[int] = None
    key_moment: Optional[str] = None
    protagonist: Optional[str] = None
    dominant_emotion: Optional[str] = None
    is_public: Optional[bool] = None
    is_stage: Optional[bool] = None
    stage_number: Optional[int] = None


class DiaryEntryResponse(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
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
    is_stage: bool
    stage_number: Optional[int]
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


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


@router.get("/{entry_id}/suggestions")
async def get_suggestions(
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

    related_result = await db.execute(
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id)
        .where(DiaryEntry.race_base_slug == entry.race_base_slug)
        .where(DiaryEntry.id != entry_id)
        .order_by(DiaryEntry.race_year.desc())
    )
    related = related_result.scalars().all()

    return {
        "related_entries": [DiaryEntryResponse.model_validate(e) for e in related],
        "shared_entities": [],
    }


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
        is_public=data.is_public,
        is_stage=data.is_stage,
        stage_number=data.stage_number,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Layer 1 entity recognition
    from services.entity_recognition import extract_mentions_layer1
    mention_dicts = extract_mentions_layer1(entry.body, startlist_riders=[])
    for m in mention_dicts:
        db.add(MentionModel(
            diary_entry_id=entry.id,
            entity_type=m["entity_type"],
            entity_name=m["entity_name"],
            entity_slug=m["entity_slug"],
            confidence=m["confidence"],
            detection_method=m["detection_method"],
            mention_text=m.get("mention_text"),
            confirmed_by_user=False,
        ))
    if mention_dicts:
        await db.commit()

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

    # Re-run Layer 1 after update
    from services.entity_recognition import extract_mentions_layer1
    await db.execute(
        sql_delete(MentionModel).where(
            MentionModel.diary_entry_id == entry.id,
            MentionModel.detection_method == "fuzzy",
        )
    )
    mention_dicts = extract_mentions_layer1(entry.body, startlist_riders=[])
    for m in mention_dicts:
        db.add(MentionModel(
            diary_entry_id=entry.id,
            entity_type=m["entity_type"],
            entity_name=m["entity_name"],
            entity_slug=m["entity_slug"],
            confidence=m["confidence"],
            detection_method=m["detection_method"],
            mention_text=m.get("mention_text"),
            confirmed_by_user=False,
        ))
    if mention_dicts:
        await db.commit()

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


@router.post("/{entry_id}/share")
async def create_share(
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
    if not entry.share_token:
        entry.share_token = uuid.uuid4()
        await db.commit()
        await db.refresh(entry)
    return {"share_token": str(entry.share_token)}


@router.delete("/{entry_id}/share", status_code=204)
async def revoke_share(
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
    entry.share_token = None
    await db.commit()


@router.get("/{entry_id}/mentions")
async def get_mentions(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    entry_result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
    )
    if not entry_result.scalar_one_or_none():
        raise HTTPException(404, "Entry not found")

    result = await db.execute(
        select(MentionModel).where(MentionModel.diary_entry_id == entry_id)
    )
    return result.scalars().all()


class MentionConfirm(BaseModel):
    confirmed_by_user: bool


@router.patch("/mentions/{mention_id}")
async def confirm_mention(
    mention_id: uuid.UUID,
    data: MentionConfirm,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MentionModel)
        .join(DiaryEntry, MentionModel.diary_entry_id == DiaryEntry.id)
        .where(MentionModel.id == mention_id, DiaryEntry.user_id == user_id)
    )
    mention = result.scalar_one_or_none()
    if not mention:
        raise HTTPException(404, "Mention not found")
    mention.confirmed_by_user = data.confirmed_by_user
    await db.commit()
    await db.refresh(mention)
    return mention


# Public share router (no auth)
share_router = APIRouter(prefix="/share", tags=["share"])


class PublicEntryResponse(CamelModel):
    race_name: str
    race_year: int
    race_url: str
    rating: Optional[int]
    body: str
    key_moment: Optional[str]
    protagonist: Optional[str]
    dominant_emotion: Optional[str]


@share_router.get("/{share_token}", response_model=PublicEntryResponse)
async def get_public_entry(
    share_token: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.share_token == share_token)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found or sharing has been revoked")
    return entry
