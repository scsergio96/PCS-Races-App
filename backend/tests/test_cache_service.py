import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy import select

from models.cache import ScrapeCache
from services.cache import CacheService


@pytest.fixture
def cache_service(db_session):
    return CacheService(db_session)


@pytest.mark.asyncio
async def test_cache_miss_calls_scrape_fn(db_session, cache_service):
    scrape_fn = AsyncMock(return_value={"races": [{"name": "TdF"}]})

    result = await cache_service.get(
        cache_key="race_list:2026:ME:::1",
        scrape_fn=scrape_fn,
        ttl=timedelta(hours=6),
        data_type="race_list",
        source_url="https://pcs.com/races",
    )

    assert result == {"races": [{"name": "TdF"}]}
    scrape_fn.assert_called_once()


@pytest.mark.asyncio
async def test_cache_hit_skips_scrape(db_session, cache_service):
    # Pre-populate cache
    entry = ScrapeCache(
        cache_key="race_list:2025:ME:::1",
        data_type="race_list",
        data={"races": [{"name": "Cached Race"}]},
        source_url="https://pcs.com/races",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=6),
        is_immutable=False,
    )
    db_session.add(entry)
    await db_session.commit()

    scrape_fn = AsyncMock(return_value={"races": []})

    result = await cache_service.get(
        cache_key="race_list:2025:ME:::1",
        scrape_fn=scrape_fn,
        ttl=timedelta(hours=6),
        data_type="race_list",
        source_url="https://pcs.com/races",
    )

    assert result == {"races": [{"name": "Cached Race"}]}
    scrape_fn.assert_not_called()


@pytest.mark.asyncio
async def test_immutable_cache_never_refreshed(db_session, cache_service):
    entry = ScrapeCache(
        cache_key="race_list:2020:ME:::1",
        data_type="race_list",
        data={"races": [{"name": "Historical Race"}]},
        source_url="https://pcs.com/races",
        is_immutable=True,
        expires_at=None,
    )
    db_session.add(entry)
    await db_session.commit()

    scrape_fn = AsyncMock(return_value={"races": []})

    result = await cache_service.get(
        cache_key="race_list:2020:ME:::1",
        scrape_fn=scrape_fn,
        ttl=timedelta(hours=6),
        data_type="race_list",
        source_url="https://pcs.com/races",
    )

    assert result == {"races": [{"name": "Historical Race"}]}
    scrape_fn.assert_not_called()


@pytest.mark.asyncio
async def test_expired_cache_refreshed(db_session, cache_service):
    entry = ScrapeCache(
        cache_key="race_list:2024:ME:::1",
        data_type="race_list",
        data={"races": [{"name": "Old Data"}]},
        source_url="https://pcs.com/races",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),  # expired
        is_immutable=False,
    )
    db_session.add(entry)
    await db_session.commit()

    new_data = {"races": [{"name": "Fresh Data"}]}
    scrape_fn = AsyncMock(return_value=new_data)

    result = await cache_service.get(
        cache_key="race_list:2024:ME:::1",
        scrape_fn=scrape_fn,
        ttl=timedelta(hours=6),
        data_type="race_list",
        source_url="https://pcs.com/races",
    )

    assert result == new_data
    scrape_fn.assert_called_once()
