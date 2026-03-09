from pydantic import BaseModel
from typing import Optional


class RaceModel(BaseModel):
    name: str
    race_url: str
    year: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    uci_class: Optional[str] = None
    gender: Optional[str] = None
    nation: Optional[str] = None
    startlist_url: Optional[str] = None
    is_future: bool = False