import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from unittest.mock import patch

from models.database import Base, get_db
from models.user import UserProfile  # noqa: F401
from models.diary import DiaryEntry, Mention  # noqa: F401
from models.community import ReviewComment, ReviewLike, CommunityReport  # noqa: F401
from models.watchlist import Watchlist  # noqa: F401
from models.calendar import CalendarFilter  # noqa: F401


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

FAKE_USER_ID = uuid.uuid4()


def _mock_decode(token, key, algorithms, audience, options=None):
    if token == "valid":
        return {"sub": str(FAKE_USER_ID)}
    raise Exception("Invalid")


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


@pytest.fixture(scope="function")
async def async_client(db_engine, db_session):
    from models.user import UserProfile

    # Seed the fake user
    user = UserProfile(id=FAKE_USER_ID, display_name="Test User")
    db_session.add(user)
    await db_session.commit()

    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    from main import app
    app.dependency_overrides[get_db] = override_get_db

    with patch("auth.middleware.jwt.decode", side_effect=_mock_decode):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer valid"}
