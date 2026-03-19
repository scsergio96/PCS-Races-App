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
            parts = key.split(":")
            year = int(parts[1])
            gender = parts[2] or None

            from datetime import timedelta

            is_immutable = determine_immutability(key, current_year)
            ttl = timedelta(days=365 * 10) if is_immutable else timedelta(hours=6)

            async def _scrape(y=year, g=gender):
                import asyncio
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
