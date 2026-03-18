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
    fetched = result.scalar_one()
    assert fetched.data_type == "race_list"
    assert fetched.is_immutable is False
    assert fetched.data["races"][0]["name"] == "Milano-Sanremo"


async def test_immutable_cache_entry(db_session):
    entry = ScrapeCache(
        cache_key="race_list:2023:ME:::1",
        data_type="race_list",
        data={"races": []},
        source_url="https://www.procyclingstats.com/races.php?season=2023",
        is_immutable=True,
    )
    db_session.add(entry)
    await db_session.commit()

    result = await db_session.execute(
        select(ScrapeCache).where(ScrapeCache.cache_key == "race_list:2023:ME:::1")
    )
    fetched = result.scalar_one()
    assert fetched.is_immutable is True
    assert fetched.expires_at is None
