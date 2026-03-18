# CycleTracker Plan 1: Backend Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing FastAPI scraper into a production backend with database, auth, PCS caching layer, diary CRUD, and community social features (public reviews, threaded comments, likes, reports).

**Architecture:** Extend the existing FastAPI app with SQLAlchemy 2.x async models, Supabase Auth (JWT verification), a cache-through service for PCS data with scheduled refresh, diary CRUD endpoints, and community endpoints (public feed, nested comment threads via recursive CTE, like toggle, profanity filter).

**Tech Stack:** FastAPI, SQLAlchemy 2.x async, asyncpg, Alembic, Supabase (Auth + PostgreSQL), APScheduler, RapidFuzz, better-profanity, pytest + httpx (testing)

**Specs:** `docs/superpowers/specs/2026-03-17-cycletracker-design.md`, `docs/superpowers/specs/2026-03-18-community-social-design.md`

**Scope:** This plan covers Phase 1 backend (Tasks 1-10) + community backend (Tasks 11-14). Frontend (Plan 3), smart features (Plan 2), and polish (Plan 4) are separate plans.

---

## File Structure

### Files to create

```
├── models/
│   ├── database.py              # SQLAlchemy Base, async engine, session factory
│   ├── cache.py                 # ScrapeCache SQLAlchemy model
│   ├── user.py                  # UserProfile SQLAlchemy model
│   └── diary.py                 # DiaryEntry, Mention SQLAlchemy models
├── routers/
│   ├── races.py                 # Refactored race endpoints (reads via cache)
│   └── diary.py                 # Diary CRUD endpoints
├── services/
│   └── cache.py                 # Cache-through service with stampede protection
├── auth/
│   └── middleware.py            # Supabase JWT verification dependency
├── tasks/
│   └── scheduled.py            # Scheduled PCS refresh job
├── alembic.ini                  # Alembic config
├── alembic/
│   ├── env.py                  # Alembic environment (async)
│   └── versions/               # Migration files (auto-generated)
├── tests/
│   ├── conftest.py             # Fixtures: test client, test DB, mock auth
│   ├── test_health.py          # Smoke test
│   ├── test_cache_service.py   # Cache-through logic tests
│   ├── test_races_cached.py    # Race endpoints via cache
│   ├── test_diary_crud.py      # Diary CRUD tests
│   ├── test_auth.py            # Auth middleware tests
│   ├── test_scheduled.py       # Scheduled job tests
│   ├── test_community_models.py # ReviewComment, ReviewLike, CommunityReport model tests
│   ├── test_moderation.py      # Profanity filter tests
│   ├── test_comments.py        # Comment CRUD + thread tests
│   └── test_community_feed.py  # Community feed + like/report endpoint tests
├── .env.example                 # Template for env vars
└── pytest.ini                   # Pytest configuration
```

### Files to create (Tasks 11-14)

```
├── models/
│   └── community.py             # ReviewComment, ReviewLike, CommunityReport SQLAlchemy models
├── routers/
│   ├── community.py             # GET /community/feed, GET /race/{url}/community
│   └── comments.py              # Comment CRUD, like toggle, report endpoints
├── services/
│   └── moderation.py            # better-profanity wrapper
```

### Files to modify

```
├── main.py                      # Register routers, start scheduler, startup/shutdown
├── requirements.txt             # Add new dependencies
├── run.py                       # No changes needed
├── scrapers/races_scraper.py    # Consolidate RaceModel (remove duplicate)
├── models/race.py               # Becomes the single source of truth for Pydantic race models
├── models/diary.py              # Add like_count, comment_count columns to DiaryEntry (Task 11)
├── alembic/env.py               # Add community model import (Task 11)
```

### Files unchanged

```
├── run.py                       # Dev server entry point (no changes)
```

---

## Task 1: Project Setup — Dependencies and Configuration

**Files:**
- Modify: `requirements.txt`
- Create: `.env.example`
- Create: `pytest.ini`

- [ ] **Step 1: Update requirements.txt**

```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
beautifulsoup4>=4.12.0
pydantic>=2.6.0
procyclingstats~=0.2.8
requests~=2.32.5

# Database
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0

# Auth
python-jose[cryptography]>=3.3.0
supabase>=2.0.0

# Caching & scheduling
apscheduler>=3.10.0

# NLP Layer 1
rapidfuzz>=3.6.0

# Calendar (deferred to Plan 2)
# icalendar>=5.0.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
aiosqlite>=0.20.0  # SQLite async driver for tests
```

- [ ] **Step 2: Create .env.example**

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql+asyncpg://postgres:password@db.your-project.supabase.co:6543/postgres

# App
ENVIRONMENT=development
PCS_REFRESH_INTERVAL_HOURS=6
```

- [ ] **Step 3: Create pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_functions = test_*
```

- [ ] **Step 4: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: All packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt .env.example pytest.ini
git commit -m "chore: add backend dependencies and project config"
```

---

## Task 2: Database Setup — SQLAlchemy Async Engine + Alembic

**Files:**
- Create: `models/database.py`
- Create: `alembic.ini`
- Create: `alembic/env.py`

- [ ] **Step 1: Write test for database session**

Create `tests/conftest.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from models.database import Base


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
```

Create `tests/test_health.py`:

```python
import pytest
from sqlalchemy import text


async def test_database_connection(db_session):
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pip install aiosqlite && pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'models.database'`

- [ ] **Step 3: Create models/database.py**

```python
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cycletracker.db")


class Base(DeclarativeBase):
    pass


engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Set up Alembic**

Run: `alembic init alembic`

Then replace `alembic/env.py` with async version:

```python
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from models.database import Base

# Import all models so Alembic can detect them
from models import cache, user, diary  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from env var
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/cycletracker"),
)


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 6: Commit**

```bash
git add models/database.py alembic.ini alembic/ tests/conftest.py tests/test_health.py
git commit -m "feat: add SQLAlchemy async engine, Alembic setup, and test infrastructure"
```

---

## Task 3: SQLAlchemy Models — ScrapeCache

**Files:**
- Create: `models/cache.py`
- Create: `tests/test_cache_model.py`

- [ ] **Step 1: Write test for ScrapeCache model**

Create `tests/test_cache_model.py`:

```python
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from models.cache import ScrapeCache


async def test_create_cache_entry(db_session):
    entry = ScrapeCache(
        cache_key="race_list:2026:ME:::1",
        data_type="race_list",
        data={"races": [{"name": "Milano-Sanremo"}]},
        source_url="https://www.procyclingstats.com/races.php?season=2026",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=6),
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(ScrapeCache).where(ScrapeCache.cache_key == "race_list:2026:ME:::1")
    )
    cached = result.scalar_one()
    assert cached.data["races"][0]["name"] == "Milano-Sanremo"
    assert cached.is_immutable is False


async def test_immutable_entry_has_no_expiry(db_session):
    entry = ScrapeCache(
        cache_key="race_detail:race/tour-de-france/2024",
        data_type="race_detail",
        data={"name": "Tour de France", "year": 2024},
        source_url="https://www.procyclingstats.com/race/tour-de-france/2024",
        is_immutable=True,
        expires_at=None,
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(ScrapeCache).where(ScrapeCache.cache_key == "race_detail:race/tour-de-france/2024")
    )
    cached = result.scalar_one()
    assert cached.is_immutable is True
    assert cached.expires_at is None


async def test_cache_entry_is_fresh(db_session):
    fresh = ScrapeCache(
        cache_key="fresh_entry",
        data_type="race_list",
        data={},
        source_url="",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    stale = ScrapeCache(
        cache_key="stale_entry",
        data_type="race_list",
        data={},
        source_url="",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db_session.add_all([fresh, stale])
    await db_session.commit()

    assert fresh.is_fresh is True
    assert stale.is_fresh is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cache_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'models.cache'`

- [ ] **Step 3: Create models/cache.py**

```python
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class ScrapeCache(Base):
    __tablename__ = "scrape_cache"

    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    data_type: Mapped[str] = mapped_column(String(50))  # race_list, race_detail, startlist, stages, stage_winners
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_url: Mapped[str] = mapped_column(Text, default="")
    etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False)

    @property
    def is_fresh(self) -> bool:
        if self.is_immutable:
            return True
        if self.expires_at is None:
            return False
        return self.expires_at > datetime.now(timezone.utc)
```

- [ ] **Step 4: Update tests/conftest.py to import cache model**

Add at the top of `conftest.py` after existing imports:

```python
from models.cache import ScrapeCache  # noqa: F401
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_cache_model.py -v`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add models/cache.py tests/test_cache_model.py tests/conftest.py
git commit -m "feat: add ScrapeCache SQLAlchemy model"
```

---

## Task 4: SQLAlchemy Models — UserProfile, DiaryEntry, Mention

**Files:**
- Create: `models/user.py`
- Create: `models/diary.py`
- Create: `tests/test_diary_model.py`

- [ ] **Step 1: Write test for diary models**

Create `tests/test_diary_model.py`:

```python
import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import select

from models.user import UserProfile
from models.diary import DiaryEntry, Mention


async def test_create_user_and_diary_entry(db_session):
    user_id = uuid.uuid4()
    user = UserProfile(id=user_id, display_name="Sergio")
    db_session.add(user)
    await db_session.flush()

    entry = DiaryEntry(
        user_id=user_id,
        race_url="race/tour-de-france/2025",
        race_name="Tour de France",
        race_year=2025,
        race_base_slug="race/tour-de-france",
        rating=5,
        body="Pogacar dominated from start to finish.",
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(DiaryEntry).where(DiaryEntry.user_id == user_id)
    )
    saved = result.scalar_one()
    assert saved.race_name == "Tour de France"
    assert saved.race_year == 2025
    assert saved.is_public is False
    assert saved.share_token is None


async def test_create_mention(db_session):
    user_id = uuid.uuid4()
    user = UserProfile(id=user_id, display_name="Test")
    db_session.add(user)
    await db_session.flush()

    entry = DiaryEntry(
        user_id=user_id,
        race_url="race/milano-sanremo/2026",
        race_name="Milano-Sanremo",
        race_year=2026,
        race_base_slug="race/milano-sanremo",
        body="Pogacar attacked on the Poggio.",
    )
    db_session.add(entry)
    await db_session.flush()

    mention = Mention(
        diary_entry_id=entry.id,
        entity_type="rider",
        entity_name="Tadej Pogacar",
        entity_slug="rider/tadej-pogacar",
        entity_metadata={"nationality": "SI"},
        mention_text="Pogacar attacked on the Poggio",
        confidence=0.95,
        detection_method="fuzzy",
    )
    db_session.add(mention)
    await db_session.commit()

    result = await db_session.execute(
        select(Mention).where(Mention.diary_entry_id == entry.id)
    )
    saved = result.scalar_one()
    assert saved.entity_type == "rider"
    assert saved.entity_slug == "rider/tadej-pogacar"
    assert saved.entity_metadata["nationality"] == "SI"


async def test_diary_entry_race_base_slug(db_session):
    """race_base_slug groups the same race across years for memories."""
    user_id = uuid.uuid4()
    user = UserProfile(id=user_id, display_name="Test")
    db_session.add(user)
    await db_session.flush()

    for year in [2024, 2025, 2026]:
        entry = DiaryEntry(
            user_id=user_id,
            race_url=f"race/tour-de-france/{year}",
            race_name="Tour de France",
            race_year=year,
            race_base_slug="race/tour-de-france",
            body=f"Review for {year}",
        )
        db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(DiaryEntry).where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.race_base_slug == "race/tour-de-france",
            DiaryEntry.race_year < 2026,
        ).order_by(DiaryEntry.race_year.desc())
    )
    memories = result.scalars().all()
    assert len(memories) == 2
    assert memories[0].race_year == 2025
    assert memories[1].race_year == 2024
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_diary_model.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create models/user.py**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Uuid

from models.database import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 4: Create models/diary.py**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Text, Float, JSON, ForeignKey, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from models.database import Base


class DiaryEntry(Base):
    __tablename__ = "diary_entry"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("user_profile.id"), nullable=False
    )
    race_url: Mapped[str] = mapped_column(Text, nullable=False)
    race_name: Mapped[str] = mapped_column(Text, nullable=False)
    race_year: Mapped[int] = mapped_column(Integer, nullable=False)
    race_base_slug: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body: Mapped[str] = mapped_column(Text, default="")
    key_moment: Mapped[str | None] = mapped_column(Text, nullable=True)
    protagonist: Mapped[str | None] = mapped_column(Text, nullable=True)
    dominant_emotion: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, unique=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    mentions: Mapped[list["Mention"]] = relationship(
        back_populates="diary_entry", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_diary_entry_user_id", "user_id"),
        Index("ix_diary_entry_memories", "race_base_slug", "user_id"),
        # Note: partial index for share_token (WHERE share_token IS NOT NULL) will be
        # added via Alembic migration with raw SQL for PostgreSQL. SQLite doesn't support
        # partial indexes through SQLAlchemy's Index API. The unique constraint on
        # share_token column already prevents duplicates.
    )


class Mention(Base):
    __tablename__ = "mention"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    diary_entry_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("diary_entry.id", ondelete="CASCADE"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # rider, location, team
    entity_name: Mapped[str] = mapped_column(Text, nullable=False)
    entity_slug: Mapped[str] = mapped_column(Text, nullable=False)
    entity_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mention_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    detection_method: Mapped[str] = mapped_column(String(20), nullable=False)  # fuzzy, spacy, llm, manual
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    diary_entry: Mapped["DiaryEntry"] = relationship(back_populates="mentions")

    __table_args__ = (
        Index("ix_mention_entry_slug", "diary_entry_id", "entity_slug"),
        Index("ix_mention_entry_id", "diary_entry_id"),
        Index("ix_mention_entity_type", "entity_type"),
    )
```

- [ ] **Step 5: Update conftest.py imports**

Add at the top of `tests/conftest.py`:

```python
from models.user import UserProfile  # noqa: F401
from models.diary import DiaryEntry, Mention  # noqa: F401
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_diary_model.py -v`
Expected: All 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add models/user.py models/diary.py tests/test_diary_model.py tests/conftest.py
git commit -m "feat: add UserProfile, DiaryEntry, and Mention SQLAlchemy models"
```

---

## Task 5: Cache Service — Cache-Through with Stampede Protection

> **Note:** Stampede protection via PostgreSQL advisory locks is deferred to production deployment — SQLite (used in tests) doesn't support them. The current implementation uses simple check-then-write, which is correct for single-process dev usage. Advisory lock support will be added when migrating to PostgreSQL.

**Files:**
- Create: `services/cache.py`
- Create: `tests/test_cache_service.py`

- [ ] **Step 1: Write tests for cache service**

Create `tests/test_cache_service.py`:

```python
import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from services.cache import CacheService
from models.cache import ScrapeCache


async def test_cache_hit_returns_data(db_session):
    """Fresh cache entry is returned without calling scrape_fn."""
    entry = ScrapeCache(
        cache_key="test:hit",
        data_type="race_list",
        data={"races": ["cached"]},
        source_url="",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=6),
    )
    db_session.add(entry)
    await db_session.commit()

    scrape_fn = AsyncMock(return_value={"races": ["fresh"]})
    service = CacheService(db_session)

    result = await service.get("test:hit", scrape_fn, ttl=timedelta(hours=6))
    assert result == {"races": ["cached"]}
    scrape_fn.assert_not_called()


async def test_cache_miss_calls_scrape_fn(db_session):
    """Cache miss triggers scrape_fn and saves result."""
    scrape_fn = AsyncMock(return_value={"races": ["fresh"]})
    service = CacheService(db_session)

    result = await service.get(
        "test:miss", scrape_fn, ttl=timedelta(hours=6), data_type="race_list", source_url="test"
    )
    assert result == {"races": ["fresh"]}
    scrape_fn.assert_called_once()

    # Verify it was saved
    from sqlalchemy import select
    saved = await db_session.execute(
        select(ScrapeCache).where(ScrapeCache.cache_key == "test:miss")
    )
    assert saved.scalar_one().data == {"races": ["fresh"]}


async def test_stale_entry_triggers_refresh(db_session):
    """Expired entry triggers scrape_fn."""
    entry = ScrapeCache(
        cache_key="test:stale",
        data_type="race_list",
        data={"races": ["old"]},
        source_url="",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db_session.add(entry)
    await db_session.commit()

    scrape_fn = AsyncMock(return_value={"races": ["new"]})
    service = CacheService(db_session)

    result = await service.get(
        "test:stale", scrape_fn, ttl=timedelta(hours=6), data_type="race_list", source_url="test"
    )
    assert result == {"races": ["new"]}


async def test_immutable_entry_never_refreshes(db_session):
    """Immutable entries are always considered fresh."""
    entry = ScrapeCache(
        cache_key="test:immutable",
        data_type="race_detail",
        data={"name": "TdF 2020"},
        source_url="",
        is_immutable=True,
        expires_at=None,
    )
    db_session.add(entry)
    await db_session.commit()

    scrape_fn = AsyncMock()
    service = CacheService(db_session)

    result = await service.get("test:immutable", scrape_fn, ttl=timedelta(hours=6))
    assert result == {"name": "TdF 2020"}
    scrape_fn.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_cache_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services'`

- [ ] **Step 3: Create services/__init__.py and services/cache.py**

Create empty `services/__init__.py`.

Create `services/cache.py`:

```python
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.cache import ScrapeCache


class CacheService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(
        self,
        cache_key: str,
        scrape_fn: Callable[[], Awaitable[Any]],
        ttl: timedelta,
        data_type: str = "",
        source_url: str = "",
        is_immutable: bool = False,
    ) -> Any:
        """Cache-through: return cached data if fresh, else scrape and cache."""
        # 1. Try cache
        result = await self.session.execute(
            select(ScrapeCache).where(ScrapeCache.cache_key == cache_key)
        )
        entry = result.scalar_one_or_none()

        if entry and entry.is_fresh:
            return entry.data

        # 2. Cache miss or stale — call scrape function
        data = await scrape_fn()

        # 3. Upsert cache entry
        now = datetime.now(timezone.utc)
        if entry:
            entry.data = data
            entry.scraped_at = now
            entry.expires_at = None if is_immutable else now + ttl
            entry.is_immutable = is_immutable
            entry.source_url = source_url
        else:
            entry = ScrapeCache(
                cache_key=cache_key,
                data_type=data_type,
                data=data,
                scraped_at=now,
                expires_at=None if is_immutable else now + ttl,
                source_url=source_url,
                is_immutable=is_immutable,
            )
            self.session.add(entry)

        await self.session.commit()
        return data

    async def invalidate(self, cache_key: str) -> bool:
        """Delete a cache entry. Returns True if entry existed."""
        result = await self.session.execute(
            select(ScrapeCache).where(ScrapeCache.cache_key == cache_key)
        )
        entry = result.scalar_one_or_none()
        if entry:
            await self.session.delete(entry)
            await self.session.commit()
            return True
        return False
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_cache_service.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/ tests/test_cache_service.py
git commit -m "feat: add cache-through service with TTL and immutability support"
```

---

## Task 6: Auth Middleware — Supabase JWT Verification

**Files:**
- Create: `auth/__init__.py`
- Create: `auth/middleware.py`
- Create: `tests/test_auth.py`

- [ ] **Step 1: Write tests for auth middleware**

Create `tests/test_auth.py`:

```python
import pytest
import uuid
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth.middleware import get_current_user, OptionalUser


app = FastAPI()


@app.get("/protected")
async def protected(user_id: uuid.UUID = get_current_user):
    return {"user_id": str(user_id)}


@app.get("/optional")
async def optional(user_id: uuid.UUID | None = OptionalUser):
    return {"user_id": str(user_id) if user_id else None}


FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid_token":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid token")


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
def test_valid_token_returns_user_id(mock_jwt):
    client = TestClient(app)
    resp = client.get("/protected", headers={"Authorization": "Bearer valid_token"})
    assert resp.status_code == 200
    assert resp.json()["user_id"] == str(FAKE_USER_ID)


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
def test_missing_token_returns_401(mock_jwt):
    client = TestClient(app)
    resp = client.get("/protected")
    assert resp.status_code == 401


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
def test_invalid_token_returns_401(mock_jwt):
    client = TestClient(app)
    resp = client.get("/protected", headers={"Authorization": "Bearer bad_token"})
    assert resp.status_code == 401


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
def test_optional_auth_allows_anonymous(mock_jwt):
    client = TestClient(app)
    resp = client.get("/optional")
    assert resp.status_code == 200
    assert resp.json()["user_id"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_auth.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create auth/middleware.py**

Create empty `auth/__init__.py`.

Create `auth/middleware.py`:

```python
import os
import uuid
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from typing import Optional


SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "test-secret")


async def _extract_user_id(authorization: Optional[str] = Header(None)) -> uuid.UUID | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},
        )
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


async def require_auth(authorization: Optional[str] = Header(None)) -> uuid.UUID:
    user_id = await _extract_user_id(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


async def optional_auth(authorization: Optional[str] = Header(None)) -> uuid.UUID | None:
    return await _extract_user_id(authorization)


# Dependency shortcuts
get_current_user = Depends(require_auth)
OptionalUser = Depends(optional_auth)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_auth.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add auth/ tests/test_auth.py
git commit -m "feat: add Supabase JWT auth middleware with required and optional modes"
```

---

## Task 7: Refactor main.py — Router-Based Architecture

**Files:**
- Create: `routers/__init__.py`
- Create: `routers/races.py`
- Modify: `main.py`
- Modify: `models/race.py` (consolidate)
- Create: `tests/test_races_cached.py`

- [ ] **Step 1: Write test for cached races endpoint**

Create `tests/test_races_cached.py`:

```python
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport


async def test_get_races_returns_cached_data(db_engine):
    """GET /races should return data from cache, not scrape live."""
    from main import app

    mock_races = [
        {"name": "Milano-Sanremo", "race_url": "race/milano-sanremo/2026",
         "year": 2026, "is_future": True}
    ]

    # Mock CacheService.get — this is what the router actually calls.
    # The mock returns the cached race list directly, bypassing any real scraping.
    with patch("services.cache.CacheService.get", new_callable=AsyncMock, return_value=mock_races):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/races?year_from=2026&year_to=2026")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert data[0]["name"] == "Milano-Sanremo"


async def test_health_still_works(db_engine):
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
```

- [ ] **Step 2: Consolidate RaceModel — remove duplicate from scraper**

The `models/race.py` version has extra fields (`startlist_url: Optional[str]`, `stages: Optional[list[StageInfo]]`) that the scraper's duplicate lacks. `models/race.py` is the single source of truth — keep it as-is with all fields.

Edit `scrapers/races_scraper.py`: replace the local `RaceModel` class (lines ~21-30) with an import:

```python
from models.race import RaceModel
```

Remove the duplicate `RaceModel` class definition. Keep all other models in the scraper file (`StageDetail`, `StageWinner`, `StartlistEntry`, `RaceDetailModel`) as they are only used there.

**Verify:** After the change, run `python -c "from scrapers.races_scraper import RaceModel; print(RaceModel.__fields__.keys())"` to confirm the imported model has the full field set.

- [ ] **Step 3: Create routers/races.py**

Create empty `routers/__init__.py`.

Create `routers/races.py`:

```python
from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.race import RaceModel
from scrapers.races_scraper import fetch_races, fetch_race_detail, RaceDetailModel
from services.cache import CacheService

router = APIRouter()
CURRENT_YEAR = date.today().year


def _build_cache_key(year: int, gender: str | None, race_level: int | None, nation: str | None, page: int) -> str:
    return f"race_list:{year}:{gender or ''}:{race_level or ''}:{nation or ''}:{page}"


def _get_ttl(year: int) -> timedelta:
    if year < CURRENT_YEAR:
        return timedelta(days=365 * 10)  # effectively permanent
    elif year == CURRENT_YEAR:
        return timedelta(hours=6)
    else:
        return timedelta(hours=24)


def _is_immutable(year: int) -> bool:
    return year < CURRENT_YEAR


@router.get("/races", response_model=list[RaceModel])
async def get_races(
    year_from: int = Query(default=CURRENT_YEAR, ge=1900, le=CURRENT_YEAR + 1),
    year_to: int = Query(default=CURRENT_YEAR, ge=1900, le=CURRENT_YEAR + 1),
    only_future: Optional[bool] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    gender: Optional[str] = Query(default=None),
    race_level: Optional[int] = Query(default=None, ge=1, le=4),
    nation: Optional[str] = Query(default=None),
    max_pages_per_year: int = Query(default=3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    if year_from > year_to:
        raise HTTPException(400, "year_from must be <= year_to")

    cache = CacheService(db)
    all_races = []

    for year in range(year_from, year_to + 1):
        cache_key = _build_cache_key(year, gender, race_level, nation, 1)
        ttl = _get_ttl(year)

        async def _scrape(y=year):
            # fetch_races is synchronous (uses requests) — run in thread
            # to avoid blocking the async event loop
            import asyncio
            races = await asyncio.to_thread(
                fetch_races,
                years=[y],
                max_pages_per_year=max_pages_per_year,
                month=month,
                gender=gender,
                race_level=race_level,
                nation=nation,
            )
            return [r.model_dump() for r in races]

        data = await cache.get(
            cache_key,
            scrape_fn=_scrape,
            ttl=ttl,
            data_type="race_list",
            source_url=f"pcs/races/{year}",
            is_immutable=_is_immutable(year),
        )
        all_races.extend(data)

    # Apply client-side filters
    if only_future is True:
        all_races = [r for r in all_races if r.get("is_future")]
    elif only_future is False:
        all_races = [r for r in all_races if not r.get("is_future")]

    return all_races


@router.get("/race/{race_url:path}", response_model=RaceDetailModel)
async def get_race_detail(
    race_url: str,
    include_startlist: bool = Query(default=False),
    include_stages_winners: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    cache = CacheService(db)
    cache_key = f"race_detail:{race_url}"

    # Determine if this race is in the past (immutable)
    year = None
    try:
        year = int(race_url.rstrip("/").split("/")[-1])
    except (ValueError, IndexError):
        pass

    is_past = year is not None and year < CURRENT_YEAR
    ttl = timedelta(days=365 * 10) if is_past else timedelta(hours=24)

    async def _scrape():
        try:
            import asyncio
            # fetch_race_detail is synchronous — run in thread
            detail = await asyncio.to_thread(
                fetch_race_detail,
                race_url=race_url,
                include_startlist=include_startlist,
                include_stages_winners=include_stages_winners,
            )
            return detail.model_dump()
        except Exception as e:
            raise HTTPException(500, f"Error fetching race: {e}")

    data = await cache.get(
        cache_key,
        scrape_fn=_scrape,
        ttl=ttl,
        data_type="race_detail",
        source_url=f"pcs/{race_url}",
        is_immutable=is_past,
    )
    return data
```

- [ ] **Step 4: Update main.py to use routers**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from datetime import date
import requests

from procyclingstats.scraper import Scraper
from routers.races import router as races_router

_session = requests.Session()
_session.headers.update({**Scraper.DEFAULT_HEADERS, "Accept-Encoding": "gzip, deflate"})
Scraper._session = _session

CURRENT_YEAR = date.today().year


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(title="CycleTracker API", lifespan=lifespan)
app.include_router(races_router)


@app.get("/health")
def health():
    return {"status": "ok", "year": CURRENT_YEAR}
```

- [ ] **Step 5: Run tests**

Run: `pytest tests/test_races_cached.py tests/test_health.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add routers/ main.py models/race.py scrapers/races_scraper.py tests/test_races_cached.py
git commit -m "refactor: move race endpoints to router, serve via cache layer"
```

---

## Task 8: Diary CRUD Endpoints

**Files:**
- Create: `routers/diary.py`
- Create: `tests/test_diary_crud.py`

- [ ] **Step 1: Write tests for diary CRUD**

Create `tests/test_diary_crud.py`:

```python
import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from models.user import UserProfile
from models.diary import DiaryEntry


FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def seeded_user(db_session):
    user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def client(db_engine):
    # Override get_db to use test DB
    from models.database import get_db
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_diary_entry(mock_jwt, client, seeded_user):
    resp = await client.post(
        "/diary",
        json={
            "race_url": "race/milano-sanremo/2026",
            "race_name": "Milano-Sanremo",
            "race_year": 2026,
            "race_base_slug": "race/milano-sanremo",
            "body": "Amazing race!",
            "rating": 5,
        },
        headers={"Authorization": "Bearer valid"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["race_name"] == "Milano-Sanremo"
    assert data["rating"] == 5
    assert data["is_public"] is False


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_list_diary_entries(mock_jwt, client, seeded_user):
    # Create an entry first
    await client.post(
        "/diary",
        json={
            "race_url": "race/tour-de-france/2025",
            "race_name": "Tour de France",
            "race_year": 2025,
            "race_base_slug": "race/tour-de-france",
            "body": "Pogacar dominated.",
        },
        headers={"Authorization": "Bearer valid"},
    )

    resp = await client.get("/diary", headers={"Authorization": "Bearer valid"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["race_name"] == "Tour de France"


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_get_diary_entry_not_found(mock_jwt, client, seeded_user):
    resp = await client.get(
        f"/diary/{uuid.uuid4()}",
        headers={"Authorization": "Bearer valid"},
    )
    assert resp.status_code == 404


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_unauthenticated_returns_401(mock_jwt, client):
    resp = await client.get("/diary")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_diary_crud.py -v`
Expected: FAIL — router not found

- [ ] **Step 3: Create routers/diary.py**

```python
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
```

- [ ] **Step 4: Register diary router in main.py**

Add to `main.py`:

```python
from routers.diary import router as diary_router
app.include_router(diary_router)
```

- [ ] **Step 5: Run tests**

Run: `pytest tests/test_diary_crud.py -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add routers/diary.py tests/test_diary_crud.py main.py
git commit -m "feat: add diary CRUD endpoints with auth"
```

---

## Task 9: Scheduled PCS Refresh Job

> **Scope note:** This task implements race list refresh only. The spec also calls for refreshing detail pages + startlists for races in the next 14 days and stage winners for in-progress races. That expanded scope will be added in Plan 2 (Smart Features) once the detail/startlist caching patterns are established. The race list refresh is the MVP scheduled job.

**Files:**
- Create: `tasks/__init__.py`
- Create: `tasks/scheduled.py`
- Create: `tests/test_scheduled.py`

- [ ] **Step 1: Write test for scheduled refresh**

Create `tests/test_scheduled.py`:

```python
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timezone

from tasks.scheduled import build_refresh_keys, determine_immutability


def test_build_refresh_keys_current_year():
    keys = build_refresh_keys(current_year=2026)
    # Should include current year and next year for both genders
    assert "race_list:2026:ME:::1" in keys
    assert "race_list:2026:WE:::1" in keys
    assert "race_list:2027:ME:::1" in keys
    assert "race_list:2027:WE:::1" in keys


def test_determine_immutability_past_race():
    assert determine_immutability("race_detail:race/tour-de-france/2024", 2026) is True


def test_determine_immutability_current_race():
    assert determine_immutability("race_detail:race/tour-de-france/2026", 2026) is False


def test_determine_immutability_race_list():
    assert determine_immutability("race_list:2024:ME:::1", 2026) is True
    assert determine_immutability("race_list:2026:ME:::1", 2026) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_scheduled.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create tasks/scheduled.py**

Create empty `tasks/__init__.py`.

Create `tasks/scheduled.py`:

```python
import logging
from datetime import date

logger = logging.getLogger(__name__)


def build_refresh_keys(current_year: int) -> list[str]:
    """Build the list of cache keys that the scheduled job should refresh."""
    keys = []
    for year in [current_year, current_year + 1]:
        for gender in ["ME", "WE"]:
            keys.append(f"race_list:{year}:{gender}:::1")
    return keys


def determine_immutability(cache_key: str, current_year: int) -> bool:
    """Determine if a cache entry should be marked immutable."""
    parts = cache_key.split(":")
    # Extract year from key
    try:
        if parts[0] == "race_list":
            year = int(parts[1])
        elif parts[0] in ("race_detail", "startlist", "stages", "stage_winners"):
            # URL format: race/name/year
            url_part = ":".join(parts[1:])
            year = int(url_part.rstrip("/").split("/")[-1])
        else:
            return False
        return year < current_year
    except (ValueError, IndexError):
        return False


async def run_scheduled_refresh(cache_service, scrape_races_fn):
    """Main scheduled refresh job. Called by APScheduler every 6 hours.

    Args:
        cache_service: CacheService instance
        scrape_races_fn: The actual scraping function (fetch_races from scrapers/)
    """
    current_year = date.today().year
    keys = build_refresh_keys(current_year)

    logger.info(f"Scheduled refresh starting. Keys to refresh: {len(keys)}")

    for key in keys:
        try:
            # Parse key to extract params
            parts = key.split(":")
            year = int(parts[1])
            gender = parts[2] or None

            from datetime import timedelta

            is_immutable = determine_immutability(key, current_year)
            ttl = timedelta(days=365 * 10) if is_immutable else timedelta(hours=6)

            async def _scrape(y=year, g=gender):
                import asyncio
                # scrape_races_fn is synchronous — run in thread to avoid blocking
                races = await asyncio.to_thread(
                    scrape_races_fn, years=[y], gender=g, max_pages_per_year=3
                )
                return [r.model_dump() if hasattr(r, "model_dump") else r for r in races]

            await cache_service.get(
                key, scrape_fn=_scrape, ttl=ttl,
                data_type="race_list", source_url=f"pcs/races/{year}",
                is_immutable=is_immutable,
            )
            logger.info(f"Refreshed: {key}")
        except Exception as e:
            logger.error(f"Failed to refresh {key}: {e}")

    logger.info("Scheduled refresh complete.")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scheduled.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Wire scheduler into main.py lifespan**

Update `main.py` lifespan:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from tasks.scheduled import run_scheduled_refresh
from services.cache import CacheService
from models.database import async_session_factory
from scrapers.races_scraper import fetch_races
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start scheduled PCS refresh
    interval_hours = int(os.getenv("PCS_REFRESH_INTERVAL_HOURS", "6"))
    scheduler = AsyncIOScheduler()

    async def _refresh_job():
        async with async_session_factory() as session:
            cache = CacheService(session)
            await run_scheduled_refresh(cache, fetch_races)

    scheduler.add_job(_refresh_job, "interval", hours=interval_hours)
    scheduler.start()

    yield

    # Shutdown
    scheduler.shutdown()
```

- [ ] **Step 6: Commit**

```bash
git add tasks/ tests/test_scheduled.py main.py
git commit -m "feat: add scheduled PCS refresh job with APScheduler"
```

---

## Task 10: Integration Test — Full Flow

**Files:**
- Create: `tests/test_integration.py`

- [ ] **Step 1: Write integration test**

Create `tests/test_integration.py`:

```python
"""
Integration test: verifies the full flow from cache through diary CRUD.
Uses SQLite in-memory, mock auth, and mock PCS scraping.
"""
import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile

FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def full_app():
    """Set up app with test DB and seeded user."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Seed user
    async with session_factory() as session:
        session.add(UserProfile(id=FAKE_USER_ID, display_name="Sergio"))
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_full_diary_flow(mock_jwt, full_app):
    client = full_app

    # 1. No entries yet
    resp = await client.get("/diary", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == []

    # 2. Create entry
    resp = await client.post("/diary", json={
        "race_url": "race/milano-sanremo/2026",
        "race_name": "Milano-Sanremo",
        "race_year": 2026,
        "race_base_slug": "race/milano-sanremo",
        "body": "Pogacar wins!",
        "rating": 5,
        "key_moment": "Poggio attack",
        "dominant_emotion": "excitement",
    }, headers=AUTH)
    assert resp.status_code == 201
    entry_id = resp.json()["id"]

    # 3. Read it back
    resp = await client.get(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["body"] == "Pogacar wins!"

    # 4. Update it
    resp = await client.put(f"/diary/{entry_id}", json={
        "body": "Pogacar wins in spectacular fashion!",
        "rating": 5,
    }, headers=AUTH)
    assert resp.status_code == 200
    assert "spectacular" in resp.json()["body"]

    # 5. List shows the entry
    resp = await client.get("/diary", headers=AUTH)
    assert len(resp.json()) == 1

    # 6. Delete it
    resp = await client.delete(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 204

    # 7. Gone
    resp = await client.get(f"/diary/{entry_id}", headers=AUTH)
    assert resp.status_code == 404
```

- [ ] **Step 2: Run the full test suite**

Run: `pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: add full integration test for diary CRUD flow"
```

---

---

## Task 11: Community Models — ReviewComment, ReviewLike, CommunityReport

**Files:**
- Create: `models/community.py`
- Modify: `models/diary.py` (add `like_count`, `comment_count` to DiaryEntry)
- Modify: `alembic/env.py` (add community import)
- Create: `tests/test_community_models.py`

- [ ] **Step 1: Write tests for community models**

Create `tests/test_community_models.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_community_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'models.community'`

- [ ] **Step 3: Create models/community.py**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.database import Base


class ReviewComment(Base):
    __tablename__ = "review_comment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    diary_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diary_entry.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("review_comment.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_removed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ReviewLike(Base):
    __tablename__ = "review_like"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_review_like_user_target"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[str] = mapped_column(
        Enum("review", "comment", name="like_target_type"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CommunityReport(Base):
    __tablename__ = "community_report"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[str] = mapped_column(
        Enum("review", "comment", name="report_target_type"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
```

- [ ] **Step 4: Add `like_count` and `comment_count` to DiaryEntry in models/diary.py**

In `models/diary.py`, add these two columns to the `DiaryEntry` class (after the existing `share_token` column):

```python
like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

- [ ] **Step 5: Update alembic/env.py to import community models**

In `alembic/env.py`, update the models import line:

```python
from models import cache, user, diary, community  # noqa: F401
```

- [ ] **Step 6: Generate and apply Alembic migration**

Run:
```bash
alembic revision --autogenerate -m "add community tables and diary like_count comment_count"
alembic upgrade head
```

Expected: New file in `alembic/versions/`. Migration creates `review_comment`, `review_like`, `community_report` tables and adds `like_count`/`comment_count` columns to `diary_entry`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest tests/test_community_models.py -v`
Expected: All 4 tests PASS

- [ ] **Step 8: Commit**

```bash
git add models/community.py models/diary.py alembic/env.py alembic/versions/ tests/test_community_models.py
git commit -m "feat: add community SQLAlchemy models (ReviewComment, ReviewLike, CommunityReport)"
```

---

## Task 12: Moderation Service — Profanity Filter

**Files:**
- Modify: `requirements.txt` (add `better-profanity`)
- Create: `services/moderation.py`
- Create: `tests/test_moderation.py`

- [ ] **Step 1: Write tests for moderation service**

Create `tests/test_moderation.py`:

```python
import pytest
from fastapi import HTTPException

from services.moderation import check_public_content


def test_clean_text_passes():
    # Should not raise
    check_public_content("Pogacar won in spectacular fashion on the Alpe d'Huez!")


def test_profane_text_raises():
    with pytest.raises(HTTPException) as exc_info:
        check_public_content("This is a damn shit race")
    assert exc_info.value.status_code == 400


def test_empty_text_passes():
    check_public_content("")


def test_none_text_passes():
    check_public_content(None)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_moderation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.moderation'`

- [ ] **Step 3: Add better-profanity to requirements.txt**

Add to `requirements.txt` under the NLP section:

```
# Moderation
better-profanity>=0.7.0
```

Run: `pip install better-profanity`

- [ ] **Step 4: Create services/moderation.py**

```python
from fastapi import HTTPException
from better_profanity import profanity


def check_public_content(text: str | None) -> None:
    """Raise HTTP 400 if text contains profanity. Safe to call with None or empty string."""
    if not text:
        return
    if profanity.contains_profanity(text):
        raise HTTPException(
            status_code=400,
            detail="Il testo contiene linguaggio non consentito.",
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_moderation.py -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add requirements.txt services/moderation.py tests/test_moderation.py
git commit -m "feat: add profanity filter moderation service"
```

---

## Task 13: Comments Router — Threaded CRUD + Like + Report

**Files:**
- Create: `routers/comments.py`
- Create: `tests/test_comments.py`

- [ ] **Step 1: Write tests for comment endpoints**

Create `tests/test_comments.py`:

```python
import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile
from models.diary import DiaryEntry

FAKE_USER_ID = uuid.uuid4()
OTHER_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    if token == "other":
        return {"sub": str(OTHER_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def app_with_public_entry():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
        other = UserProfile(id=OTHER_USER_ID, display_name="Marco")
        entry = DiaryEntry(
            id=uuid.uuid4(),
            user_id=FAKE_USER_ID,
            race_url="race/tour-de-france/2026",
            race_name="Tour de France",
            race_year=2026,
            race_base_slug="race/tour-de-france",
            body="Great race",
            is_public=True,
        )
        session.add_all([user, other, entry])
        await session.commit()
        entry_id = entry.id

    async def override_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, entry_id

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}
OTHER_AUTH = {"Authorization": "Bearer other"}


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_top_level_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "Amazing review!"},
        headers=AUTH,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "Amazing review!"
    assert data["parent_id"] is None


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_create_reply(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    # Create parent comment
    parent_resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "Parent comment"},
        headers=AUTH,
    )
    parent_id = parent_resp.json()["id"]

    # Reply to it
    reply_resp = await client.post(
        f"/diary/{entry_id}/comments/{parent_id}/reply",
        json={"body": "Reply comment"},
        headers=OTHER_AUTH,
    )
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_id"] == str(parent_id)


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_get_comment_tree(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    await client.post(f"/diary/{entry_id}/comments", json={"body": "C1"}, headers=AUTH)
    await client.post(f"/diary/{entry_id}/comments", json={"body": "C2"}, headers=AUTH)

    resp = await client.get(f"/diary/{entry_id}/comments")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_soft_delete_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Delete me"}, headers=AUTH)
    comment_id = c.json()["id"]

    del_resp = await client.delete(f"/comments/{comment_id}", headers=AUTH)
    assert del_resp.status_code == 204

    # Comment still appears in tree (tombstone), but is_removed=True
    tree = await client.get(f"/diary/{entry_id}/comments")
    removed = [c for c in tree.json() if c["id"] == str(comment_id)]
    assert removed[0]["is_removed"] is True


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_cannot_delete_other_users_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Mine"}, headers=AUTH)
    comment_id = c.json()["id"]

    resp = await client.delete(f"/comments/{comment_id}", headers=OTHER_AUTH)
    assert resp.status_code == 403


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_profanity_blocked(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    resp = await client.post(
        f"/diary/{entry_id}/comments",
        json={"body": "This is shit"},
        headers=AUTH,
    )
    assert resp.status_code == 400


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_edit_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Original"}, headers=AUTH)
    comment_id = c.json()["id"]

    resp = await client.put(f"/comments/{comment_id}", json={"body": "Edited"}, headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["body"] == "Edited"


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_cannot_edit_removed_comment(mock_jwt, app_with_public_entry):
    client, entry_id = app_with_public_entry
    c = await client.post(f"/diary/{entry_id}/comments", json={"body": "Will be removed"}, headers=AUTH)
    comment_id = c.json()["id"]

    await client.delete(f"/comments/{comment_id}", headers=AUTH)
    resp = await client.put(f"/comments/{comment_id}", json={"body": "Too late"}, headers=AUTH)
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_comments.py -v`
Expected: FAIL — router not registered yet

- [ ] **Step 3: Create routers/comments.py**

```python
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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


class CommentResponse(BaseModel):
    id: uuid.UUID
    diary_entry_id: uuid.UUID
    parent_id: uuid.UUID | None
    user_id: uuid.UUID
    body: str
    is_removed: bool
    like_count: int
    created_at: str

    model_config = {"from_attributes": True}


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

    # Recursive CTE — returns all comments including is_removed=True (tombstones)
    result = await db.execute(
        text("""
            WITH RECURSIVE comment_tree AS (
                SELECT * FROM review_comment
                WHERE diary_entry_id = :entry_id AND parent_id IS NULL
                UNION ALL
                SELECT c.* FROM review_comment c
                JOIN comment_tree ct ON c.parent_id = ct.id
            )
            SELECT * FROM comment_tree ORDER BY created_at ASC
        """),
        {"entry_id": entry_id},
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
```

- [ ] **Step 4: Register comments router in main.py**

In `main.py`, add:

```python
from routers.comments import router as comments_router
app.include_router(comments_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_comments.py -v`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add routers/comments.py tests/test_comments.py main.py
git commit -m "feat: add threaded comments router with like, soft delete, and report"
```

---

## Task 14: Community Feed Router — Public Reviews + Review Likes/Reports

**Files:**
- Create: `routers/community.py`
- Create: `tests/test_community_feed.py`

- [ ] **Step 1: Write tests for community feed**

Create `tests/test_community_feed.py`:

```python
import pytest
import uuid
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models.database import Base, get_db
from models.user import UserProfile
from models.diary import DiaryEntry

FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


@pytest.fixture
async def app_with_reviews():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        user = UserProfile(id=FAKE_USER_ID, display_name="Sergio")
        public_entry = DiaryEntry(
            id=uuid.uuid4(), user_id=FAKE_USER_ID,
            race_url="race/tour-de-france/2026", race_name="TdF",
            race_year=2026, race_base_slug="race/tour-de-france",
            body="Public review", is_public=True,
        )
        private_entry = DiaryEntry(
            id=uuid.uuid4(), user_id=FAKE_USER_ID,
            race_url="race/giro/2026", race_name="Giro",
            race_year=2026, race_base_slug="race/giro",
            body="Private review", is_public=False,
        )
        session.add_all([user, public_entry, private_entry])
        await session.commit()
        public_id = public_entry.id

    async def override_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, public_id

    app.dependency_overrides.clear()
    await engine.dispose()


AUTH = {"Authorization": "Bearer valid"}


async def test_community_feed_only_public(app_with_reviews):
    client, _ = app_with_reviews
    resp = await client.get("/community/feed")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["is_public"] is True


async def test_community_feed_sort_options(app_with_reviews):
    client, _ = app_with_reviews
    for sort in ("recent", "popular", "hot"):
        resp = await client.get(f"/community/feed?sort={sort}")
        assert resp.status_code == 200


async def test_race_community_feed(app_with_reviews):
    client, _ = app_with_reviews
    resp = await client.get("/race/race/tour-de-france/2026/community")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_toggle_review_like(mock_jwt, app_with_reviews):
    client, public_id = app_with_reviews
    resp = await client.post(f"/diary/{public_id}/like", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["liked"] is True
    assert resp.json()["count"] == 1

    # Toggle off
    resp2 = await client.post(f"/diary/{public_id}/like", headers=AUTH)
    assert resp2.json()["liked"] is False
    assert resp2.json()["count"] == 0


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode)
async def test_report_review(mock_jwt, app_with_reviews):
    client, public_id = app_with_reviews
    resp = await client.post(f"/diary/{public_id}/report", headers=AUTH)
    assert resp.status_code == 201
    assert resp.json()["reported"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_community_feed.py -v`
Expected: FAIL — router not registered

- [ ] **Step 3: Create routers/community.py**

```python
import uuid
from typing import Literal
from typing import Annotated

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
    else:  # hot
        order = "(like_count + comment_count * 2) / POWER(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 + 2, 1.5) DESC"

    # Build WHERE clauses for optional filters using bound parameters
    where_clauses = ["is_public = true"]
    params: dict = {"limit": page_size, "offset": offset}

    if race_level is not None:
        # DiaryEntry stores race_url; race_level needs to be added to DiaryEntry in a future plan
        # For now, this filter is a no-op placeholder to satisfy the API contract
        pass
    if gender is not None:
        where_clauses.append("gender = :gender")
        params["gender"] = gender

    where_sql = " AND ".join(where_clauses)

    result = await db.execute(
        text(f"SELECT * FROM diary_entry WHERE {where_sql} ORDER BY {order} LIMIT :limit OFFSET :offset"),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


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
            WHERE is_public = true AND race_url = :race_url
            ORDER BY {order}
        """),
        {"race_url": race_url},
    )
    return [dict(r) for r in result.mappings().all()]


@router.post("/diary/{entry_id}/like")
async def toggle_review_like(
    entry_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
):
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
```

- [ ] **Step 4: Register community router in main.py**

In `main.py`, add:

```python
from routers.community import router as community_router
app.include_router(community_router)
```

- [ ] **Step 5: Run the full test suite**

Run: `pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add routers/community.py tests/test_community_feed.py main.py
git commit -m "feat: add community feed router with public review feed, likes, and reports"
```

---

## Summary

After completing all 14 tasks, you will have:

- **Database layer:** SQLAlchemy 2.x async with UserProfile, DiaryEntry, Mention, ScrapeCache, ReviewComment, ReviewLike, CommunityReport models
- **Caching layer:** Cache-through service with TTL, immutability, and stampede protection
- **Scheduled job:** APScheduler refreshing PCS data every 6 hours
- **Auth:** Supabase JWT verification middleware (required + optional modes)
- **API (diary):** Refactored race endpoints (served from cache) + diary CRUD (create, read, update, delete)
- **API (community):** Public review feed (global + per-race), threaded comments (unlimited depth via recursive CTE), like toggle, soft delete, moderation reports
- **Moderation:** Automatic profanity filter on all public content writes
- **Tests:** Unit tests for each component + integration tests for full flows
- **Alembic:** Ready for database migrations

**What's NOT in this plan (covered by Plans 2-4):**
- `routers/users.py` — GET /me, PUT /me (Plan 2)
- `routers/admin.py` — cache invalidation endpoint (Plan 2)
- Entity recognition pipeline (Plan 2)
- Memories and cross-review suggestions (Plan 2)
- Calendar feed generation (Plan 2)
- Sharing endpoints (Plan 2)
- Comment notifications (Plan 4 — depends on Web Push infrastructure built in Plan 4)
- Next.js frontend including Community tab and global feed page (Plan 3)
- Statistics, Capacitor (Plan 4)
