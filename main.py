from contextlib import asynccontextmanager
from fastapi import FastAPI
from datetime import date
import requests

from procyclingstats.scraper import Scraper
from routers.races import router as races_router

_session = requests.Session()
_session.headers.update({**Scraper.DEFAULT_HEADERS, "Accept-Encoding": "gzip, deflate"})
Scraper._session = _session

CURRENT_YEAR = date.today().year


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="CycleTracker API", lifespan=lifespan)
app.include_router(races_router)


@app.get("/health")
def health():
    return {"status": "ok", "year": CURRENT_YEAR}
