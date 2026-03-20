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


# Vercel serverless + Neon (PgBouncer transaction mode):
# - NullPool: no SQLAlchemy-level connection reuse
# - statement_cache_size=0: asyncpg won't send PREPARE statements,
#   preventing DuplicatePreparedStatementError when PgBouncer reuses
#   a backend connection that already has prepared statements.
_engine_kwargs = (
    {"poolclass": NullPool, "connect_args": {"statement_cache_size": 0}}
    if DATABASE_URL.startswith("postgresql")
    else {}
)
engine = create_async_engine(DATABASE_URL, echo=False, **_engine_kwargs)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
