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
