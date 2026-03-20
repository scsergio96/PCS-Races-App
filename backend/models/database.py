import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cycletracker.db")


class Base(DeclarativeBase):
    pass


# Neon (and any PgBouncer in transaction mode) doesn't support asyncpg prepared
# statements. Disable the cache for PostgreSQL connections only.
_connect_args = (
    {"prepared_statement_cache_size": 0}
    if DATABASE_URL.startswith("postgresql")
    else {}
)
engine = create_async_engine(DATABASE_URL, echo=False, connect_args=_connect_args)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
