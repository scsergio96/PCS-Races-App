# Smart Features Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Plan 2 smart features on the FastAPI backend: stage race support, memories system, watchlist, calendar feeds, public sharing, and entity recognition Layer 1 (RapidFuzz).

**Architecture:** All work is inside `backend/`. New routers are created for `memories`, `watchlist`, `calendar`. Alembic migrations add new columns and tables. Entity recognition runs synchronously in the diary save flow (Layer 1 only). Layers 2 and 3 are deferred.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, PostgreSQL (Supabase), `icalendar`, `rapidfuzz`

---

## File Structure

```
backend/
├── models/
│   ├── diary.py          MODIFY — add stage_number, is_stage columns
│   ├── watchlist.py      CREATE — Watchlist ORM model
│   └── calendar.py       CREATE — CalendarFilter ORM model
├── routers/
│   ├── diary.py          MODIFY — add is_public/stage fields to schemas; add sharing + suggestions + mentions endpoints
│   ├── memories.py       CREATE — GET /memories/{race_base_slug:path} only
│   ├── watchlist.py      CREATE — CRUD /watchlist
│   ├── calendar.py       CREATE — /calendar/filters + /calendar/feed/{token}.ics
│   └── mentions.py       CREATE — GET /mentions/entity/{entity_slug}
├── services/
│   └── entity_recognition.py  CREATE — Layer 1 RapidFuzz pipeline
├── alembic/versions/
│   ├── XXXX_stage_race_support.py     CREATE — adds stage_number, is_stage to diary_entry
│   ├── XXXX_watchlist.py              CREATE — creates watchlist table
│   └── XXXX_calendar_filter.py        CREATE — creates calendar_filter table
├── main.py               MODIFY — register new routers
├── requirements.txt      MODIFY — add icalendar
└── tests/
    ├── test_memories.py   CREATE
    ├── test_watchlist.py  CREATE
    ├── test_calendar.py   CREATE
    ├── test_sharing.py    CREATE
    └── test_entity_recognition.py  CREATE
```

---

### Task 1: Stage race support — schema migration

**Files:**
- Modify: `backend/models/diary.py`
- Create: `backend/alembic/versions/XXXX_stage_race_support.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_stage_race.py`:

```python
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from tests.conftest import async_client, auth_headers  # adjust to existing conftest


@pytest.mark.asyncio
async def test_create_stage_entry(async_client: AsyncClient, auth_headers: dict):
    payload = {
        "race_url": "race/tour-de-france/2026/stage-1",
        "race_name": "Tour de France 2026 — Stage 1",
        "race_year": 2026,
        "race_base_slug": "race/tour-de-france",
        "is_stage": True,
        "stage_number": 1,
        "body": "Great stage.",
        "rating": 4,
        "is_public": True,
    }
    resp = await async_client.post("/diary", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_stage"] is True
    assert data["stage_number"] == 1
    assert data["is_public"] is True
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && pytest tests/test_stage_race.py -v
```

Expected: `422 Unprocessable Entity` or `KeyError` — fields not yet in schema.

- [ ] **Step 3: Add columns to `DiaryEntry` ORM model**

In `backend/models/diary.py`, add after `race_base_slug`:

```python
is_stage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
stage_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

- [ ] **Step 4: Update imports and Pydantic schemas in `backend/routers/diary.py`**

Add `from datetime import datetime` to the imports at the top of `routers/diary.py`.

Update `DiaryEntryCreate`:
```python
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
    is_public: bool = False       # ADD
    is_stage: bool = False        # ADD
    stage_number: Optional[int] = None  # ADD
```

Update `DiaryEntryUpdate`:
```python
class DiaryEntryUpdate(BaseModel):
    body: Optional[str] = None
    rating: Optional[int] = None
    key_moment: Optional[str] = None
    protagonist: Optional[str] = None
    dominant_emotion: Optional[str] = None
    is_public: Optional[bool] = None    # ADD
    is_stage: Optional[bool] = None     # ADD
    stage_number: Optional[int] = None  # ADD
```

Update `DiaryEntryResponse`:
```python
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
    is_stage: bool           # ADD
    stage_number: Optional[int]  # ADD
    created_at: datetime     # ADD (useful for memories display)
    model_config = {"from_attributes": True}
```

Also update the `create_entry` handler to pass `is_public`, `is_stage`, `stage_number` to the ORM constructor:
```python
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
    is_public=data.is_public,      # ADD
    is_stage=data.is_stage,        # ADD
    stage_number=data.stage_number, # ADD
)
```

- [ ] **Step 5: Generate Alembic migration**

```bash
cd backend
alembic revision --autogenerate -m "stage_race_support"
```

Review the generated file — it should add `is_stage` (Boolean, not null, default false) and `stage_number` (Integer, nullable) to `diary_entry`.

- [ ] **Step 6: Apply migration to Supabase**

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade 1f76a204ea5c -> XXXX`

- [ ] **Step 7: Run test — expect pass**

```bash
cd backend && pytest tests/test_stage_race.py -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/models/diary.py backend/routers/diary.py backend/alembic/versions/
git add backend/tests/test_stage_race.py
git commit -m "feat: add stage race support (is_stage, stage_number) to diary entries"
```

---

### Task 2: Fix SQLite dialect import in diary model

**Files:**
- Modify: `backend/models/diary.py`

The model imports `from sqlalchemy.dialects.sqlite import JSON` for `entity_metadata` in `Mention`. On Postgres this should be `from sqlalchemy import JSON`.

- [ ] **Step 1: Fix the import**

In `backend/models/diary.py`, replace:
```python
from sqlalchemy.dialects.sqlite import JSON
```
with:
```python
from sqlalchemy import JSON
```

- [ ] **Step 2: Run tests to confirm nothing breaks**

```bash
cd backend && pytest tests/ -q
```

- [ ] **Step 3: Commit**

```bash
git add backend/models/diary.py
git commit -m "fix: use generic JSON type instead of SQLite-specific dialect"
```

---

### Task 3: Memories endpoints

**Files:**
- Create: `backend/routers/memories.py`
- Create: `backend/tests/test_memories.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests**

> ⚠️ **Test isolation:** These tests seed data via the API. If `conftest.py` does not use per-test DB cleanup, `assert len(data) == 2` will fail when run after other tests that seeded the same slugs. Verify the existing conftest resets state between tests, or change exact-count assertions to `>= N`.

Create `backend/tests/test_memories.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_memories_returns_entries_for_slug(async_client, auth_headers, db_session):
    """Seeded entries for same race_base_slug are returned, ordered by year DESC."""
    # Create two diary entries for the same race, different years
    for year, body in [(2025, "Great race last year"), (2024, "Also good")]:
        await async_client.post("/diary", json={
            "race_url": f"race/tour-de-france/{year}",
            "race_name": f"Tour de France {year}",
            "race_year": year,
            "race_base_slug": "race/tour-de-france",
            "body": body,
        }, headers=auth_headers)

    resp = await async_client.get(
        "/memories/race/tour-de-france",
        headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["race_year"] == 2025  # DESC order


@pytest.mark.asyncio
async def test_memories_exclude_year(async_client, auth_headers):
    """exclude_year param omits the given year."""
    for year in [2025, 2024]:
        await async_client.post("/diary", json={
            "race_url": f"race/giro/{year}",
            "race_name": f"Giro {year}",
            "race_year": year,
            "race_base_slug": "race/giro-d-italia",
            "body": "Entry",
        }, headers=auth_headers)

    resp = await async_client.get(
        "/memories/race/giro-d-italia?exclude_year=2025",
        headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["race_year"] != 2025 for e in data)


@pytest.mark.asyncio
async def test_suggestions_returns_related(async_client, auth_headers):
    """GET /diary/{id}/suggestions returns related entries by race_base_slug."""
    # Create two entries for same race family
    r1 = await async_client.post("/diary", json={
        "race_url": "race/paris-roubaix/2025",
        "race_name": "Paris-Roubaix 2025",
        "race_year": 2025,
        "race_base_slug": "race/paris-roubaix",
        "body": "Entry one",
    }, headers=auth_headers)
    r2 = await async_client.post("/diary", json={
        "race_url": "race/paris-roubaix/2024",
        "race_name": "Paris-Roubaix 2024",
        "race_year": 2024,
        "race_base_slug": "race/paris-roubaix",
        "body": "Entry two",
    }, headers=auth_headers)

    entry_id = r1.json()["id"]
    resp = await async_client.get(f"/diary/{entry_id}/suggestions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "related_entries" in data
    assert any(e["id"] == r2.json()["id"] for e in data["related_entries"])
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && pytest tests/test_memories.py -v
```

Expected: `404` — routes don't exist yet.

- [ ] **Step 3: Create `backend/routers/memories.py`**

This router handles only `GET /memories/{race_base_slug:path}`. The suggestions endpoint lives in `diary_router` (see Step 4 below) to avoid cross-router path conflicts with `GET /diary/{entry_id}`.

```python
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
```

- [ ] **Step 4: Add suggestions endpoint to `backend/routers/diary.py`**

> ⚠️ The suggestions route **must be in `diary_router`** (not in memories_router). FastAPI matches routes in registration order. If `GET /{entry_id}/suggestions` and `GET /{entry_id}` are on the same router, FastAPI correctly prefers the longer static suffix. Across different routers the behavior is unpredictable and depends on router registration order.

Add this endpoint to `diary_router` in `backend/routers/diary.py`, **before** the existing `GET /{entry_id}` handler:

```python
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
        "shared_entities": [],  # Populated when entity recognition is live
    }
```

- [ ] **Step 5: Register memories router in `backend/main.py`**

```python
from routers.memories import router as memories_router
app.include_router(memories_router)
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd backend && pytest tests/test_memories.py -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/routers/memories.py backend/routers/diary.py backend/main.py backend/tests/test_memories.py
git commit -m "feat: add memories and suggestions endpoints"
```

---

### Task 4: Watchlist CRUD

**Files:**
- Create: `backend/models/watchlist.py`
- Create: `backend/routers/watchlist.py`
- Create: `backend/tests/test_watchlist.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_watchlist.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_watchlist_crud(async_client: AsyncClient, auth_headers: dict):
    # Add a race
    payload = {
        "race_url": "race/tour-de-france/2026",
        "race_name": "Tour de France 2026",
        "race_date": "2026-07-04",
    }
    resp = await async_client.post("/watchlist", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    # List
    resp = await async_client.get("/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    assert any(w["id"] == item_id for w in resp.json())

    # Delete
    resp = await async_client.delete(f"/watchlist/{item_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Confirm removed
    resp = await async_client.get("/watchlist", headers=auth_headers)
    assert all(w["id"] != item_id for w in resp.json())


@pytest.mark.asyncio
async def test_watchlist_upcoming(async_client: AsyncClient, auth_headers: dict):
    resp = await async_client.get("/watchlist/upcoming", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && pytest tests/test_watchlist.py -v
```

- [ ] **Step 3: Create `backend/models/watchlist.py`**

```python
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.database import Base


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    race_url: Mapped[str] = mapped_column(Text, nullable=False)
    race_name: Mapped[str] = mapped_column(String(512), nullable=False)
    race_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
```

- [ ] **Step 4: Generate and apply Alembic migration**

```bash
cd backend
# Import the model so alembic sees it
# Add to alembic/env.py: from models.watchlist import Watchlist  (if not already auto-detected)
alembic revision --autogenerate -m "add_watchlist"
alembic upgrade head
```

- [ ] **Step 5: Create `backend/routers/watchlist.py`**

```python
import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import require_auth
from models.database import get_db
from models.watchlist import Watchlist

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistCreate(BaseModel):
    race_url: str
    race_name: str
    race_date: Optional[date] = None


class WatchlistResponse(BaseModel):
    id: uuid.UUID
    race_url: str
    race_name: str
    race_date: Optional[date]
    created_at: datetime
    model_config = {"from_attributes": True}


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
```

- [ ] **Step 6: Register in `backend/main.py`**

```python
from routers.watchlist import router as watchlist_router
app.include_router(watchlist_router)
```

Also add `from models.watchlist import Watchlist` to `alembic/env.py` target_metadata imports.

- [ ] **Step 7: Run tests — expect pass**

```bash
cd backend && pytest tests/test_watchlist.py -v
```

- [ ] **Step 8: Commit**

```bash
git add backend/models/watchlist.py backend/routers/watchlist.py backend/main.py
git add backend/alembic/versions/ backend/tests/test_watchlist.py
git commit -m "feat: add watchlist CRUD endpoints"
```

---

### Task 5: Calendar feeds

**Files:**
- Create: `backend/models/calendar.py`
- Create: `backend/routers/calendar.py`
- Create: `backend/tests/test_calendar.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Add `icalendar` to requirements**

In `backend/requirements.txt`, uncomment or add:
```
icalendar>=5.0.0
```

`rapidfuzz` is also required for Task 7 — add it now if not already present:
```
rapidfuzz>=3.6.0
```

Install locally:
```bash
cd backend && pip install icalendar>=5.0.0 "rapidfuzz>=3.6.0"
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_calendar.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_calendar_filter_crud(async_client: AsyncClient, auth_headers: dict):
    payload = {
        "label": "WorldTour 2026",
        "filter_params": {"year_from": 2026, "year_to": 2026, "race_level": 1},
    }
    # Create
    resp = await async_client.post("/calendar/filters", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "WorldTour 2026"
    token = data["subscription_token"]
    filter_id = data["id"]

    # List
    resp = await async_client.get("/calendar/filters", headers=auth_headers)
    assert resp.status_code == 200
    assert any(f["id"] == filter_id for f in resp.json())

    # Delete
    resp = await async_client.delete(f"/calendar/filters/{filter_id}", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_ical_feed_returns_vcalendar(async_client: AsyncClient, auth_headers: dict):
    # Create a filter first
    resp = await async_client.post("/calendar/filters", json={
        "label": "Test feed",
        "filter_params": {"year_from": 2026, "year_to": 2026, "race_level": 1, "max_pages_per_year": 1},
    }, headers=auth_headers)
    token = resp.json()["subscription_token"]

    # Fetch the .ics feed (no auth)
    resp = await async_client.get(f"/calendar/feed/{token}.ics")
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    assert b"BEGIN:VCALENDAR" in resp.content
```

- [ ] **Step 3: Run — expect failure**

```bash
cd backend && pytest tests/test_calendar.py -v
```

- [ ] **Step 4: Create `backend/models/calendar.py`**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from models.database import Base


class CalendarFilter(Base):
    __tablename__ = "calendar_filter"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(256), nullable=False)
    subscription_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4
    )
    filter_params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
```

- [ ] **Step 5: Generate and apply migration**

```bash
cd backend
alembic revision --autogenerate -m "add_calendar_filter"
alembic upgrade head
```

- [ ] **Step 6: Create `backend/routers/calendar.py`**

```python
import uuid
from datetime import datetime, timezone
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

    # Fetch races using stored filter params
    # fetch_races is synchronous (uses time.sleep) — run in thread pool to avoid blocking the event loop
    import asyncio
    params = cf.filter_params
    races = await asyncio.to_thread(fetch_races, **params)

    # Build iCal
    from icalendar import Calendar, Event
    from datetime import date as date_type
    import re

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
```

- [ ] **Step 7: Register in `backend/main.py`**

```python
from routers.calendar import router as calendar_router
app.include_router(calendar_router)
```

- [ ] **Step 8: Run tests — expect pass**

```bash
cd backend && pytest tests/test_calendar.py -v
```

- [ ] **Step 9: Commit**

```bash
git add backend/models/calendar.py backend/routers/calendar.py backend/main.py
git add backend/alembic/versions/ backend/requirements.txt backend/tests/test_calendar.py
git commit -m "feat: add calendar feeds with iCal generation"
```

---

### Task 6: Public sharing endpoints

**Files:**
- Modify: `backend/routers/diary.py`
- Create: `backend/tests/test_sharing.py`

The `share_token` column already exists in `diary_entry`. Just add the endpoints.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_sharing.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_share_and_public_view(async_client: AsyncClient, auth_headers: dict):
    # Create entry
    resp = await async_client.post("/diary", json={
        "race_url": "race/strade-bianche/2026",
        "race_name": "Strade Bianche 2026",
        "race_year": 2026,
        "race_base_slug": "race/strade-bianche",
        "body": "Epic race through Tuscany.",
        "rating": 5,
        "is_public": True,
    }, headers=auth_headers)
    entry_id = resp.json()["id"]

    # Generate share link
    resp = await async_client.post(f"/diary/{entry_id}/share", headers=auth_headers)
    assert resp.status_code == 200
    share_token = resp.json()["share_token"]
    assert share_token is not None

    # Public view — no auth
    resp = await async_client.get(f"/share/{share_token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["race_name"] == "Strade Bianche 2026"
    assert data["rating"] == 5

    # Revoke
    resp = await async_client.delete(f"/diary/{entry_id}/share", headers=auth_headers)
    assert resp.status_code == 204

    # Public view now 404
    resp = await async_client.get(f"/share/{share_token}")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && pytest tests/test_sharing.py -v
```

- [ ] **Step 3: Add sharing endpoints to `backend/routers/diary.py`**

Add these three endpoints to `diary.py`:

```python
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
```

Add a new router in `backend/routers/diary.py` or a separate module for the public share view:

```python
# At the bottom of diary.py, add a separate router for public share
share_router = APIRouter(prefix="/share", tags=["share"])

class PublicEntryResponse(BaseModel):
    race_name: str
    race_year: int
    race_url: str
    rating: Optional[int]
    body: str
    key_moment: Optional[str]
    protagonist: Optional[str]
    dominant_emotion: Optional[str]
    model_config = {"from_attributes": True}


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
```

- [ ] **Step 4: Register `share_router` in `backend/main.py`**

```python
from routers.diary import share_router
app.include_router(share_router)
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && pytest tests/test_sharing.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/routers/diary.py backend/main.py backend/tests/test_sharing.py
git commit -m "feat: add public sharing endpoints (share_token, /share/{token})"
```

---

### Task 7: Entity recognition — Layer 1 (RapidFuzz)

**Files:**
- Create: `backend/services/entity_recognition.py`
- Modify: `backend/routers/diary.py`
- Create: `backend/tests/test_entity_recognition.py`

Layer 1 runs synchronously when a diary entry is created or updated. It fuzzy-matches the entry body against a small location dictionary. Rider matching requires a startlist from the cache (deferred — returns empty if not cached). Returns `Mention` rows with `detection_method="fuzzy"`.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_entity_recognition.py`:

```python
import pytest
from services.entity_recognition import extract_mentions_layer1


def test_location_detection():
    """Known climbs are detected in entry body."""
    body = "The riders attacked on the Alpe d'Huez and then again on the Col du Galibier."
    mentions = extract_mentions_layer1(body, startlist_riders=[])
    entity_names = [m["entity_name"] for m in mentions]
    assert any("Alpe d'Huez" in name or "huez" in name.lower() for name in entity_names)


def test_rider_detection():
    """Rider names from startlist are fuzzy-matched."""
    body = "Pogačar attacked and Van der Poel followed."
    riders = ["Tadej Pogačar", "Mathieu van der Poel"]
    mentions = extract_mentions_layer1(body, startlist_riders=riders)
    assert len(mentions) >= 1
    assert any("Pogačar" in m["entity_name"] or "van der Poel" in m["entity_name"] for m in mentions)


def test_no_false_positives_on_short_body():
    """Short or empty body produces no mentions."""
    mentions = extract_mentions_layer1("Great race!", startlist_riders=[])
    assert mentions == []
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && pytest tests/test_entity_recognition.py -v
```

- [ ] **Step 3: Create `backend/services/entity_recognition.py`**

```python
"""
Layer 1 entity recognition: RapidFuzz fuzzy matching.
Returns a list of mention dicts (not ORM objects) to keep this layer pure/testable.
"""
from rapidfuzz import process, fuzz
from typing import Any

# Curated location dictionary — iconic cycling climbs and locations
LOCATION_DICT = [
    "Alpe d'Huez", "Col du Galibier", "Mont Ventoux", "Col du Tourmalet",
    "Stelvio", "Mortirolo", "Zoncolan", "Col de la Loze", "Col d'Izoard",
    "Colle delle Finestre", "Angliru", "Lagos de Covadonga", "Paterberg",
    "Koppenberg", "Mur de Huy", "Roubaix", "Arenberg", "Flanders",
    "Poggio", "La Redoute", "Liège", "Col de la Croix de Fer",
    "Croix de Chazelles", "Super Planche des Belles Filles",
]

CONFIDENCE_THRESHOLD = 0.72
MIN_BODY_WORDS = 5


def extract_mentions_layer1(
    body: str,
    startlist_riders: list[str],
) -> list[dict[str, Any]]:
    """
    Fuzzy-match body text against locations + riders.
    Returns list of mention dicts with keys:
      entity_type, entity_name, entity_slug, confidence, detection_method, mention_text
    """
    words = body.split()
    if len(words) < MIN_BODY_WORDS:
        return []

    mentions: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()

    def _slug(name: str) -> str:
        return name.lower().replace(" ", "-").replace("'", "")

    def _add(entity_type: str, entity_name: str, confidence: float, snippet: str):
        slug = _slug(entity_name)
        if slug in seen_slugs:
            return
        seen_slugs.add(slug)
        mentions.append({
            "entity_type": entity_type,
            "entity_name": entity_name,
            "entity_slug": slug,
            "confidence": round(confidence, 3),
            "detection_method": "fuzzy",
            "mention_text": snippet,
        })

    # Match locations
    for location in LOCATION_DICT:
        result = process.extractOne(
            location, [body],
            scorer=fuzz.partial_ratio,
            score_cutoff=CONFIDENCE_THRESHOLD * 100,
        )
        if result:
            _add("location", location, result[1] / 100, location)

    # Match riders from startlist
    if startlist_riders:
        for rider in startlist_riders:
            result = process.extractOne(
                rider, [body],
                scorer=fuzz.partial_ratio,
                score_cutoff=CONFIDENCE_THRESHOLD * 100,
            )
            if result:
                _add("rider", rider, result[1] / 100, rider)

    return mentions
```

- [ ] **Step 4: Integrate into diary create/update**

In `backend/routers/diary.py`, update `create_entry` to run Layer 1 after saving:

```python
from services.entity_recognition import extract_mentions_layer1
from models.diary import Mention

# Inside create_entry, after await db.commit() / await db.refresh(entry):
mention_dicts = extract_mentions_layer1(entry.body, startlist_riders=[])
for m in mention_dicts:
    mention = Mention(
        diary_entry_id=entry.id,
        entity_type=m["entity_type"],
        entity_name=m["entity_name"],
        entity_slug=m["entity_slug"],
        confidence=m["confidence"],
        detection_method=m["detection_method"],
        mention_text=m.get("mention_text"),
        confirmed_by_user=False,
    )
    db.add(mention)
if mention_dicts:
    await db.commit()
```

Apply the same pattern in `update_entry` (first delete existing fuzzy mentions, then re-run):

```python
# In update_entry, before return:
from sqlalchemy import delete as sql_delete
await db.execute(
    sql_delete(Mention).where(
        Mention.diary_entry_id == entry.id,
        Mention.detection_method == "fuzzy",
    )
)
mention_dicts = extract_mentions_layer1(entry.body, startlist_riders=[])
for m in mention_dicts:
    db.add(Mention(
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
```

- [ ] **Step 5: Add mention endpoints to diary router**

Append to `backend/routers/diary.py`:

```python
from models.diary import Mention as MentionModel

class MentionResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_name: str
    entity_slug: str
    confidence: float
    detection_method: str
    confirmed_by_user: bool
    model_config = {"from_attributes": True}


@router.get("/{entry_id}/mentions", response_model=list[MentionResponse])
async def get_mentions(
    entry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
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


@router.patch("/mentions/{mention_id}", response_model=MentionResponse)
async def confirm_mention(
    mention_id: uuid.UUID,
    data: MentionConfirm,
    user_id: uuid.UUID = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    # Join through diary_entry to verify ownership
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
```

Also create `backend/routers/mentions.py` for the entity-based lookup endpoint (spec §7.4):

```python
# backend/routers/mentions.py
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
```

- [ ] **Step 6: Register `mentions_router` in `backend/main.py`**

```python
from routers.mentions import router as mentions_router
app.include_router(mentions_router)
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add backend/services/entity_recognition.py backend/routers/diary.py
git add backend/routers/mentions.py backend/main.py
git add backend/tests/test_entity_recognition.py
git commit -m "feat: add entity recognition Layer 1 (RapidFuzz) on diary save"
```

---

### Task 8: Full test suite and deploy

- [ ] **Step 1: Run full test suite**

```bash
cd backend && pytest tests/ -v --tb=short
```

All tests must pass.

- [ ] **Step 2: Push to trigger Vercel deploy**

```bash
git push origin main
```

- [ ] **Step 3: Smoke-test production endpoints**

```bash
# Adjust URL to your Vercel backend
BASE=https://your-api.vercel.app

curl "$BASE/health"
curl "$BASE/memories/race/tour-de-france" -H "Authorization: Bearer $TOKEN"
curl "$BASE/watchlist" -H "Authorization: Bearer $TOKEN"
curl "$BASE/calendar/filters" -H "Authorization: Bearer $TOKEN"
```

Expected: all return 200.

---

## Done

After Task 8:
- Stage race fields live on diary entries
- Memories and suggestions endpoints active
- Watchlist CRUD complete
- Calendar feed generation with `.ics` subscription URLs
- Public sharing via `share_token`
- Entity recognition Layer 1 (locations + riders) running on diary save

Next: execute `2026-03-19-plan3-frontend.md` (to be written).
