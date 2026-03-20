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

**Specific site:** `_detail_to_race_model` function in `routers/races.py`. Line 182 currently reads `"stages": None` — this hardcoded `None` silently discards the stages list that the scraper already fetches correctly. Replace it with the mapping below.

```python
# routers/races.py — inside _detail_to_race_model
import re as _re

stages = None
if detail.stages:
    stages = []
    for s in detail.stages:
        # Extract stage number from URL: "race/.../stage-3" → 3
        m = _re.search(r"stage-(\d+)", s.stage_url)
        number = int(m.group(1)) if m else 0
        stages.append({
            "number": number,
            "name": s.stage_name,
            "date": s.date,
            "stage_url": s.stage_url,
            "profile_icon": s.profile_icon,
            # departure/arrival/distance not available from race list page
            "departure": None,
            "arrival": None,
            "distance": None,
        })
```

`StageInfo` (in `models/race.py`) already has all these fields — no new model needed for the race list.

### 2. New Pydantic models (`scrapers/races_scraper.py`)

Both models are added to `scrapers/races_scraper.py` alongside the existing `RaceResultEntry` (which is already defined there at lines 42-48). `StageFullDetail.results` reuses the existing `RaceResultEntry` class from the same file — no name collision, no new import needed.

```python
class GCEntry(BaseModel):
    rank: Optional[int] = None
    rider_name: str
    rider_url: str
    nationality: Optional[str] = None
    time: Optional[str] = None   # gap to leader (e.g. "+0:45"), "0:00:00" for leader

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
    results: List[RaceResultEntry]     # reuses existing RaceResultEntry (time = finish time)
    gc: List[GCEntry]                  # GC standings (time = gap to leader, no team_name)
```

`GCEntry` is separate from `RaceResultEntry` because GC data has no `team_name` and `time` holds a gap string, not a finish time.

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
- `.gc("rank", "rider_name", "rider_url", "nationality", "time")`  ← no team_name

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
stages?: StageInfo[] | null;
```

New types:
```typescript
export interface StageInfo {
  number: number;
  name: string;
  date: string | null;
  stageUrl: string;
  departure: string | null;
  arrival: string | null;
  distance: number | null;
  profileIcon: string | null;
}

export interface GCEntry {
  rank: number | null;
  riderName: string;
  riderUrl: string;
  nationality: string | null;
  time: string | null;   // gap to leader
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
  gc: GCEntry[];
}
```

### `app/(app)/races/[...slug]/page.tsx`

- Pass `race.stages`, `raceUrl`, `raceBaseSlug`, `memories`, `communityReviews`, `jwt`, and `writeUrl` as props to `StageRaceView`
- Server still fetches `memories` and `communityReviews` for the overall view — these are passed as props so the Client Component does not need to re-fetch them for the "Generale" state
- The existing tab JSX moves into `StageRaceView` as the overall-view branch

### `components/races/stage-race-view.tsx` (new)

Client component responsibilities:
1. Render stage selector dropdown (only if `stages` is non-empty)
2. Track `selectedStageUrl: string | null` (null = Generale)
3. Track `stageData: StageFullDetail | null` and `stageLoading: boolean`
4. On stage selection: fetch `${API_URL}/stage/${stageUrl}` → `StageFullDetail`
5. Render **overall tabs** when `selectedStageUrl === null`
   - Uses server-fetched `memories` and `communityReviews` props (no client re-fetch needed)
6. Render **stage tabs** when a stage is selected:
   - **INFO**: date, distance, departure, arrival, stage_type, profile_icon, vertical_meters, won_how
   - **TAPPA**: `stageData.results` list (rank, flag, rider name, team, time)
   - **GC**: `stageData.gc` list (rank, flag, rider name, gap)
   - **MEMORIE**: fetch `GET /memories/{raceBaseSlug}?is_stage=true&stage_number={N}` client-side; link to `/diary/new?race_url={stageUrl}&race_name={name}&is_stage=true&stage_number={N}`
   - **COMMUNITY**: fetch `GET /race/{stageUrl}/community` client-side

The stage `raceBaseSlug` for the memories call is the same as the overall race base slug (e.g. `race/volta-a-catalunya`). The `is_stage=true` and `stage_number=N` query params narrow the results to that specific stage. The existing `/memories/{race_base_slug:path}` endpoint already supports these filters (lines 19-34 of `routers/memories.py`).

The "SCRIVI RECENSIONE" button in MEMORIE precompiles the new diary form with:
- `race_url` = stage URL (e.g. `race/volta-a-catalunya/2026/stage-2`)
- `race_name` = stage name
- `is_stage=true`, `stage_number=N`

### `app/(app)/diary/new/page.tsx`

Add reading of two new query params:
```typescript
const isStage = params.is_stage === "true";
const stageNumber = params.stage_number ? Number(params.stage_number) : null;
```
Pass `isStage` and `stageNumber` as props to `ReviewEditor`.

### `components/diary/review-editor.tsx`

Add to `ReviewEditorProps`:
```typescript
isStage?: boolean;
stageNumber?: number | null;
```

Include in save payload:
```typescript
isStage: isStage ?? false,
stageNumber: stageNumber ?? null,
```

`raceBaseSlug` computation (already in the component) correctly produces `race/volta-a-catalunya` from a stage URL via `raceUrl?.replace(/\/\d{4}.*/, "")` — no change needed.

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

## File Summary

| File | Cambiamento |
|------|-------------|
| `backend/scrapers/races_scraper.py` | Aggiunge `GCEntry`, `StageFullDetail`, `fetch_stage_detail()` |
| `backend/routers/races.py` | Fix `stages: None` → lista `StageInfo`; nuovo endpoint `/stage/{url}` |
| `frontend/types/api.ts` | Aggiunge `StageInfo`, `GCEntry`, `StageFullDetail`; campo `stages` su `Race` |
| `frontend/app/(app)/races/[...slug]/page.tsx` | Passa `stages`, `memories`, `communityReviews`, `jwt`, `raceBaseSlug` a `StageRaceView` |
| `frontend/components/races/stage-race-view.tsx` | **Nuovo** — client component con dropdown + tab condizionali |
| `frontend/app/(app)/diary/new/page.tsx` | Legge `is_stage` e `stage_number` da searchParams, li passa a `ReviewEditor` |
| `frontend/components/diary/review-editor.tsx` | Aggiunge props `isStage`, `stageNumber`; li include nel payload di salvataggio |

---

## What Does NOT Change

- Overall race tabs (INFO · STARTLIST · MEMORIE · COMMUNITY · RISULTATI) — identical to current
- One-day race page — no dropdown shown, unchanged
- Diary entry model — already has `is_stage`, `stage_number`, `race_url`
- Community endpoint — already filters by `race_url`, works with stage URLs
- `/memories/{base_slug}` endpoint — already supports `is_stage` and `stage_number` filter params

---

## Out of Scope

- Deep-linking to a specific stage via URL
- Points (KOM, youth, sprints) classification tabs — can be added later
- Stage map / route visualization
