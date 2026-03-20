import time
import random
from datetime import date
from procyclingstats.scraper import Scraper
from procyclingstats.race_scraper import Race as PCSRace
from procyclingstats.race_startlist_scraper import RaceStartlist as PCSRaceStartlist
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import Optional, List

from models.race import RaceModel



# ---------------------------------------------------------------------------
# Models: race detail
# ---------------------------------------------------------------------------

class StageDetail(BaseModel):
    stage_name: str
    stage_url: str
    date: Optional[str] = None       # MM-DD
    profile_icon: Optional[str] = None


class StageWinner(BaseModel):
    stage_name: str
    rider_name: str
    rider_url: str
    nationality: Optional[str] = None


class StartlistEntry(BaseModel):
    rider_name: str
    rider_url: str
    team_name: Optional[str] = None
    team_url: Optional[str] = None
    nationality: Optional[str] = None
    rider_number: Optional[int] = None


class RaceResultEntry(BaseModel):
    rank: Optional[int] = None
    rider_name: str
    rider_url: str
    team_name: Optional[str] = None
    nationality: Optional[str] = None
    time: Optional[str] = None


class RaceInfo(BaseModel):
    distance: Optional[str] = None
    departure: Optional[str] = None
    arrival: Optional[str] = None
    won_how: Optional[str] = None
    avg_temperature: Optional[str] = None
    start_time: Optional[str] = None
    avg_speed: Optional[str] = None


class RaceDetailModel(BaseModel):
    name: str
    year: int
    nationality: Optional[str] = None
    edition: Optional[int] = None
    startdate: Optional[str] = None
    enddate: Optional[str] = None
    category: Optional[str] = None
    uci_tour: Optional[str] = None
    is_one_day_race: bool
    stages: Optional[List[StageDetail]] = None          # solo gare a tappe
    stages_winners: Optional[List[StageWinner]] = None  # se include_stages_winners=true
    startlist: Optional[List[StartlistEntry]] = None    # se include_startlist=true
    race_results: Optional[List[RaceResultEntry]] = None  # one-day race finishers
    race_info: Optional[RaceInfo] = None                  # sidebar info (distance, etc.)


# ---------------------------------------------------------------------------
# Race list scraper
# ---------------------------------------------------------------------------

class RacesList(Scraper):
    def races(self) -> list[dict]:
        soup = BeautifulSoup(self.html.html, "html.parser")
        table = soup.find("table", class_="basic")
        if not table:
            return []

        rows = []
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells or len(cells) < 3:
                continue

            row: dict = {}

            # col 0 → Date: "DD.MM - DD.MM" oppure "DD.MM"
            date_text = cells[0].get_text(strip=True)
            if " - " in date_text:
                parts = date_text.split(" - ")
                row["start_date"] = parts[0].strip()
                row["end_date"] = parts[1].strip()
            else:
                row["start_date"] = date_text or None
                row["end_date"] = None

            # col 1 → Nation (da flag span) + Name + race_url
            nation = None
            flag_span = cells[1].find("span", class_="flag")
            if flag_span:
                classes = flag_span.get("class", [])
                iso_codes = [c for c in classes if c != "flag"]
                nation = iso_codes[0].upper() if iso_codes else None
            row["nation"] = nation

            link = cells[1].find("a")
            row["name"] = link.get_text(strip=True) if link else cells[1].get_text(strip=True)
            if link and link.get("href"):
                row["race_url"] = link["href"].lstrip("/")

            # col 2 → UCI Class
            row["uci_class"] = cells[2].get_text(strip=True) or None

            # col 3 → Gender (opzionale)
            row["gender"] = cells[3].get_text(strip=True) if len(cells) > 3 else None

            if row.get("name"):
                rows.append(row)

        return rows


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_race_model(raw: dict, year: int) -> RaceModel:
    start_str = raw.get("start_date") or ""
    is_future = False

    try:
        if len(start_str) == 5 and "." in start_str:
            d, m = int(start_str[:2]), int(start_str[3:])
            is_future = date(year, m, d) > date.today()
    except (ValueError, TypeError):
        pass

    return RaceModel(
        name=raw.get("name", ""),
        race_url=raw.get("race_url", ""),
        year=year,
        start_date=raw.get("start_date"),
        end_date=raw.get("end_date"),
        uci_class=raw.get("uci_class"),
        gender=raw.get("gender"),
        nation=raw.get("nation"),
        is_future=is_future,
    )


def _build_url(
    year: int,
    offset: int,
    month: Optional[int],
    category: Optional[int],
    race_level: Optional[int],
    nation: Optional[str],
    race_class: Optional[str],
) -> str:
    return (
        f"races.php"
        f"?s=calendar-plus-filters"
        f"&season={year}"
        f"&month={month if month else ''}"
        f"&category={category if category is not None else ''}"
        f"&racelevel={race_level if race_level is not None else ''}"
        f"&racenation={nation.lower() if nation else ''}"
        f"&class={race_class if race_class else ''}"
        f"&filter=Filter"
        f"&offset={offset}"
    )


# ---------------------------------------------------------------------------
# Public fetch functions
# ---------------------------------------------------------------------------

def fetch_races(
    years: list[int],
    max_pages_per_year: int = 5,
    only_future: Optional[bool] = None,
    month: Optional[int] = None,
    category: Optional[int] = None,
    race_level: Optional[int] = None,
    nation: Optional[str] = None,
    race_class: Optional[str] = None,
) -> list[RaceModel]:
    all_races: list[RaceModel] = []
    page_size = 100

    for year in years:
        for page_num in range(max_pages_per_year):
            offset = page_num * page_size
            url = _build_url(year, offset, month, category, race_level, nation, race_class)
            print(url)
            try:
                scraper = RacesList(url)
                rows = scraper.races()
            except ValueError as e:
                print(f"[WARN] year={year} offset={offset}: {e}")
                break

            if not rows:
                break

            all_races.extend(_build_race_model(r, year) for r in rows)

            if len(rows) < page_size:
                break

            time.sleep(random.uniform(0.5, 1.0))

        time.sleep(random.uniform(0.8, 1.5))

    if only_future is True:
        all_races = [r for r in all_races if r.is_future]
    elif only_future is False:
        all_races = [r for r in all_races if not r.is_future]

    return all_races


def fetch_race_result(race_url: str) -> tuple:
    """Fetch finisher results and race info from the /result page.
    Returns (list[RaceResultEntry], RaceInfo).
    """
    result_url = race_url.rstrip("/") + "/result"
    try:
        scraper = Scraper(result_url)
        soup = BeautifulSoup(scraper.html.html, "html.parser")
    except Exception as e:
        print(f"[WARN] fetch_race_result failed for {race_url}: {e}")
        return [], RaceInfo()

    results: List[RaceResultEntry] = []
    table = soup.find("table", class_="results")
    if table:
        tbody = table.find("tbody")
        for tr in (tbody.find_all("tr") if tbody else []):
            cells = tr.find_all("td")
            if not cells:
                continue

            rank_text = cells[0].get_text(strip=True)
            rank = int(rank_text) if rank_text.isdigit() else None

            nationality = None
            flag_span = tr.find("span", class_="flag")
            if flag_span:
                codes = [c for c in flag_span.get("class", []) if c != "flag"]
                nationality = codes[0].upper() if codes else None

            rider_name = ""
            rider_url_val = ""
            rider_link = None
            for a in tr.find_all("a", href=True):
                if a["href"].startswith("rider/"):
                    rider_link = a
                    break
            if rider_link:
                rider_url_val = rider_link["href"]
                last_span = rider_link.find("span", class_="uppercase")
                if last_span:
                    last = last_span.get_text(strip=True)
                    first = (last_span.next_sibling or "")
                    first = str(first).strip()
                    rider_name = f"{last} {first}".strip() if first else last
                else:
                    rider_name = rider_link.get_text(strip=True)

            team_name = None
            team_cell = tr.find("td", class_="cu600")
            if team_cell:
                team_link = team_cell.find("a")
                if team_link:
                    team_name = team_link.get_text(strip=True)

            time_text = None
            time_cell = tr.find("td", class_="time")
            if time_cell:
                font = time_cell.find("font")
                if font:
                    raw = font.get_text(strip=True)
                    time_text = None if raw in (",,", "") else raw

            if rider_name:
                results.append(RaceResultEntry(
                    rank=rank,
                    rider_name=rider_name,
                    rider_url=rider_url_val,
                    nationality=nationality,
                    team_name=team_name,
                    time=time_text,
                ))

    # Race info sidebar
    race_info = RaceInfo()
    kv_list = soup.find("ul", class_="keyvalueList")
    if kv_list:
        for li in kv_list.find_all("li"):
            title_el = li.find(class_="title")
            value_el = li.find(class_="value")
            if not title_el or not value_el:
                continue
            title = title_el.get_text(strip=True).lower()
            value = value_el.get_text(strip=True)
            if "distance" in title:
                race_info.distance = value
            elif "departure" in title:
                race_info.departure = value
            elif "arrival" in title:
                race_info.arrival = value
            elif "won how" in title:
                race_info.won_how = value
            elif "temperature" in title:
                race_info.avg_temperature = value
            elif "start time" in title:
                race_info.start_time = value
            elif "speed" in title:
                race_info.avg_speed = value

    return results, race_info


def fetch_race_detail(
    race_url: str,
    include_startlist: bool = False,
    include_stages_winners: bool = False,
    include_results: bool = False,
) -> RaceDetailModel:
    race = PCSRace(race_url)

    def _safe(fn):
        try:
            return fn()
        except Exception:
            return None

    is_one_day = _safe(race.is_one_day_race) or False

    # Stages list (sempre recuperata per gare a tappe)
    stages: Optional[List[StageDetail]] = None
    if not is_one_day:
        try:
            raw_stages = race.stages("date", "profile_icon", "stage_name", "stage_url")
            stages = [
                StageDetail(
                    stage_name=s.get("stage_name", ""),
                    stage_url=s.get("stage_url", ""),
                    date=s.get("date"),
                    profile_icon=s.get("profile_icon"),
                )
                for s in raw_stages
            ]
        except Exception as e:
            print(f"[WARN] stages fetch failed for {race_url}: {e}")

    # Stages winners (opzionale)
    stages_winners: Optional[List[StageWinner]] = None
    if include_stages_winners and not is_one_day:
        try:
            raw_winners = race.stages_winners("stage_name", "rider_name", "rider_url", "nationality")
            stages_winners = [
                StageWinner(
                    stage_name=w.get("stage_name", ""),
                    rider_name=w.get("rider_name", ""),
                    rider_url=w.get("rider_url", ""),
                    nationality=w.get("nationality"),
                )
                for w in raw_winners
            ]
        except Exception as e:
            print(f"[WARN] stages_winners fetch failed for {race_url}: {e}")

    # Startlist (opzionale)
    startlist: Optional[List[StartlistEntry]] = None
    if include_startlist:
        try:
            startlist_url = race_url.rstrip("/") + "/startlist"
            pcs_startlist = PCSRaceStartlist(startlist_url)
            raw_startlist = pcs_startlist.startlist()
            startlist = [
                StartlistEntry(
                    rider_name=r.get("rider_name", ""),
                    rider_url=r.get("rider_url", ""),
                    team_name=r.get("team_name"),
                    team_url=r.get("team_url"),
                    nationality=r.get("nationality"),
                    rider_number=r.get("rider_number"),
                )
                for r in raw_startlist
            ]
        except Exception as e:
            print(f"[WARN] startlist fetch failed for {race_url}: {e}")

    # One-day race results (only for past one-day races)
    race_results: Optional[List[RaceResultEntry]] = None
    race_info: Optional[RaceInfo] = None
    startdate = _safe(race.startdate)
    year_val = _safe(race.year) or 0

    # Determine is_future for this race
    _is_future = False
    if startdate:
        try:
            import re as _re
            m = _re.match(r"(\d{2})\.(\d{2})", startdate)
            if m and year_val >= date.today().year:
                sd = date(year_val, int(m.group(2)), int(m.group(1)))
                _is_future = sd > date.today()
        except Exception:
            pass

    if include_results and is_one_day and not _is_future:
        try:
            race_results, race_info = fetch_race_result(race_url)
        except Exception as e:
            print(f"[WARN] race results fetch failed for {race_url}: {e}")

    return RaceDetailModel(
        name=_safe(race.name) or "",
        year=year_val,
        nationality=_safe(race.nationality),
        edition=_safe(race.edition),
        startdate=startdate,
        enddate=_safe(race.enddate),
        category=_safe(race.category),
        uci_tour=_safe(race.uci_tour),
        is_one_day_race=is_one_day,
        stages=stages,
        stages_winners=stages_winners,
        startlist=startlist,
        race_results=race_results,
        race_info=race_info,
    )
