import asyncio
import uuid
from datetime import date as date_type, datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth
from models.database import get_db
from models.calendar import CalendarFilter
from scrapers.races_scraper import fetch_races

router = APIRouter(prefix="/calendar", tags=["calendar"])


class CalendarFilterCreate(BaseModel):
    label: str
    filter_params: dict[str, Any] = {}


class CalendarFilterResponse(BaseModel):
    id: uuid.UUID
    label: str
    subscription_token: uuid.UUID
    filter_params: dict[str, Any]
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("/filters", response_model=list[CalendarFilterResponse])
async def list_filters(
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarFilter).where(CalendarFilter.user_id == user_id)
    )
    return result.scalars().all()


@router.post("/filters", response_model=CalendarFilterResponse, status_code=201)
async def create_filter(
    data: CalendarFilterCreate,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    cf = CalendarFilter(user_id=user_id, label=data.label, filter_params=data.filter_params)
    db.add(cf)
    await db.commit()
    await db.refresh(cf)
    return cf


@router.delete("/filters/{filter_id}", status_code=204)
async def delete_filter(
    filter_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarFilter).where(
            CalendarFilter.id == filter_id, CalendarFilter.user_id == user_id
        )
    )
    cf = result.scalar_one_or_none()
    if not cf:
        raise HTTPException(404, "Filter not found")
    await db.delete(cf)
    await db.commit()


@router.get("/feed/{subscription_token}.ics")
async def get_ical_feed(
    subscription_token: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarFilter).where(CalendarFilter.subscription_token == subscription_token)
    )
    cf = result.scalar_one_or_none()
    if not cf:
        raise HTTPException(404, "Feed not found")

    params = cf.filter_params
    races = await asyncio.to_thread(fetch_races, **params)

    from icalendar import Calendar, Event

    cal = Calendar()
    cal.add("prodid", "-//CycleTracker//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", cf.label)

    for race in races:
        event = Event()
        event.add("summary", race.get("name", "Race"))
        start = race.get("date_from") or race.get("date")
        end = race.get("date_to") or start
        if start:
            try:
                event.add("dtstart", date_type.fromisoformat(str(start)))
                event.add("dtend", date_type.fromisoformat(str(end or start)))
            except (ValueError, TypeError):
                continue
        event.add("description", f"Nation: {race.get('nation', '')} | Level: {race.get('race_level', '')}")
        if race.get("url"):
            event.add("url", f"https://www.procyclingstats.com/{race['url']}")
        cal.add_component(event)

    return Response(
        content=cal.to_ical(),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{cf.label}.ics"'},
    )
