import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Awaitable

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.cache import ScrapeCache

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(
        self,
        cache_key: str,
        scrape_fn: Callable[[], Awaitable[Any]],
        ttl: timedelta,
        data_type: str,
        source_url: str,
        is_immutable: bool = False,
    ) -> Any:
        """Cache-through: return cached data if fresh, else scrape and cache."""
        result = await self.db.execute(
            select(ScrapeCache).where(ScrapeCache.cache_key == cache_key)
        )
        entry = result.scalar_one_or_none()

        # Cache hit: immutable data never expires
        if entry and entry.is_immutable:
            return entry.data

        # Cache hit: valid (not expired)
        # SQLite returns naive datetimes; normalise to UTC-aware before comparing.
        if entry and entry.expires_at:
            expires_at = entry.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                return entry.data

        # Cache miss or stale: scrape fresh data
        logger.info(f"Cache miss for {cache_key}, scraping...")
        data = await scrape_fn()

        now = datetime.now(timezone.utc)
        if entry:
            # Update existing entry
            entry.data = data
            entry.scraped_at = now
            entry.expires_at = None if is_immutable else now + ttl
            entry.is_immutable = is_immutable
            entry.source_url = source_url
        else:
            # Insert new entry
            new_entry = ScrapeCache(
                cache_key=cache_key,
                data_type=data_type,
                data=data,
                scraped_at=now,
                expires_at=None if is_immutable else now + ttl,
                source_url=source_url,
                is_immutable=is_immutable,
            )
            self.db.add(new_entry)

        await self.db.commit()
        return data
