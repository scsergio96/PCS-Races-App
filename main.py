from fastapi import FastAPI, Query, HTTPException
from datetime import date
from typing import Optional
import requests

from procyclingstats.scraper import Scraper
from scrapers.races_scraper import fetch_races, fetch_race_detail, RaceModel, RaceDetailModel

_session = requests.Session()
_session.headers.update({**Scraper.DEFAULT_HEADERS, "Accept-Encoding": "gzip, deflate"})
Scraper._session = _session

CURRENT_YEAR = date.today().year
app = FastAPI(title="ProcyclingStats Races API")


@app.get("/races", response_model=list[RaceModel])
def get_races(
    year_from: int = Query(default=CURRENT_YEAR, ge=1900, le=CURRENT_YEAR + 1),
    year_to: int = Query(default=CURRENT_YEAR, ge=1900, le=CURRENT_YEAR + 1),
    only_future: Optional[bool] = Query(default=None, description="true=solo future, false=solo passate"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Mese (1-12)"),
    gender: Optional[str] = Query(default=None, description="'ME' = uomini elite, 'WE' = donne elite"),
    race_level: Optional[int] = Query(default=None, ge=1, le=4, description="Livello gara (1-4)"),
    nation: Optional[str] = Query(default=None, description="Codice ISO, es. 'IT', 'FR'"),
    max_pages_per_year: int = Query(default=3, ge=1, le=10),
):
    if year_from > year_to:
        raise HTTPException(400, "year_from deve essere <= year_to")

    return fetch_races(
        years=list(range(year_from, year_to + 1)),
        max_pages_per_year=max_pages_per_year,
        only_future=only_future,
        month=month,
        gender=gender,
        race_level=race_level,
        nation=nation,
    )


@app.get("/race/{race_url:path}", response_model=RaceDetailModel)
def get_race_detail(
    race_url: str,
    include_startlist: bool = Query(default=False, description="Includi startlist della gara"),
    include_stages_winners: bool = Query(default=False, description="Includi vincitori di tappa (solo gare a tappe)"),
):
    try:
        return fetch_race_detail(
            race_url=race_url,
            include_startlist=include_startlist,
            include_stages_winners=include_stages_winners,
        )
    except Exception as e:
        raise HTTPException(500, f"Errore nel recupero della gara: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "year": CURRENT_YEAR}
