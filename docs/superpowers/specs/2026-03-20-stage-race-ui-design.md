# Stage Race UI — Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Problem

The race detail page shows stage races (e.g. Volta a Catalunya 2026, 7 tappe) identically to one-day races. There is no way to navigate per-stage info, results, or write reviews for individual stages — even though the database already supports `is_stage`/`stage_number` on diary entries.

---

## Solution Overview

Add a **stage selector dropdown** below the race name on the detail page. Selecting a stage switches the tab bar to a stage-specific view. The overall race view is preserved unchanged when "Visione generale" is selected.

---

## UX Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stage selector widget | Dropdown / `<select>` | Compact, familiar, works well for 1–21 stages |
| Stage tab set | INFO · TAPPA · GC · MEMORIE · COMMUNITY | Separate tabs for each classification, avoids scrolling |
| URL strategy | URL unchanged, client-side state | No page reload, faster UX; stages are not deep-linked |
| Stage data loading | Lazy client fetch on stage selection | Initial SSR unaffected; stage data only fetched when needed |

---

## Architecture

### Component boundary

```
RaceDetailPage (Server Component)
├── fetches race → includes stages list
└── renders StageRaceView (Client Component)
        ├── selectedStage: string | null   (null = Generale)
        ├── stageData: StageFullDetail | null
        │
        ├── [selectedStage == null] Overall tabs
        │       INFO · STARTLIST · MEMORIE · COMMUNITY · RISULTATI
        │       (existing implementation, unchanged)
        │
        └── [selectedStage != null] Stage tabs
                INFO · TAPPA · GC · MEMORIE · COMMUNITY
```

### Stage selector behavior

- Renders only when `race.stages` is non-empty (stage race detected)
- First option: "Visione generale" (maps to `selectedStage = null`)
- Remaining options: one per stage, label = `"Tappa N · DD.MM · Partenza → Arrivo"` using `stage.stageName` and `stage.date`
- On selection change: set `selectedStage = stage.stageUrl`, fetch `/stage/{stageUrl}`

### Loading state

While stage data is loading, show skeleton rows inside each tab content area. Do not disable the dropdown during load.

---

## Backend Changes

### 1. Fix stage list passthrough (`routers/races.py`)

`_detail_to_race_model` currently sets `"stages": None`. Change to map `detail.stages` into a list of dicts:

```python
stages = None
if detail.stages:
    stages = [
        {
            "stage_name": s.stage_name,
            "stage_url": s.stage_url,
            "date": s.date,
            "profile_icon": s.profile_icon,
        }
        for s in detail.stages
    ]
```

### 2. New Pydantic model (`scrapers/races_scraper.py`)

```python
class StageFullDetail(BaseModel):
    stage_name: str
    stage_url: str
    date: Optional[str]
    distance: Optional[float]
    departure: Optional[str]
    arrival: Optional[str]
    stage_type: Optional[str]          # "RR", "ITT", "TTT"
    profile_icon: Optional[str]        # "p0"–"p5"
    vertical_meters: Optional[int]
    won_how: Optional[str]
    results: List[RaceResultEntry]     # stage finishers
    gc: List[RaceResultEntry]          # GC standings after stage
```

### 3. New scraper function (`scrapers/races_scraper.py`)

```python
def fetch_stage_detail(stage_url: str) -> StageFullDetail:
    """
    Uses procyclingstats.Stage to fetch stage info, results, and GC.
    All fields wrapped in _safe() to handle missing data gracefully.
    """
```

Uses `procyclingstats.stage_scraper.Stage`:
- `.date()`, `.distance()`, `.departure()`, `.arrival()`
- `.stage_type()`, `.profile_icon()`, `.vertical_meters()`, `.won_how()`
- `.results("rank", "rider_name", "rider_url", "team_name", "nationality", "time")`
- `.gc("rank", "rider_name", "rider_url", "team_name", "nationality", "time")`

### 4. New endpoint (`routers/races.py`)

```
GET /stage/{stage_url:path}  →  StageFullDetail
```

- `stage_url` example: `race/volta-a-catalunya/2026/stage-2`
- Derives year from URL for cache TTL: past year → 10yr immutable, current year → 1h
- Uses `CacheService` with key `stage_detail:{stage_url}`

---

## Frontend Changes

### `types/api.ts`

Add to `Race`:
```typescript
stages?: StageDetail[] | null;
```

New types:
```typescript
export interface StageDetail {
  stageName: string;
  stageUrl: string;
  date: string | null;
  profileIcon: string | null;
}

export interface StageFullDetail {
  stageName: string;
  stageUrl: string;
  date: string | null;
  distance: number | null;
  departure: string | null;
  arrival: string | null;
  stageType: string | null;
  profileIcon: string | null;
  verticalMeters: number | null;
  wonHow: string | null;
  results: RaceResultEntry[];
  gc: RaceResultEntry[];
}
```

### `app/(app)/races/[...slug]/page.tsx`

- Pass `race.stages` and `raceUrl` as props to `StageRaceView`
- Extract the existing tab JSX into the overall-view section of `StageRaceView`

### `components/races/stage-race-view.tsx` (new)

Client component responsibilities:
1. Render stage selector dropdown (only if `stages` is non-empty)
2. Track `selectedStageUrl: string | null`
3. On stage selection: `fetch(`${API_URL}/stage/${stageUrl}`)` → `StageFullDetail`
4. Render **overall tabs** when `selectedStageUrl === null`
5. Render **stage tabs** when a stage is selected:
   - **INFO**: date, distance, departure, arrival, stage_type, profile_icon, vertical_meters, won_how
   - **TAPPA**: `stageData.results` list (rank, flag, rider name, team, time)
   - **GC**: `stageData.gc` list (rank, flag, rider name, time delta)
   - **MEMORIE**: link to `/diary/new?race_url={stageUrl}&race_name={name}&is_stage=true&stage_number={N}`; list of user's diary entries for this stage URL
   - **COMMUNITY**: public diary entries for this stage URL (fetch `/race/{stageUrl}/community`)

The "SCRIVI RECENSIONE" button in MEMORIE precompiles the new diary form with:
- `race_url` = stage URL (e.g. `race/volta-a-catalunya/2026/stage-2`)
- `race_name` = stage name
- `is_stage=true`, `stage_number` extracted from stage URL

---

## Data Flow

```
1. RaceDetailPage (SSR)
   └── GET /race/volta-a-catalunya/2026
       └── returns race + stages list (after fix)

2. StageRaceView mounts
   └── shows dropdown with stage list

3. User selects "Tappa 2"
   └── client fetch: GET /stage/race/volta-a-catalunya/2026/stage-2
       └── procyclingstats.Stage scrapes PCS
       └── returns StageFullDetail (cached after first fetch)

4. Stage tabs render with data
```

---

## What Does NOT Change

- Overall race tabs (INFO · STARTLIST · MEMORIE · COMMUNITY · RISULTATI) — identical to current
- One-day race page — no dropdown shown, unchanged
- Diary entry model — already has `is_stage`, `stage_number`, `race_url`
- Community endpoint — already filters by `race_url`, works with stage URLs

---

## Out of Scope

- Deep-linking to a specific stage via URL
- Points (KOM, youth, sprints) classification tabs — can be added later
- Stage map / route visualization
