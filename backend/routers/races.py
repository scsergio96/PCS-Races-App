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


def _build_cache_key(year: int, category: int | None, race_level: int | None, nation: str | None, race_class: str | None, page: int) -> str:
    return f"race_list:{year}:{category or ''}:{race_level or ''}:{nation or ''}:{race_class or ''}:{page}"


def _get_ttl(year: int) -> timedelta:
    if year < CURRENT_YEAR:
        return timedelta(days=365 * 10)
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
    category: Optional[int] = Query(default=None),
    race_level: Optional[int] = Query(default=None, ge=1, le=4),
    nation: Optional[str] = Query(default=None),
    race_class: Optional[str] = Query(default=None),
    max_pages_per_year: int = Query(default=3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    if year_from > year_to:
        raise HTTPException(400, "year_from must be <= year_to")

    cache = CacheService(db)
    all_races = []

    for year in range(year_from, year_to + 1):
        cache_key = _build_cache_key(year, category, race_level, nation, race_class, 1)
        ttl = _get_ttl(year)

        async def _scrape(y=year):
            import asyncio
            races = await asyncio.to_thread(
                fetch_races,
                years=[y],
                max_pages_per_year=max_pages_per_year,
                month=month,
                category=category,
                race_level=race_level,
                nation=nation,
                race_class=race_class,
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

    today = date.today()
    for r in all_races:
        start = r.get("start_date") or ""
        year_val = r.get("year", CURRENT_YEAR)
        r["is_future"] = False
        try:
            if len(start) == 5 and "." in start:
                d, m = int(start[:2]), int(start[3:])
                r["is_future"] = date(year_val, m, d) > today
        except Exception:
            pass

    if only_future is True:
        all_races = [r for r in all_races if r.get("is_future")]
    elif only_future is False:
        all_races = [r for r in all_races if not r.get("is_future")]

    return all_races


def _detail_to_race_model(race_url: str, detail: RaceDetailModel) -> dict:
    """Map RaceDetailModel fields → RaceModel fields for the frontend."""
    year = detail.year
    # Derive gender from URL (PCS uses /women/ for women's races)
    gender = "WE" if "/women" in race_url else "ME"
    # Startlist URL is derived from race URL
    startlist_url = f"{race_url}/startlist" if detail.startlist else None
    # is_future: race hasn't started yet (compare startdate)
    is_future = False
    if detail.startdate:
        try:
            import re
            m = re.match(r"(\d{2})\.(\d{2})", detail.startdate)
            if m and year >= CURRENT_YEAR:
                today = date.today()
                sd = date(year, int(m.group(2)), int(m.group(1)))
                is_future = sd > today
        except Exception:
            pass
    startlist = None
    if detail.startlist:
        startlist = [
            {
                "rider_name": e.rider_name,
                "rider_url": e.rider_url,
                "team_name": e.team_name,
                "nationality": e.nationality,
                "rider_number": e.rider_number,
            }
            for e in detail.startlist
        ]

    stages_winners = None
    if detail.stages_winners:
        stages_winners = [
            {
                "stage_name": w.stage_name,
                "rider_name": w.rider_name,
                "rider_url": w.rider_url,
                "nationality": w.nationality,
            }
            for w in detail.stages_winners
        ]

    race_results = None
    if detail.race_results:
        race_results = [
            {
                "rank": r.rank,
                "rider_name": r.rider_name,
                "rider_url": r.rider_url,
                "team_name": r.team_name,
                "nationality": r.nationality,
                "time": r.time,
            }
            for r in detail.race_results
        ]

    race_info = None
    if detail.race_info:
        ri = detail.race_info
        race_info = {
            "distance": ri.distance,
            "departure": ri.departure,
            "arrival": ri.arrival,
            "won_how": ri.won_how,
            "avg_temperature": ri.avg_temperature,
            "start_time": ri.start_time,
            "avg_speed": ri.avg_speed,
        }

    return {
        "name": detail.name,
        "race_url": race_url,
        "year": year,
        "start_date": detail.startdate,
        "end_date": detail.enddate,
        "uci_class": detail.uci_tour or detail.category,
        "gender": gender,
        "nation": detail.nationality,
        "startlist_url": startlist_url,
        "is_future": is_future,
        "stages": None,
        "startlist": startlist,
        "stages_winners": stages_winners,
        "race_results": race_results,
        "race_info": race_info,
    }


@router.get("/race/{race_url:path}", response_model=RaceModel)
async def get_race_detail(
    race_url: str,
    db: AsyncSession = Depends(get_db),
):
    # race_url received URL-decoded as "race/tour-de-france/2026"
    # (frontend sends encodeURIComponent of the full raceUrl)
    pcs_race_url = race_url
    cache = CacheService(db)
    cache_key = f"race_detail:{pcs_race_url}"

    year = CURRENT_YEAR
    try:
        year = int(pcs_race_url.rstrip("/").split("/")[-1])
    except (ValueError, IndexError):
        pass

    is_past = year < CURRENT_YEAR
    ttl = timedelta(days=365 * 10) if is_past else timedelta(hours=24)

    async def _scrape():
        try:
            import asyncio
            detail = await asyncio.to_thread(
                fetch_race_detail,
                pcs_race_url,
                True,   # include_startlist
                True,   # include_stages_winners
                True,   # include_results
            )
            return _detail_to_race_model(pcs_race_url, detail)
        except Exception as e:
            raise HTTPException(404, f"Race not found or not yet available: {e}")

    data = await cache.get(
        cache_key,
        scrape_fn=_scrape,
        ttl=ttl,
        data_type="race_detail",
        source_url=f"pcs/{pcs_race_url}",
        is_immutable=is_past,
    )
    return data
