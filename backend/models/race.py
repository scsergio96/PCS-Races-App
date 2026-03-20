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


class StartlistEntryModel(CamelModel):
    rider_name: str
    rider_url: str
    team_name: Optional[str] = None
    nationality: Optional[str] = None
    rider_number: Optional[int] = None


class StageWinnerModel(CamelModel):
    stage_name: str
    rider_name: str
    rider_url: str
    nationality: Optional[str] = None


class RaceResultEntryModel(CamelModel):
    rank: Optional[int] = None
    rider_name: str
    rider_url: str
    team_name: Optional[str] = None
    nationality: Optional[str] = None
    time: Optional[str] = None


class RaceInfoModel(CamelModel):
    distance: Optional[str] = None
    departure: Optional[str] = None
    arrival: Optional[str] = None
    won_how: Optional[str] = None
    avg_temperature: Optional[str] = None
    start_time: Optional[str] = None
    avg_speed: Optional[str] = None


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
    startlist: Optional[List[StartlistEntryModel]] = None
    stages_winners: Optional[List[StageWinnerModel]] = None
    race_results: Optional[List[RaceResultEntryModel]] = None
    race_info: Optional[RaceInfoModel] = None
