# Stage Race UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-stage navigation UI to the race detail page — a dropdown to select individual stages, with dedicated INFO · TAPPA · GC · MEMORIE · COMMUNITY tabs per stage.

**Architecture:** Backend exposes the already-fetched stages list and adds a new cached `/stage/{url}` endpoint using `procyclingstats.Stage`. Frontend splits the race detail page into a Server Component shell (keeps SSR) and a new `StageRaceView` client component that manages stage selection state and lazy-loads stage data on demand.

**Tech Stack:** FastAPI + Pydantic (backend), `procyclingstats` library, Next.js App Router + React (frontend), shadcn/ui Tabs, CacheService (SQLAlchemy async).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/scrapers/races_scraper.py` | Modify | Add `GCEntry`, `StageFullDetail` models; add `fetch_stage_detail()` |
| `backend/routers/races.py` | Modify | Fix `stages: None` → mapped list; add `GET /stage/{stage_url:path}` |
| `backend/tests/test_stage_endpoint.py` | Create | Integration tests for `/stage/` endpoint |
| `frontend/types/api.ts` | Modify | Add `StageInfo`, `GCEntry`, `StageFullDetail`; add `stages` to `Race` |
| `frontend/components/races/stage-race-view.tsx` | Create | Client component: dropdown + conditional tabs |
| `frontend/app/(app)/races/[...slug]/page.tsx` | Modify | Pass props to `StageRaceView`; remove inline tab JSX |
| `frontend/app/(app)/diary/new/page.tsx` | Modify | Read `is_stage`, `stage_number` searchParams |
| `frontend/components/diary/review-editor.tsx` | Modify | Accept + forward `isStage`, `stageNumber` to payload |

---

## Task 1: Add GCEntry, StageFullDetail and fetch_stage_detail() to the scraper

**Files:**
- Modify: `backend/scrapers/races_scraper.py` (after the existing `RaceInfo` class, ~line 60)

### Context

`procyclingstats.Stage` (imported as `from procyclingstats.stage_scraper import Stage as PCSStage`) has these methods:
- `.date()` → `str` (YYYY-MM-DD)
- `.distance()` → `float` (km)
- `.departure()` → `str`
- `.arrival()` → `str`
- `.stage_type()` → `"RR"` | `"ITT"` | `"TTT"`
- `.profile_icon()` → `"p0"` … `"p5"`
- `.vertical_meters()` → `int | None`
- `.won_how()` → `str`
- `.results("rank", "rider_name", "rider_url", "team_name", "nationality", "time")` → `list[dict]`
- `.gc("rank", "rider_name", "rider_url", "nationality", "time")` → `list[dict]` (no team_name; `time` = gap to leader)

All calls must be wrapped in a local `_safe()` helper (defined inside `fetch_stage_detail` itself) because PCS methods raise exceptions when data is unavailable. Note: the existing `fetch_race_detail` also uses a locally-scoped `_safe` — the pattern is intentionally local, not module-level.

- [ ] **Step 1: Add GCEntry and StageFullDetail models**

In `backend/scrapers/races_scraper.py`, after the `RaceInfo` class (around line 60), add:

```python
class GCEntry(BaseModel):
    rank: Optional[int] = None
    rider_name: str
    rider_url: str
    nationality: Optional[str] = None
    time: Optional[str] = None  # gap to leader, e.g. "+0:45"; "0:00:00" for the leader


class StageFullDetail(BaseModel):
    stage_name: str
    stage_url: str
    date: Optional[str] = None
    distance: Optional[float] = None
    departure: Optional[str] = None
    arrival: Optional[str] = None
    stage_type: Optional[str] = None   # "RR", "ITT", "TTT"
    profile_icon: Optional[str] = None  # "p0"–"p5"
    vertical_meters: Optional[int] = None
    won_how: Optional[str] = None
    results: List[RaceResultEntry] = []   # stage finishers (reuses existing class)
    gc: List[GCEntry] = []                # GC standings; time = gap to leader
```

Also add this import at the top of the file (Stage scraper):

```python
from procyclingstats.stage_scraper import Stage as PCSStage
```

- [ ] **Step 2: Add fetch_stage_detail() function**

At the end of `backend/scrapers/races_scraper.py`, after `fetch_race_result()`, add:

```python
def fetch_stage_detail(stage_url: str) -> StageFullDetail:
    """Fetch full detail for a single stage using procyclingstats.Stage."""
    stage = PCSStage(stage_url)

    def _safe(fn):
        try:
            return fn()
        except Exception:
            return None

    # Results
    results: List[RaceResultEntry] = []
    try:
        raw_results = stage.results("rank", "rider_name", "rider_url", "team_name", "nationality", "time")
        for r in raw_results:
            rank_val = r.get("rank")
            results.append(RaceResultEntry(
                rank=int(rank_val) if rank_val is not None else None,
                rider_name=r.get("rider_name", ""),
                rider_url=r.get("rider_url", ""),
                team_name=r.get("team_name"),
                nationality=r.get("nationality"),
                time=r.get("time"),
            ))
    except Exception as e:
        print(f"[WARN] fetch_stage_detail results failed for {stage_url}: {e}")

    # GC standings
    gc: List[GCEntry] = []
    try:
        raw_gc = stage.gc("rank", "rider_name", "rider_url", "nationality", "time")
        for g in raw_gc:
            rank_val = g.get("rank")
            gc.append(GCEntry(
                rank=int(rank_val) if rank_val is not None else None,
                rider_name=g.get("rider_name", ""),
                rider_url=g.get("rider_url", ""),
                nationality=g.get("nationality"),
                time=g.get("time"),
            ))
    except Exception as e:
        print(f"[WARN] fetch_stage_detail gc failed for {stage_url}: {e}")

    return StageFullDetail(
        stage_name=_safe(stage.stage_type) or "",
        stage_url=stage_url,
        date=_safe(stage.date),
        distance=_safe(stage.distance),
        departure=_safe(stage.departure),
        arrival=_safe(stage.arrival),
        stage_type=_safe(stage.stage_type),
        profile_icon=_safe(stage.profile_icon),
        vertical_meters=_safe(stage.vertical_meters),
        won_how=_safe(stage.won_how),
        results=results,
        gc=gc,
    )
```

- [ ] **Step 3: Verify the scraper file still imports cleanly**

```bash
cd backend && python -c "from scrapers.races_scraper import fetch_stage_detail, StageFullDetail, GCEntry; print('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/scrapers/races_scraper.py
git commit -m "feat: add GCEntry, StageFullDetail models and fetch_stage_detail() scraper"
```

---

## Task 2: Fix stages passthrough and add /stage/ endpoint

**Files:**
- Modify: `backend/routers/races.py`

### Context

`_detail_to_race_model()` currently hardcodes `"stages": None` (line 182). The fix maps `detail.stages` (list of `StageDetail` from the scraper) into the `StageInfo` shape that `RaceModel` expects (`models/race.py` line 61).

The new endpoint follows the exact same pattern as the existing `GET /race/{race_url:path}` — uses `CacheService`, derives TTL from the year in the URL, calls `asyncio.to_thread` for the blocking scraper call.

- [ ] **Step 1: Fix stages passthrough in _detail_to_race_model**

In `backend/routers/races.py`, find the `_detail_to_race_model` function. Replace the line:

```python
        "stages": None,
```

with:

```python
        "stages": _map_stages(detail.stages),
```

Then add this helper function just above `_detail_to_race_model`:

```python
def _map_stages(raw_stages):
    """Map List[StageDetail] from scraper → List[StageInfo] dict for RaceModel."""
    import re
    if not raw_stages:
        return None
    result = []
    for s in raw_stages:
        m = re.search(r"stage-(\d+)", s.stage_url)
        number = int(m.group(1)) if m else 0
        result.append({
            "number": number,
            "name": s.stage_name,
            "date": s.date,
            "stage_url": s.stage_url,
            "profile_icon": s.profile_icon,
            "departure": None,
            "arrival": None,
            "distance": None,
        })
    return result
```

- [ ] **Step 2: Add the GET /stage/{stage_url:path} endpoint**

In `backend/routers/races.py`, find the existing import line (exact text):

```python
from scrapers.races_scraper import fetch_races, fetch_race_detail, RaceDetailModel
```

Replace it with:

```python
from scrapers.races_scraper import fetch_races, fetch_race_detail, fetch_stage_detail, RaceDetailModel, StageFullDetail
```

Then add the new endpoint after the existing `get_race_detail` function:

```python
@router.get("/stage/{stage_url:path}", response_model=StageFullDetail)
async def get_stage_detail(
    stage_url: str,
    db: AsyncSession = Depends(get_db),
):
    cache = CacheService(db)
    cache_key = f"stage_detail:{stage_url}"

    year = CURRENT_YEAR
    try:
        year = int(stage_url.rstrip("/").split("/")[-2])  # .../2026/stage-1 → 2026
    except (ValueError, IndexError):
        pass

    is_past = year < CURRENT_YEAR
    ttl = timedelta(days=365 * 10) if is_past else timedelta(hours=1)

    async def _scrape():
        try:
            import asyncio
            detail = await asyncio.to_thread(fetch_stage_detail, stage_url)
            return detail.model_dump()
        except Exception as e:
            raise HTTPException(404, f"Stage not found: {e}")

    data = await cache.get(
        cache_key,
        scrape_fn=_scrape,
        ttl=ttl,
        data_type="stage_detail",
        source_url=f"pcs/{stage_url}",
        is_immutable=is_past,
    )
    return data
```

- [ ] **Step 3: Verify the backend starts without errors**

```bash
cd backend && python -c "from main import app; print('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/routers/races.py
git commit -m "feat: expose stages list in race detail and add GET /stage/ endpoint"
```

---

## Task 3: Backend tests for the /stage/ endpoint

**Files:**
- Create: `backend/tests/test_stage_endpoint.py`

### Context

Tests use the `async_client` and `auth_headers` fixtures from `conftest.py` (SQLite in-memory DB, mocked JWT). The scraper function is mocked with `unittest.mock.patch` so no actual HTTP calls are made.

**Cache test note:** `test_get_stage_detail_cached_on_second_call` relies on the `async_client` fixture sharing a single in-memory DB session between the two requests (so the first call's cache write is visible to the second call). If this test is flaky, check `conftest.py` to confirm the async session is not re-created per request. If it is, skip the cache test and verify caching manually.

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_stage_endpoint.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient

from scrapers.races_scraper import StageFullDetail, GCEntry, RaceResultEntry


def _make_stage_detail() -> StageFullDetail:
    return StageFullDetail(
        stage_name="RR",
        stage_url="race/volta-a-catalunya/2026/stage-2",
        date="2026-03-18",
        distance=178.2,
        departure="Girona",
        arrival="Olot",
        stage_type="RR",
        profile_icon="p4",
        vertical_meters=3200,
        won_how="Solo",
        results=[
            RaceResultEntry(
                rank=1,
                rider_name="POGACAR Tadej",
                rider_url="rider/tadej-pogacar",
                team_name="UAE Team Emirates",
                nationality="SI",
                time="4:22:14",
            )
        ],
        gc=[
            GCEntry(
                rank=1,
                rider_name="POGACAR Tadej",
                rider_url="rider/tadej-pogacar",
                nationality="SI",
                time="0:00:00",
            )
        ],
    )


@pytest.mark.asyncio
async def test_get_stage_detail_returns_200(async_client: AsyncClient):
    """GET /stage/{url} returns StageFullDetail with results and GC."""
    with patch(
        "routers.races.fetch_stage_detail",
        return_value=_make_stage_detail(),
    ):
        resp = await async_client.get(
            "/stage/race/volta-a-catalunya/2026/stage-2"
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["stageUrl"] == "race/volta-a-catalunya/2026/stage-2"
    assert data["distance"] == 178.2
    assert data["departure"] == "Girona"
    assert data["arrival"] == "Olot"
    assert len(data["results"]) == 1
    assert data["results"][0]["riderName"] == "POGACAR Tadej"
    assert len(data["gc"]) == 1
    assert data["gc"][0]["time"] == "0:00:00"


@pytest.mark.asyncio
async def test_get_stage_detail_cached_on_second_call(async_client: AsyncClient):
    """Second call returns cached data without calling the scraper again."""
    mock_fn = MagicMock(return_value=_make_stage_detail())
    with patch("routers.races.fetch_stage_detail", mock_fn):
        await async_client.get("/stage/race/volta-a-catalunya/2026/stage-2")
        await async_client.get("/stage/race/volta-a-catalunya/2026/stage-2")

    # Scraper called only once (second response served from cache)
    assert mock_fn.call_count == 1


@pytest.mark.asyncio
async def test_get_stage_detail_scraper_error_returns_404(async_client: AsyncClient):
    """Scraper failure produces 404."""
    with patch(
        "routers.races.fetch_stage_detail",
        side_effect=Exception("PCS unavailable"),
    ):
        resp = await async_client.get(
            "/stage/race/volta-a-catalunya/2026/stage-99"
        )

    assert resp.status_code == 404
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && pytest tests/test_stage_endpoint.py -v
```

Expected: 3 tests PASS

- [ ] **Step 3: Run the full backend test suite to check for regressions**

```bash
cd backend && pytest tests/ -q
```

Expected: all pre-existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_stage_endpoint.py
git commit -m "test: add integration tests for GET /stage/ endpoint"
```

---

## Task 4: Frontend types

**Files:**
- Modify: `frontend/types/api.ts`

- [ ] **Step 1: Add StageInfo, GCEntry, StageFullDetail types and update Race**

In `frontend/types/api.ts`, add the following block **before** the `Race` interface:

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
  time: string | null; // gap to leader, e.g. "+0:45"
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

Then add `stages` to the `Race` interface:

```typescript
  stages?: StageInfo[] | null;
```

(add after the existing `isFuture` line)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/types/api.ts
git commit -m "feat: add StageInfo, GCEntry, StageFullDetail types and stages field on Race"
```

---

## Task 5: StageRaceView client component

**Files:**
- Create: `frontend/components/races/stage-race-view.tsx`

### Context

This is a `"use client"` component. It receives server-fetched data for the overall view as props, then fetches stage-specific data on demand. The component conditionally renders one of two tab sets:

- **selectedStageUrl === null** → Overall tabs: INFO · STARTLIST · MEMORIE · COMMUNITY · RISULTATI (the existing JSX, moved here from the page)
- **selectedStageUrl !== null** → Stage tabs: INFO · TAPPA · GC · MEMORIE · COMMUNITY

The `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` come from `@/components/ui/tabs` (shadcn). Look at the existing `page.tsx` for the exact className patterns to reuse (`tech-label`, color tokens, etc.).

The `API_URL` is taken from `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`.

`StageInfo.number` is used to extract the stage number for the memories API call.

**Community endpoint assumption:** `GET /race/{stageUrl}/community` relies on the existing endpoint filtering diary entries by `race_url = stageUrl`. Stage URLs like `race/volta-a-catalunya/2026/stage-2` are stored as `race_url` in diary entries written via the stage write flow, so this filter works. If you see empty results for a stage that has community reviews, verify that the community endpoint does an exact-match on `race_url` and that stage reviews were saved with the full stage URL (not just the base slug).

Skeleton loading: use `<div className="h-4 bg-[#202013] animate-pulse rounded mb-2" />` rows (3–5) inside tab content while loading.

- [ ] **Step 1: Create the component file**

Create `frontend/components/races/stage-race-view.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Race,
  StageFullDetail,
  DiaryEntry,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-8 bg-[#202013] animate-pulse border border-[#484831]" />
      ))}
    </div>
  );
}

// ── Tab trigger helper ───────────────────────────────────────────────────────
function Trigger({ value }: { value: string }) {
  return (
    <TabsTrigger
      value={value}
      className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
    >
      {value.toUpperCase()}
    </TabsTrigger>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface StageRaceViewProps {
  race: Race;
  raceUrl: string;
  raceBaseSlug: string;
  jwt: string;
  memories: DiaryEntry[];
  communityReviews: DiaryEntry[];
  writeUrl: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export function StageRaceView({
  race,
  raceUrl,
  raceBaseSlug,
  jwt,
  memories,
  communityReviews,
  writeUrl,
}: StageRaceViewProps) {
  const [selectedStageUrl, setSelectedStageUrl] = useState<string | null>(null);
  const [stageData, setStageData] = useState<StageFullDetail | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageMemories, setStageMemories] = useState<DiaryEntry[]>([]);
  const [stageCommunity, setStageCommunity] = useState<DiaryEntry[]>([]);

  const stages = race.stages ?? [];
  const hasStages = stages.length > 0;

  const selectedStage = stages.find((s) => s.stageUrl === selectedStageUrl) ?? null;

  const selectStage = useCallback(
    async (stageUrl: string | null) => {
      setSelectedStageUrl(stageUrl);
      setStageData(null);

      if (!stageUrl) return;

      setStageLoading(true);
      try {
        const [detailRes, communityRes] = await Promise.all([
          fetch(`${API_URL}/stage/${stageUrl}`),
          fetch(`${API_URL}/race/${stageUrl}/community`),
        ]);
        if (detailRes.ok) setStageData(await detailRes.json());
        if (communityRes.ok) setStageCommunity(await communityRes.json());

        // Fetch user's stage memories (requires auth)
        if (jwt) {
          const stage = stages.find((s) => s.stageUrl === stageUrl);
          const stageNum = stage?.number;
          const memRes = await fetch(
            `${API_URL}/memories/${raceBaseSlug}?is_stage=true${stageNum != null ? `&stage_number=${stageNum}` : ""}`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          if (memRes.ok) setStageMemories(await memRes.json());
        }
      } finally {
        setStageLoading(false);
      }
    },
    [jwt, stages, raceBaseSlug]
  );

  // ── Stage selector dropdown ─────────────────────────────────────────────
  const stageSelector = hasStages ? (
    <div className="px-4 py-2 bg-[#151509] border-b border-[#484831]">
      <select
        value={selectedStageUrl ?? ""}
        onChange={(e) => selectStage(e.target.value || null)}
        className="w-full bg-[#202013] border border-[#484831] text-[#f8f8f5] tech-label text-xs px-3 py-2 appearance-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M6 8L0 0h12z' fill='%23cac8aa'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
      >
        <option value="">▾ Visione generale</option>
        {stages.map((s) => (
          <option key={s.stageUrl} value={s.stageUrl}>
            {`Tappa ${s.number}${s.date ? ` · ${s.date}` : ""}${s.departure && s.arrival ? ` · ${s.departure} → ${s.arrival}` : ""}`}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  // ── Stage view ──────────────────────────────────────────────────────────
  if (selectedStageUrl && selectedStage) {
    const stageWriteUrl = `/diary/new?race_url=${encodeURIComponent(selectedStageUrl)}&race_name=${encodeURIComponent(selectedStage.name)}&is_stage=true&stage_number=${selectedStage.number}`;

    return (
      <>
        {stageSelector}
        <Tabs defaultValue="info">
          <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4 overflow-x-auto">
            <Trigger value="info" />
            <Trigger value="tappa" />
            <Trigger value="gc" />
            <Trigger value="memorie" />
            <Trigger value="community" />
          </TabsList>

          {/* INFO */}
          <TabsContent value="info" className="space-y-4">
            {stageLoading ? <Skeleton /> : (
              <>
                <div className="bg-[#202013] border border-[#484831] p-4 space-y-2 text-sm mx-4">
                  {stageData?.date && <Row label="Data" value={stageData.date} />}
                  {stageData?.distance && <Row label="Distanza" value={`${stageData.distance} km`} />}
                  {stageData?.departure && <Row label="Partenza" value={stageData.departure} />}
                  {stageData?.arrival && <Row label="Arrivo" value={stageData.arrival} />}
                  {stageData?.stageType && <Row label="Tipo" value={stageData.stageType} />}
                  {stageData?.verticalMeters && <Row label="Dislivello" value={`${stageData.verticalMeters} m`} />}
                  {stageData?.wonHow && <Row label="Vittoria" value={stageData.wonHow} />}
                </div>
                <Link
                  href={stageWriteUrl}
                  className="flex items-center justify-center gap-2 bg-[#ffff00] text-black tech-label px-3 py-3 mx-4 hover:bg-[#cdcd00] transition-colors"
                >
                  + SCRIVI RECENSIONE TAPPA
                </Link>
              </>
            )}
          </TabsContent>

          {/* TAPPA — stage finishers */}
          <TabsContent value="tappa">
            {stageLoading ? <Skeleton /> : (
              stageData?.results.length ? (
                <div className="divide-y divide-[#484831]">
                  {stageData.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {r.rank != null && (
                        <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">{r.rank}</span>
                      )}
                      {r.nationality && <span className={`fi fi-${r.nationality.toLowerCase()} shrink-0`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">{r.riderName}</span>
                        {r.teamName && <span className="block text-[#cac8aa] text-xs truncate">{r.teamName}</span>}
                      </div>
                      {r.time && <span className="text-[#cac8aa] text-xs shrink-0 font-mono">{r.time}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Risultati non ancora disponibili." />
              )
            )}
          </TabsContent>

          {/* GC — general classification */}
          <TabsContent value="gc">
            {stageLoading ? <Skeleton /> : (
              stageData?.gc.length ? (
                <div className="divide-y divide-[#484831]">
                  {stageData.gc.map((g, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {g.rank != null && (
                        <span className={`tech-label w-6 text-right shrink-0 ${g.rank === 1 ? "text-[#ffff00] font-bold" : "text-[#cac8aa]"}`}>
                          {g.rank}
                        </span>
                      )}
                      {g.nationality && <span className={`fi fi-${g.nationality.toLowerCase()} shrink-0`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">{g.riderName}</span>
                      </div>
                      {g.time && <span className="text-[#cac8aa] text-xs shrink-0 font-mono">{g.time}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Classifica generale non disponibile." />
              )
            )}
          </TabsContent>

          {/* MEMORIE — user's stage reviews */}
          <TabsContent value="memorie">
            {stageLoading ? <Skeleton /> : (
              stageMemories.length === 0 ? (
                <div className="text-center py-12 text-[#cac8aa] space-y-3">
                  <p>Nessun ricordo per questa tappa.</p>
                  <Link href={stageWriteUrl} className="inline-block bg-[#ffff00] text-black tech-label px-4 py-2 hover:bg-[#cdcd00]">
                    + SCRIVI RECENSIONE
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {stageMemories.map((m) => (
                    <Link key={m.id} href={`/diary/${m.id}`}>
                      <div className="bg-[#202013] border border-[#484831] p-4">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[#cac8aa]">{m.raceYear}</span>
                          {m.rating != null && <span className="text-[#ffff00]">{"★".repeat(m.rating)}</span>}
                        </div>
                        <p className="text-[#cac8aa] text-sm line-clamp-2">{m.body.replace(/<[^>]+>/g, "")}</p>
                      </div>
                    </Link>
                  ))}
                  <Link href={stageWriteUrl} className="flex items-center justify-center bg-[#ffff00] text-black tech-label px-3 py-3 hover:bg-[#cdcd00]">
                    + SCRIVI RECENSIONE
                  </Link>
                </div>
              )
            )}
          </TabsContent>

          {/* COMMUNITY — public stage reviews */}
          <TabsContent value="community">
            {stageLoading ? <Skeleton /> : (
              stageCommunity.length === 0 ? (
                <EmptyState text="Nessuna recensione pubblica per questa tappa." sub="Sii il primo!" />
              ) : (
                <div className="space-y-3 p-4">
                  {stageCommunity.map((r) => (
                    <div key={r.id} className="bg-[#202013] border border-[#484831] p-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-[#cac8aa]">{r.authorName ?? "Utente"}</span>
                        {r.rating != null && <span className="text-[#ffff00]">{"★".repeat(r.rating)}</span>}
                      </div>
                      <p className="text-[#f8f8f5] text-sm line-clamp-3">{r.body.replace(/<[^>]+>/g, "")}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  }

  // ── Overall view (Generale) ─────────────────────────────────────────────
  const hasStartlist = race.startlist && race.startlist.length > 0;
  const hasResults =
    (race.stagesWinners && race.stagesWinners.length > 0) ||
    (race.raceResults && race.raceResults.length > 0);

  return (
    <>
      {stageSelector}
      <Tabs defaultValue="info">
        <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
          {(["info", "startlist", "memorie", "community"] as const).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
            >
              {tab.toUpperCase()}
            </TabsTrigger>
          ))}
          {hasResults && (
            <TabsTrigger
              value="risultati"
              className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
            >
              RISULTATI
            </TabsTrigger>
          )}
        </TabsList>

        {/* INFO */}
        <TabsContent value="info" className="space-y-4">
          <div className="bg-[#202013] border border-[#484831] p-4 space-y-2 text-sm mx-4">
            <Row label="Nazione" value={race.nation ?? "—"} flag={race.nation?.toLowerCase()} />
            <Row label="Categoria" value={`${race.uciClass ?? "—"}${race.gender ? ` — ${race.gender === "ME" ? "Elite Uomini" : "Elite Donne"}` : ""}`} />
            <Row label="Data inizio" value={race.startDate ?? "—"} />
            {race.endDate && race.endDate !== race.startDate && <Row label="Data fine" value={race.endDate} />}
            {race.raceInfo?.distance && <Row label="Distanza" value={race.raceInfo.distance} />}
            {race.raceInfo?.departure && <Row label="Partenza" value={race.raceInfo.departure} />}
            {race.raceInfo?.arrival && <Row label="Arrivo" value={race.raceInfo.arrival} />}
            {race.raceInfo?.wonHow && <Row label="Vittoria" value={race.raceInfo.wonHow} />}
            {race.raceInfo?.avgSpeed && <Row label="Velocità media" value={race.raceInfo.avgSpeed} />}
            {race.raceInfo?.avgTemperature && <Row label="Temperatura" value={race.raceInfo.avgTemperature} />}
          </div>
          <Link href={writeUrl} className="flex items-center justify-center gap-2 bg-[#ffff00] text-black tech-label px-3 py-3 mx-4 hover:bg-[#cdcd00] transition-colors">
            + SCRIVI RECENSIONE
          </Link>
        </TabsContent>

        {/* STARTLIST */}
        <TabsContent value="startlist">
          {hasStartlist ? (
            <div className="divide-y divide-[#484831]">
              {race.startlist!.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {entry.riderNumber != null && (
                    <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">{entry.riderNumber}</span>
                  )}
                  {entry.nationality && <span className={`fi fi-${entry.nationality.toLowerCase()} shrink-0`} />}
                  <div className="flex-1 min-w-0">
                    <span className="text-[#f8f8f5] text-sm font-medium">{entry.riderName}</span>
                    {entry.teamName && <span className="block text-[#cac8aa] text-xs truncate">{entry.teamName}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Startlist non ancora disponibile." />
          )}
        </TabsContent>

        {/* MEMORIE */}
        <TabsContent value="memorie">
          {memories.length === 0 ? (
            <EmptyState text="Nessun ricordo per questa gara." sub="Torna dopo aver scritto la tua prima recensione!" />
          ) : (
            <div className="space-y-3 p-4">
              {memories.map((m) => (
                <Link key={m.id} href={`/diary/${m.id}`}>
                  <div className="bg-[#202013] border border-[#484831] p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm text-[#f8f8f5]">{m.raceYear}</span>
                      {m.rating != null && <span className="text-[#ffff00] text-sm">{"★".repeat(m.rating)}</span>}
                    </div>
                    <p className="text-[#cac8aa] text-sm line-clamp-2">{m.body.replace(/<[^>]+>/g, "")}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COMMUNITY */}
        <TabsContent value="community">
          {communityReviews.length === 0 ? (
            <EmptyState text="Nessuna recensione pubblica per questa gara." sub="Sii il primo!" />
          ) : (
            <div className="space-y-3 p-4">
              {communityReviews.map((r) => (
                <div key={r.id} className="bg-[#202013] border border-[#484831] p-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#cac8aa]">{r.raceYear}</span>
                    {r.rating != null && <span className="text-[#ffff00] text-sm">{"★".repeat(r.rating)}</span>}
                  </div>
                  <p className="text-[#f8f8f5] text-sm line-clamp-3">{r.body.replace(/<[^>]+>/g, "")}</p>
                  <div className="flex gap-3 mt-2 text-xs text-[#cac8aa]">
                    <span>&#10084; {r.likeCount}</span>
                    <span>&#128172; {r.commentCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* RISULTATI */}
        {hasResults && (
          <TabsContent value="risultati">
            <div className="divide-y divide-[#484831]">
              {race.stagesWinners && race.stagesWinners.length > 0
                ? race.stagesWinners.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {w.nationality && <span className={`fi fi-${w.nationality.toLowerCase()} shrink-0`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">{w.riderName}</span>
                        <span className="block text-[#cac8aa] text-xs">{w.stageName}</span>
                      </div>
                    </div>
                  ))
                : race.raceResults!.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {r.rank != null && (
                        <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">{r.rank}</span>
                      )}
                      {r.nationality && <span className={`fi fi-${r.nationality.toLowerCase()} shrink-0`} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">{r.riderName}</span>
                        {r.teamName && <span className="block text-[#cac8aa] text-xs truncate">{r.teamName}</span>}
                      </div>
                      {r.time && <span className="text-[#cac8aa] text-xs shrink-0 font-mono">{r.time}</span>}
                    </div>
                  ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────
function Row({ label, value, flag }: { label: string; value: string; flag?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#cac8aa]">{label}</span>
      <span className="text-[#f8f8f5] flex items-center gap-1.5">
        {flag && <span className={`fi fi-${flag}`} />}
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="text-center py-12 text-[#cac8aa]">
      <p>{text}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/races/stage-race-view.tsx
git commit -m "feat: add StageRaceView client component with stage selector and tabs"
```

---

## Task 6: Refactor the race detail page to use StageRaceView

**Files:**
- Modify: `frontend/app/(app)/races/[...slug]/page.tsx`

The page becomes a thin SSR shell: it fetches all data (same as before) and passes it to `StageRaceView`. All tab JSX is removed from the page (it moved into `StageRaceView` in Task 5).

- [ ] **Step 1: Replace the page body**

Replace the entire content of `frontend/app/(app)/races/[...slug]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WatchlistToggle } from "@/components/races/watchlist-toggle";
import { StageRaceView } from "@/components/races/stage-race-view";
import Link from "next/link";
import type { Race, DiaryEntry, WatchlistItem } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchRaceDetail(raceUrl: string): Promise<Race | null> {
  try {
    const res = await fetch(`${API_URL}/race/${raceUrl}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchMemories(raceBaseSlug: string, jwt: string): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(
      `${API_URL}/memories/${raceBaseSlug}?is_stage=false`,
      { headers: { Authorization: `Bearer ${jwt}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchCommunityReviews(raceUrl: string): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(`${API_URL}/race/${raceUrl}/community`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchWatchlistItem(raceUrl: string, jwt: string): Promise<WatchlistItem | null> {
  try {
    const res = await fetch(`${API_URL}/watchlist`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const items: WatchlistItem[] = await res.json();
    return items.find((i) => i.raceUrl === raceUrl) ?? null;
  } catch {
    return null;
  }
}

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const raceUrl = `race/${slug.join("/")}`;
  const raceBaseSlug = `race/${slug[0]}`;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? "";

  const [race, memories, communityReviews, watchlistItem] = await Promise.all([
    fetchRaceDetail(raceUrl),
    jwt ? fetchMemories(raceBaseSlug, jwt) : Promise.resolve([]),
    fetchCommunityReviews(raceUrl),
    jwt ? fetchWatchlistItem(raceUrl, jwt) : Promise.resolve(null),
  ]);

  if (!race) notFound();

  const writeUrl = `/diary/new?race_url=${encodeURIComponent(raceUrl)}&race_name=${encodeURIComponent(race.name)}`;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="relative w-full h-48 bg-[#202013] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a0a] via-[#1a1a0a]/40 to-transparent z-10" />
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <span className="inline-block bg-[#ffff00] text-black tech-label px-2 py-0.5 mb-2">
            {race.uciClass ?? "UCI"}
          </span>
          <div className="flex items-end justify-between gap-2">
            <h1 className="kinetic-italic text-3xl text-[#f8f8f5] leading-none">{race.name}</h1>
            {jwt ? (
              <WatchlistToggle
                raceUrl={raceUrl}
                raceName={race.name}
                raceDate={race.startDate}
                initialItemId={watchlistItem?.id ?? null}
                compact
              />
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 tech-label border border-[#484831] text-[#cac8aa] hover:border-[#ffff00]/50 transition-colors"
              >
                WATCHLIST
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="bg-[#202013] border border-[#484831] p-3">
          <span className="tech-label text-[#cac8aa] block mb-1">Date</span>
          <span className="text-sm font-bold">
            {race.startDate}{race.endDate && race.endDate !== race.startDate ? ` — ${race.endDate}` : ""}
          </span>
        </div>
        <div className="bg-[#202013] border border-[#484831] p-3">
          <span className="tech-label text-[#cac8aa] block mb-1">Category</span>
          <span className="text-sm font-bold">
            {race.gender === "ME" ? "Men Elite" : race.gender === "WE" ? "Women Elite" : race.gender}
          </span>
        </div>
        <div className="bg-[#ffff00]/10 border border-[#ffff00]/20 p-3 col-span-2">
          <span className="tech-label text-[#ffff00] block mb-1">Classification</span>
          <span className="text-sm font-bold text-[#ffff00]">{race.uciClass}</span>
        </div>
      </div>

      {/* Tabs — delegated to StageRaceView */}
      <StageRaceView
        race={race}
        raceUrl={raceUrl}
        raceBaseSlug={raceBaseSlug}
        jwt={jwt}
        memories={memories}
        communityReviews={communityReviews}
        writeUrl={writeUrl}
      />
    </div>
  );
}
```

Note: `fetchMemories` now passes `?is_stage=false` to show only overall-race reviews in the Generale tab. **Verify** that the `/memories/` endpoint returns the same results with `?is_stage=false` as it did previously without the param (i.e., that when `is_stage` is absent the endpoint already defaults to returning all reviews, and that passing `false` explicitly does not exclude reviews that were saved without an explicit `is_stage` value). Check `routers/memories.py` lines 19-34 before merging.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Start the dev server and do a quick visual check**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000 and navigate to a one-day race — tabs should look identical to before. Navigate to a stage race — the dropdown should appear.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(app)/races/[...slug]/page.tsx
git commit -m "refactor: delegate race detail tabs to StageRaceView client component"
```

---

## Task 7: Forward is_stage and stage_number to diary form

**Files:**
- Modify: `frontend/app/(app)/diary/new/page.tsx`
- Modify: `frontend/components/diary/review-editor.tsx`

- [ ] **Step 1: Update diary/new/page.tsx to read stage params**

In `frontend/app/(app)/diary/new/page.tsx`, change:

```tsx
  const raceUrl = params.race_url;
  const raceName = params.race_name;
```

to:

```tsx
  const raceUrl = params.race_url;
  const raceName = params.race_name;
  const isStage = params.is_stage === "true";
  const stageNumber = params.stage_number ? Number(params.stage_number) : null;
```

And update the `ReviewEditor` render call from:

```tsx
        <ReviewEditor raceUrl={raceUrl} raceName={raceName} />
```

to:

```tsx
        <ReviewEditor raceUrl={raceUrl} raceName={raceName} isStage={isStage} stageNumber={stageNumber} />
```

- [ ] **Step 2: Update ReviewEditor to accept and save the stage props**

In `frontend/components/diary/review-editor.tsx`:

Change the `ReviewEditorProps` interface from:

```typescript
interface ReviewEditorProps {
  raceUrl?: string;
  raceName?: string;
  existing?: DiaryEntry;
}
```

to:

```typescript
interface ReviewEditorProps {
  raceUrl?: string;
  raceName?: string;
  existing?: DiaryEntry;
  isStage?: boolean;
  stageNumber?: number | null;
}
```

Change the function signature from:

```typescript
export function ReviewEditor({ raceUrl, raceName, existing }: ReviewEditorProps) {
```

to:

```typescript
export function ReviewEditor({ raceUrl, raceName, existing, isStage, stageNumber }: ReviewEditorProps) {
```

In `handleSave`, find the payload object literal. It ends with a line like:

```typescript
        isPublic,
```

Change it to:

```typescript
        isPublic,
        isStage: isStage ?? false,
        stageNumber: stageNumber ?? null,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run the full backend test suite one final time**

```bash
cd backend && pytest tests/ -q
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/diary/new/page.tsx frontend/components/diary/review-editor.tsx
git commit -m "feat: forward is_stage and stage_number from stage review link to diary save payload"
```
