from typing import Optional, List
from models.base import CamelModel


class StageInfo(CamelModel):
    number: int
    name: str
    date: Optional[str] = None  # YYYY-MM-DD
    stage_url: str
    departure: Optional[str] = None
    arrival: Optional[str] = None
    distance: Optional[float] = None  # km
    profile_icon: Optional[str] = None  # p1, p2, etc.


class RaceModel(CamelModel):
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
    stages: Optional[List[StageInfo]] = None
