import time
import random
from datetime import date
from procyclingstats.scraper import Scraper
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import Optional

today = date.today()

# Mapping gender → category PCS
GENDER_TO_CATEGORY = {"ME": "1", "WE": "2"}


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


class RacesList(Scraper):
    def races(self) -> list[dict]:

        soup = BeautifulSoup(self.html.html, "html.parser")

        # DEBUG — stampa tutte le table trovate
        tables = soup.find_all("table")
#

        table = soup.find("table", class_="basic")
        if not table:
            return []

        # soup = BeautifulSoup(self.html.html, "html.parser")
        # table = soup.find("table", class_="basic")
        # if not table:
        #     return []

        rows = []
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells or len(cells) < 4:
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

            # col 1 → Nation + Name + race_url
            nation = None
            flag_span = cells[1].find("span")
            if flag_span:
                classes = flag_span.get("class", [])
                iso_codes = [c for c in classes if c != "flag"]
                nation = iso_codes[0].upper() if iso_codes else None
            row["nation"] = nation

            link = cells[1].find("a")
            row["name"] = cells[1].get_text(strip=True)
            if link and link.get("href"):
                row["race_url"] = link["href"].lstrip("/")

            # col 2 → UCI Class
            row["uci_class"] = cells[2].get_text(strip=True) or None

            # col 3 → Gender
            row["gender"] = cells[3].get_text(strip=True) or None

            # col 4 → Startlist URL
            if len(cells) > 4:
                sl_link = cells[4].find("a")
                row["startlist_url"] = (
                    sl_link["href"].lstrip("/")
                    if sl_link and sl_link.get("href")
                    else None
                )
            else:
                row["startlist_url"] = None

            if row.get("name"):
                rows.append(row)

        return rows


def _build_race_model(raw: dict, year: int) -> RaceModel:
    start_str = raw.get("start_date") or ""
    is_future = False

    try:
        if len(start_str) == 5 and "." in start_str:
            d, m = int(start_str[:2]), int(start_str[3:])
            is_future = date(year, m, d) > today
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
        startlist_url=raw.get("startlist_url"),
        is_future=is_future,
    )
#TODO conviene usare soltanto l'api calendar-plus-filters anche per le gare future e applicare i filtri necessari per mostrare soltanto le gare da domani in poi
#TODO gestire le gare a tappe per avere i link a tutte le tappe all'interno della risposta. gara a tappe se end_date != null

def _build_url(
    year: int,
    offset: int,
    only_future: Optional[bool],
    month: Optional[int],
    gender: Optional[str],
    race_level: Optional[int],
    nation: Optional[str],
) -> str:
    category = GENDER_TO_CATEGORY.get(gender.upper(), "") if gender else ""

    if only_future is True:
        # Gare future → races.php?s=upcoming-races
        url = (
            f"races.php"
            f"?s=upcoming-races"
            f"&season={year}"
            f"&month={month if month else ''}"
            f"&category={category}"
            f"&racelevel={race_level if race_level is not None else ''}"
            f"&racenation={nation.lower() if nation else ''}"
            f"&class="
            f"&filter=Filter"
            f"&offset={offset}"
        )
    else:
        # Calendario completo (passate + future) → races.php?s=calendar-plus-filters
        url = (
            f"races.php"
            f"?s=calendar-plus-filters"
            f"&season={year}"
            f"&month={month if month else ''}"
            f"&category={category}"
            f"&racelevel={race_level if race_level is not None else ''}"
            f"&racenation={nation.lower() if nation else ''}"
            f"&class="
            f"&filter=Filter"
            f"&offset={offset}"
        )

    return url





def fetch_races(
    years: list[int],
    max_pages_per_year: int = 5,
    only_future: Optional[bool] = None,
    month: Optional[int] = None,
    gender: Optional[str] = None,
    race_level: Optional[int] = None,
    nation: Optional[str] = None,
) -> list[RaceModel]:
    all_races: list[RaceModel] = []
    page_size = 100

    for year in years:
        for page_num in range(max_pages_per_year):
            offset = page_num * page_size
            url = _build_url(year, offset, only_future, month, gender, race_level, nation)
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

    # only_future=False → filtro lato Python (PCS non ha param dedicato)
    if only_future is False:
        all_races = [r for r in all_races if not r.is_future]

    return all_races
