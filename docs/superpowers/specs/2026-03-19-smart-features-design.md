# CycleTracker — Plan 2: Smart Features Design

## 1. Overview

This document specifies the Smart Features plan for CycleTracker, extending the backend foundation (Plan 1) with memories, watchlist, calendar feeds, sharing, and entity recognition. It builds on the core spec (`2026-03-17-cycletracker-design.md`).

**Priority order:** Memories system first (highest value, no NLP dependency), then watchlist + calendar + sharing, then entity recognition pipeline last.

**Approach:** Memories-first. The memories system is pure SQL — it queries `diary_entry` by `race_base_slug` and requires no NLP infrastructure. Entity recognition is the most complex block and is deferred to the end of this plan.

---

## 2. Stage Race Support

Stage races (Grand Tours, multi-day events) support two levels of review: the overall race and individual stages.

### Data model additions to `diary_entry`

| Column | Type | Notes |
|--------|------|-------|
| `stage_number` | int, nullable | Stage number (1, 2, ..., 21). NULL for overall race reviews |
| `is_stage` | boolean, default false | True if this entry is for a specific stage |

### URL conventions

`race_base_slug` follows the core spec definition — it is always the race path without year or stage suffix, e.g. `race/tour-de-france`. This is preserved for cross-year memories queries.

| Review type | `race_url` example | `race_base_slug` | `is_stage` | `stage_number` |
|-------------|-------------------|------------------|------------|----------------|
| Overall race | `race/tour-de-france/2024` | `race/tour-de-france` | false | NULL |
| Single stage | `race/tour-de-france/2024/stage-1` | `race/tour-de-france` | true | 1 |

**Same-stage-across-years memories:** filter by `race_base_slug = 'race/tour-de-france' AND is_stage = true AND stage_number = 1`. Returns all user Stage 1 reviews of the Tour across every year.

**Race-level memories (all entries for a race family):** filter by `race_base_slug = 'race/tour-de-france'` — returns both overall and stage reviews across years.

**All entries for one edition:** filter by `race_url LIKE 'race/tour-de-france/2024%'` — returns overall + all stage entries for that specific year.

### Pydantic schema updates

`DiaryEntryCreate` and `DiaryEntryUpdate` must be updated to include:
- `is_public: bool = False`
- `stage_number: Optional[int] = None`
- `is_stage: bool = False`

---

## 3. Memories System

### 3.1 Purpose

When a user opens a race page, the app surfaces their previous reviews of the same race from past years. This is the core differentiating feature of CycleTracker.

### 3.2 Endpoints

**`GET /memories/{race_base_slug:path}`**

Note: this endpoint is under `/memories/`, not `/diary/`, to avoid route conflicts with the existing `GET /diary/{entry_id}` endpoint in FastAPI.

- Returns all user's diary entries matching `race_base_slug`, ordered by `race_year` DESC
- Excludes the current year's entry if `exclude_year` query param is provided
- Optional query params: `is_stage` (bool), `stage_number` (int) for stage-specific memories
- Query: `SELECT * FROM diary_entry WHERE user_id = :uid AND race_base_slug = :slug [AND is_stage = :is_stage] [AND stage_number = :stage_number] ORDER BY race_year DESC`
- Response: list of `DiaryEntryResponse`

**`GET /diary/{id}/suggestions`**

- Returns entities mentioned in other diary entries by the same user that share entities with entry `id`
- Initially based on `race_base_slug` overlap (same race family, other years)
- Extended by entity mentions once entity recognition is implemented
- Response: `{ related_entries: DiaryEntryResponse[], shared_entities: MentionResponse[] }`

### 3.3 No NLP dependency

Both endpoints work purely from the relational data already stored in Phase 1. Entity-based suggestions degrade gracefully to empty list until entity recognition is running.

---

## 4. Watchlist

Simple race follow list. Users can bookmark races they want to follow.

### 4.1 Data model

Table `watchlist` (already in core spec):

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| race_url | text | PCS canonical URL |
| race_name | text | Denormalized at write time |
| race_date | date | For notification scheduling |
| created_at | timestamp | |

### 4.2 Endpoints

- `GET /watchlist` — user's followed races, ordered by `race_date` ASC
- `POST /watchlist` — add race (`race_url`, `race_name`, `race_date` in body)
- `DELETE /watchlist/{id}` — remove race
- `GET /watchlist/upcoming` — races with `race_date >= today`, next 30 days (additional endpoint beyond core spec, added for convenience)

---

## 5. Calendar Feeds

Users can create personalized iCal subscription feeds of the race calendar, filtered by their preferences. The feed URL is shareable and works in any calendar app (Google Calendar, Apple Calendar, Outlook).

### 5.1 Data model

Table `calendar_filter` (already in core spec):

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| label | text | e.g. "My WorldTour races" |
| subscription_token | UUID, unique | Secret embedded in .ics URL |
| filter_params | JSON | Same params as /races endpoint |
| created_at | timestamp | |

### 5.2 Endpoints

- `GET /calendar/filters` — user's saved filters (authenticated)
- `POST /calendar/filters` — create filter (`label`, `filter_params` in body); generates `subscription_token`
- `DELETE /calendar/filters/{id}` — delete filter
- `GET /calendar/feed/{subscription_token}.ics` — iCal feed (NO auth, token is the secret)

### 5.3 iCal generation

Uses `icalendar>=5.0.0` library (PyPI package: `icalendar`). Each race becomes a VEVENT:
- `SUMMARY`: race name
- `DTSTART`/`DTEND`: race dates (all-day events)
- `URL`: link to race on PCS
- `DESCRIPTION`: nation, category, race level

Feed is regenerated on each request. No caching needed at this stage.

---

## 6. Public Sharing

Users can generate a public link to share a single diary entry. The link works without authentication.

### 6.1 Data model

Field on `diary_entry` (already in core spec):
- `share_token`: UUID, unique, nullable — generated on first share request

### 6.2 Endpoints

- `POST /diary/{id}/share` — generate `share_token` if not set, return public URL (authenticated)
- `DELETE /diary/{id}/share` — revoke sharing by setting `share_token = NULL` (authenticated)
- `GET /share/{share_token}` — return public view of the entry (no auth, read-only)

The shared view includes: race name, rating, body, key moment, protagonist, dominant emotion. It does NOT include user identity unless user opts in (future feature).

---

## 7. Entity Recognition Pipeline

Runs after the memories/watchlist/calendar/sharing block. Processes diary entry text to extract mentions of riders, locations, and teams.

### 7.1 Three-layer architecture

```
POST /diary (save entry)
    │
    ├── Layer 1 — Synchronous (< 10ms)
    │   RapidFuzz fuzzy matching vs:
    │   - Race startlist (from PCS cache)
    │   - Location dictionary (~200 iconic climbs)
    │   - Team list from startlist
    │   → Saves Mention rows (confidence 0.6–0.8)
    │   → Returns immediately with initial mentions
    │
    └── Background job (FastAPI BackgroundTasks)
        │
        ├── Layer 2 — spaCy (50–150ms)
        │   xx_ent_wiki_sm multilingual model
        │   → Updates/adds Mention rows (confidence 0.8–0.95)
        │
        └── Layer 3 — Claude API (premium users only)
            Triggered for premium users on reviews >100 words,
            OR for any user when Layer 1+2 produce zero confident
            mentions (all candidate confidence < 0.6).
            → Disambiguation, sentiment, nuanced detection
            → Updates Mention rows (confidence 0.95–1.0)
```

### 7.2 Data sources

| Entity type | Source |
|-------------|--------|
| `rider` | Race startlist from PCS scrape cache |
| `location` | Curated dictionary (bundled with app) |
| `team` | Team list from startlist |

### 7.3 Mention model (already in core spec)

The `mention` table stores all recognized entities. Key fields:
- `entity_type`: `rider`, `location`, `team`
- `confidence`: 0.0–1.0
- `detection_method`: `fuzzy`, `spacy`, `llm`, `manual`
- `confirmed_by_user`: boolean (user can confirm/dismiss suggestions)

### 7.4 New endpoints

- `GET /diary/{id}/mentions` — all mentions for a diary entry
- `PATCH /mentions/{id}` — confirm or dismiss a mention (`confirmed_by_user`)
- `GET /mentions/entity/{entity_slug}` — all user's entries mentioning an entity

---

## 8. Implementation Order

1. Schema migration: add `stage_number`, `is_stage` to `diary_entry`; update `DiaryEntryCreate`/`DiaryEntryUpdate` Pydantic schemas
2. Memories endpoints: `GET /memories/{race_base_slug:path}`, `GET /diary/{id}/suggestions`
3. Watchlist CRUD
4. Calendar feeds (CalendarFilter model + iCal generation)
5. Sharing (share_token endpoints + public view)
6. Entity recognition: Layer 1 (RapidFuzz, sync)
7. Entity recognition: Layer 2 (spaCy, background)
8. Entity recognition: Layer 3 (Claude API, premium background)

---

## 9. Dependencies

| Dependency | Purpose |
|------------|---------|
| `icalendar>=5.0.0` | iCal feed generation |
| `rapidfuzz` | Layer 1 fuzzy matching |
| `spacy` + `xx_ent_wiki_sm` | Layer 2 NER |
| `anthropic` | Layer 3 Claude API (premium, optional) |
