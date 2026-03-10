from fastapi import FastAPI, Query, HTTPException
from datetime import date
from typing import Optional

from scrapers.races_scraper import fetch_races, RaceModel

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
    include_stages: bool = Query(default=False, description="Includi dettagli tappe per gare a tappe"),
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
        include_stages=include_stages,
    )


@app.get("/health")
def health():
    return {"status": "ok", "year": CURRENT_YEAR}
