import uuid
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from models.base import CamelModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth
from models.database import get_db
from models.watchlist import Watchlist

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistCreate(CamelModel):
    race_url: str
    race_name: str
    race_date: Optional[date] = None


class WatchlistResponse(CamelModel):
    id: uuid.UUID
    race_url: str
    race_name: str
    race_date: Optional[date]
    created_at: datetime


@router.get("/upcoming", response_model=list[WatchlistResponse])
async def upcoming_watchlist(
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.user_id == user_id)
        .where(Watchlist.race_date >= today)
        .order_by(Watchlist.race_date.asc())
    )
    return result.scalars().all()


@router.get("", response_model=list[WatchlistResponse])
async def list_watchlist(
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.user_id == user_id)
        .order_by(Watchlist.race_date.asc())
    )
    return result.scalars().all()


@router.post("", response_model=WatchlistResponse, status_code=201)
async def add_watchlist(
    data: WatchlistCreate,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    item = Watchlist(user_id=user_id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def remove_watchlist(
    item_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == item_id, Watchlist.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Watchlist item not found")
    await db.delete(item)
    await db.commit()
