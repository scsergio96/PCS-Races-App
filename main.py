from contextlib import asynccontextmanager
from fastapi import FastAPI
from datetime import date
import os
import requests

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from procyclingstats.scraper import Scraper
from routers.races import router as races_router
from routers.diary import router as diary_router
from tasks.scheduled import run_scheduled_refresh
from services.cache import CacheService
from models.database import async_session_factory
from scrapers.races_scraper import fetch_races

_session = requests.Session()
_session.headers.update({**Scraper.DEFAULT_HEADERS, "Accept-Encoding": "gzip, deflate"})
Scraper._session = _session

CURRENT_YEAR = date.today().year


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start scheduled PCS refresh
    interval_hours = int(os.getenv("PCS_REFRESH_INTERVAL_HOURS", "6"))
    scheduler = AsyncIOScheduler()

    async def _refresh_job():
        async with async_session_factory() as session:
            cache = CacheService(session)
            await run_scheduled_refresh(cache, fetch_races)

    scheduler.add_job(_refresh_job, "interval", hours=interval_hours)
    scheduler.start()

    yield

    # Shutdown
    scheduler.shutdown()


app = FastAPI(title="CycleTracker API", lifespan=lifespan)
app.include_router(races_router)
app.include_router(diary_router)


@app.get("/health")
def health():
    return {"status": "ok", "year": CURRENT_YEAR}
