import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cycletracker.db")


class Base(DeclarativeBase):
    pass


# Vercel serverless + Neon (PgBouncer transaction mode) requires NullPool:
# each request gets a fresh connection with no prepared statement cache.
# SQLite (local dev) uses the default pool.
_pool_kwargs = (
    {"poolclass": NullPool}
    if DATABASE_URL.startswith("postgresql")
    else {}
)
engine = create_async_engine(DATABASE_URL, echo=False, **_pool_kwargs)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
