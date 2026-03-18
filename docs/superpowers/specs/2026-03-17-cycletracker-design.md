# CycleTracker - Design Specification

## 1. Overview

CycleTracker is a mobile-first cycling race diary app that lets fans browse race calendars, write personal reviews, and rediscover their memories through intelligent cross-referencing.

**Core value proposition:** A personal cycling diary with contextual intelligence — the app surfaces relevant past reviews while you write, connecting your memories across races, riders, and locations.

### Target Users

Cycling enthusiasts who follow professional road racing (Grand Tours, Monuments, Classics). They watch races live or recorded, have opinions about what they see, and want a structured way to remember and revisit their impressions.

### Platform Strategy

- **Phase 1:** Progressive Web App (Next.js) — mobile-first, installable, no app store
- **Phase 2:** Native app via Capacitor wrapping the same codebase — push notifications, app store presence, native calendar access

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│            Next.js 14+ PWA (App Router)              │
│         Tiptap editor · Tailwind CSS · next-pwa      │
│              ┌──────────────────────┐                │
│              │ Capacitor (Phase 2)  │                │
│              │ iOS + Android native │                │
│              └──────────────────────┘                │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS + JWT
                   ▼
┌─────────────────────────────────────────────────────┐
│                    Backend                           │
│               FastAPI (async, uvicorn)                │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ Routers  │ │ Services │ │ Background Tasks   │   │
│  │ races    │ │ rider    │ │ spaCy NER          │   │
│  │ diary    │ │ detection│ │ LLM enrichment     │   │
│  │ calendar │ │ memory   │ │ notification queue  │   │
│  │ share    │ │ calendar │ │                     │   │
│  │ riders   │ │ gen      │ │                     │   │
│  └──────────┘ └──────────┘ └────────────────────┘   │
└──────────────────┬──────────────────────────────────┘
                   │ asyncpg + SQLAlchemy 2.x
                   ▼
┌─────────────────────────────────────────────────────┐
│              Supabase                                │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ Auth         │  │ PostgreSQL                  │   │
│  │ Email+pass   │  │ diary_entry, mention,       │   │
│  │ Google OAuth │  │ calendar_filter, user_profile│  │
│  │ Apple OAuth  │  │ Full-text search (GIN)      │   │
│  └──────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                   ▲
                   │ HTTP scraping
┌─────────────────────────────────────────────────────┐
│            ProCyclingStats (external)                 │
│     Race data · Startlists · Stage info              │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14+ (App Router) | Mobile-first SSR/SSG, largest ecosystem |
| UI | Tailwind CSS | Utility-first, responsive, fast iteration |
| Editor | Tiptap (ProseMirror) | Rich text + mention extension for @rider |
| PWA | Serwist (next-pwa successor) | Service worker, offline, installability |
| Native wrapper | Capacitor (Phase 2) | Same codebase, native push + calendar |
| Backend | FastAPI (Python, async) | Already exists, async-native, excellent perf |
| ORM | SQLAlchemy 2.x async + Alembic | Portable, async, migration support |
| Database | PostgreSQL (hosted by Supabase) | FTS, JSON, scalable, zero vendor lock-in on data |
| Auth | Supabase Auth | Email + Google + Apple OAuth built-in |
| NLP Layer 1 | RapidFuzz | Fuzzy matching, <10ms, zero cost |
| NLP Layer 2 | spaCy (xx_ent_wiki_sm) | Multilingual NER, local, zero cost |
| NLP Layer 3 | Claude API (optional) | Advanced disambiguation, sentiment |
| Calendar | Python icalendar | .ics generation for feeds |
| Background jobs | FastAPI BackgroundTasks (Phase 1), migrate to arq + Redis if needed | Async NLP processing |

---

## 3. Data Model

### Entity Relationship Diagram

```
User 1──* DiaryEntry        (a user's diary)
User 1──* CalendarFilter    (a user's calendar subscriptions)
User 1──* Watchlist         (races the user wants to follow)
DiaryEntry 1──* Mention     (all recognized entities: riders, locations, teams)
```

Note: `User` and `Identity` (login methods) are managed by Supabase Auth (`auth.users`, `auth.identities`). We only store a `user_profile` table for app-specific data.

### user_profile

App-specific user data extending Supabase's auth.users.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | Same as Supabase auth.users.id |
| display_name | text | |
| avatar_url | text, nullable | From OAuth provider or custom |
| created_at | timestamp | |
| is_active | boolean, default true | Soft-disable |

### diary_entry

The core entity. One entry per user, per race, per year.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| race_url | text | PCS canonical URL, e.g. `race/tour-de-france/2024` |
| race_name | text | Denormalized, cached at write time |
| race_year | int | Extracted from race_url for query efficiency |
| race_base_slug | text | e.g. `race/tour-de-france` (no year). Key for memories |
| rating | int 1-5, nullable | User can write without rating |
| body | text | Free-form review text |
| key_moment | text, nullable | Structured optional field |
| protagonist | text, nullable | Free text or rider name |
| dominant_emotion | text, nullable | e.g. "entusiasmo", "delusione" |
| is_public | boolean, default false | Private by default |
| share_token | UUID, unique, nullable | Generated on first share |
| created_at | timestamp | |
| updated_at | timestamp | |

### mention (polymorphic entity recognition)

Single table for all recognized entities. Extensible without schema changes.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| diary_entry_id | UUID, FK → diary_entry | |
| entity_type | enum | `rider`, `location`, `team`, ... (extensible) |
| entity_name | text | Canonical name ("Tadej Pogacar", "Passo dello Stelvio") |
| entity_slug | text | Stable key (`rider/tadej-pogacar`, `location/stelvio`) |
| entity_metadata | JSON, nullable | Type-specific data: `{"nationality":"SI"}`, `{"altitude":2758}` |
| mention_text | text, nullable | Text fragment where entity was found |
| confidence | float | 0.0 - 1.0 |
| detection_method | enum | `fuzzy`, `spacy`, `llm`, `manual` |
| confirmed_by_user | boolean, default false | |
| created_at | timestamp | |

### calendar_filter

Saved filter set for iCal subscription feed.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| label | text | e.g. "My WorldTour races" |
| subscription_token | UUID, unique | Secret embedded in .ics URL |
| filter_params | JSON | Same params as /races endpoint |
| created_at | timestamp | |

### watchlist

Simple race follow list.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| race_url | text | PCS canonical URL |
| race_name | text | Denormalized |
| race_date | date | For notification scheduling |
| created_at | timestamp | |

### Key Indexes

- `diary_entry(user_id)` — all queries are user-scoped
- `diary_entry(race_base_slug, user_id)` — memories query (same race, previous years)
- `diary_entry(share_token)` — public sharing lookup (partial index on NOT NULL)
- `mention(diary_entry_id, entity_slug)` — cross-review entity suggestions (user_id filtering via JOIN through diary_entry)
- `mention(diary_entry_id)` — all mentions for a review
- `mention(entity_type)` — filter by type (user_id filtering via JOIN through diary_entry)
- `diary_entry USING GIN(to_tsvector('simple', body))` — full-text search
- `calendar_filter(subscription_token)` — iCal feed lookup

### Design Decisions

- **No local Race table.** Race data lives on PCS, fetched on demand, optionally cached. `race_url` in diary_entry is the permanent foreign reference.
- **Supabase PostgreSQL access:** SQLAlchemy connects via Supabase's connection pooler (PgBouncer in transaction mode) using the `postgresql+asyncpg://` connection string. This is a standard PostgreSQL connection — no Supabase client SDK needed for data operations.
- **Polymorphic Mention table.** Single table for riders, locations, teams, and any future entity type. `entity_metadata` (JSON) absorbs type-specific differences. New entity types require only a new enum value and a new matcher in the pipeline — zero schema migrations.
- **race_base_slug** is the key for the memories system: `race/tour-de-france` matches across all years.

---

## 4. Backend Architecture

### Project Structure

```
fastApiExample/
├── main.py                      # FastAPI app + router registration
├── run.py                       # Dev server entry point
├── requirements.txt
├── alembic/                     # Database migrations
│   └── versions/
├── alembic.ini
├── models/
│   ├── race.py                  # RaceModel (existing, consolidated)
│   ├── user.py                  # UserProfile SQLAlchemy model
│   ├── diary.py                 # DiaryEntry + Mention
│   └── calendar_filter.py       # CalendarFilter + Watchlist
├── scrapers/
│   └── races_scraper.py         # PCS scraping (existing)
├── routers/
│   ├── races.py                 # GET /races, GET /race/{url}
│   ├── diary.py                 # CRUD diary entries
│   ├── mentions.py              # Entity mentions and cross-review suggestions
│   ├── calendar.py              # .ics feed + filter management
│   ├── share.py                 # Public sharing links
│   └── users.py                 # Profile management
├── services/
│   ├── entity_detection.py      # Unified recognition pipeline (3 layers)
│   ├── memory.py                # Memories and cross-review suggestions
│   └── calendar_generator.py    # .ics generation with icalendar lib
├── auth/
│   └── middleware.py             # Supabase JWT verification
├── db/
│   └── session.py               # SQLAlchemy async engine + session factory
└── tasks/
    └── background.py            # Async jobs (spaCy, LLM enrichment)
```

### API Endpoints

**Races (existing, refactored into router):**
- `GET /races` — filtered race list (unchanged)
- `GET /race/{race_url:path}` — race detail (unchanged)

**Diary (authenticated):**
- `GET /diary` — user's reviews (paginated, filterable by year/race/rider)
- `GET /diary/{id}` — single review with mentions
- `POST /diary` — create review (triggers entity recognition pipeline)
- `PUT /diary/{id}` — update review (re-triggers recognition)
- `DELETE /diary/{id}` — delete review and associated mentions

**Memories and Suggestions (authenticated):**
- `GET /memories/{race_base_slug:path}` — reviews of same race from previous years
- `GET /diary/{id}/suggestions` — contextual suggestions for a review (entities mentioned elsewhere)
- `GET /mentions/entity/{entity_slug}` — all user's reviews mentioning an entity

**Calendar (mixed auth):**
- `GET /calendar/filters` — user's saved filters (authenticated)
- `POST /calendar/filters` — create new filter/feed
- `DELETE /calendar/filters/{id}` — delete filter
- `GET /calendar/feed/{subscription_token}.ics` — iCal feed (NO auth, token is the secret)

**Sharing (public):**
- `GET /share/{share_token}` — public review (no auth)
- `POST /diary/{id}/share` — generate share_token (authenticated)
- `DELETE /diary/{id}/share` — revoke sharing (authenticated)

**Watchlist (authenticated):**
- `GET /watchlist` — user's followed races
- `POST /watchlist` — add race to watchlist
- `DELETE /watchlist/{id}` — remove race

**User (authenticated):**
- `GET /me` — user profile + stats
- `PUT /me` — update display_name, avatar

### Authentication Flow

```
Client (Next.js)
    │
    ├── Login with Google/Apple/Email → Supabase Auth (handles everything)
    │                                        │
    │                                        ▼
    │                                 JWT token issued
    │
    ├── API requests with header: Authorization: Bearer <jwt>
    │                                        │
    ▼                                        ▼
FastAPI                              auth/middleware.py
                                     verifies JWT with Supabase public key
                                     extracts user_id from token
                                     injects user_id into routes via Depends()
```

The backend never handles passwords or OAuth flows. Supabase manages all of it. FastAPI only receives and validates JWTs.

### Entity Recognition Pipeline

When a user saves a review, a single unified pipeline processes the text:

**Data sources for matching:**

| Entity type | Source | Example |
|-------------|--------|---------|
| `rider` | Race startlist (from PCS) | "Pogacar" matches startlist |
| `location` | Curated dictionary (~200 iconic climbs/locations) + stage departure/arrival from PCS | "Stelvio" matches dictionary |
| `team` | Team list from startlist (from PCS) | "Visma" matches team |

**Pipeline execution:**

```
POST /diary → save to DB → return response immediately
    │
    ├── Synchronous (< 10ms): Layer 1 - Fuzzy match (RapidFuzz)
    │   Compare text against startlist + location dictionary + team list
    │   Save Mention rows with confidence 0.6-0.8
    │   Client gets instant visual feedback (highlighted entities)
    │
    └── Asynchronous (background job):
        │
        ├── Layer 2: spaCy NER multilingual (50-150ms)
        │   PERSON entities → cross-ref with riders
        │   LOC entities → cross-ref with location dictionary
        │   Updates Mention confidence to 0.8-0.9
        │
        └── Layer 3 (optional, reviews >100 words):
            LLM extracts complex mentions + sentiment
            Resolves implicit references ("the Slovenian champion" = Pogacar)
            Resolves location references ("the climb to Bormio" = Stelvio)
            Updates Mention confidence to 0.9-1.0
```

**Location dictionary:** Starts with ~200 curated entries of iconic cycling locations (Stelvio, Mortirolo, Tourmalet, Alpe d'Huez, Poggio, Koppenberg, Roubaix sectors...). Enriched by:
- Automatically from scraped stage data (departure/arrival already available)
- User-contributed: when a user manually tags an unrecognized location, it's added to their personal dictionary

**Free vs Premium entity recognition boundary:**
- **Free:** Layer 1 (fuzzy) + Layer 2 (spaCy) for ALL entity types including locations from the curated dictionary. Free users get rider, team, and known-location recognition.
- **Premium:** Layer 3 (LLM) adds detection of implicit/unlisted locations ("the climb to Bormio" = Stelvio), nickname resolution ("Pogi" = Pogacar), disambiguation, and sentiment extraction. Premium also enables cross-review contextual suggestions in the editor (see Memories System below).

### Memories System

No NLP required — pure SQL queries.

**Same race, previous years:**
```sql
SELECT * FROM diary_entry
WHERE user_id = :uid
  AND race_base_slug = :slug
  AND race_year < :current_year
ORDER BY race_year DESC
```

**Cross-review entity suggestions (editor only):**
```sql
SELECT m.mention_text, de.race_name, de.race_year, de.rating
FROM mention m
JOIN diary_entry de ON m.diary_entry_id = de.id
WHERE m.entity_slug = :detected_slug
  AND de.user_id = :uid
  AND de.id != :current_entry_id
ORDER BY de.race_year DESC
LIMIT 5
```

Key distinction:
- **Race detail page → "Memories" tab:** ONLY shows reviews of the same race from previous years. Available to all users (free).
- **Editor → suggestions sidebar (Premium):** Shows cross-review suggestions when a recognized entity (rider, location, team) also appears in other reviews. This is a Premium feature because it's the high-value "magic moment" that justifies the subscription — the underlying SQL query is simple, but the value of surfacing past memories while writing is what users pay for. Free users see detected entities but not cross-review suggestions.

### Calendar Feed Generation

`GET /calendar/feed/{token}.ics`:

1. Look up CalendarFilter by token
2. Call internal race listing logic with saved filter params
3. Generate .ics file using Python `icalendar` library
4. Each race becomes a VEVENT with start/end date, name, PCS link
5. Feed refreshes on every request (Google Calendar/Apple Calendar poll periodically)

### Dependencies (additions to requirements.txt)

```
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29.0
alembic>=1.13.0
supabase>=2.0.0
python-jose[cryptography]>=3.3.0
rapidfuzz>=3.6.0
icalendar>=5.0.0
spacy>=3.7.0
```

**Background jobs strategy:** Phase 1 uses FastAPI's built-in `BackgroundTasks` — zero additional infrastructure, sufficient for spaCy processing at low volume. If latency or reliability becomes an issue at scale, migrate to `arq` (lightweight async task queue) with Redis. This avoids Celery's complexity and the need for Redis hosting in the free-tier phase.

---

## 5. Frontend Architecture

### Tech Stack

| Technology | Role |
|------------|------|
| Next.js 14+ (App Router) | Framework, SSR/SSG, routing |
| Supabase JS Client | Auth (login/signup/session management) |
| Tiptap | Rich text editor with @mention extension |
| Tailwind CSS | Utility-first responsive styling |
| Serwist (next-pwa) | Service worker, installability, offline cache |
| Capacitor (Phase 2) | Native wrapper for app stores |

### Page Structure

```
app/
├── layout.tsx              # Global shell: bottom nav (mobile), sidebar (desktop)
├── page.tsx                # Home → redirect to /races
├── (auth)/
│   ├── login/page.tsx      # Login (email + Google + Apple)
│   └── signup/page.tsx     # Registration
├── races/
│   ├── page.tsx            # Race calendar with filters
│   └── [raceUrl]/
│       └── page.tsx        # Race detail + Memories tab + CTA
├── diary/
│   ├── page.tsx            # My reviews (timeline)
│   ├── new/page.tsx        # Write new review
│   └── [id]/
│       ├── page.tsx        # Read review + mentions + suggestions
│       └── edit/page.tsx   # Edit review
├── calendar/
│   └── page.tsx            # My calendar feeds
├── riders/
│   └── [riderUrl]/page.tsx # All my mentions of this rider
├── share/
│   └── [shareToken]/page.tsx # Shared review (public, read-only)
└── profile/
    └── page.tsx            # Profile, stats, settings
```

### Main Screens

**1. Race Calendar (`/races`)**
Landing page. Race list in card format with filters: year, month, gender, race level, nation. Each card shows date, race name, nation flag, UCI class, and a badge if the user already reviewed that race. Filters as horizontal scrollable chips (mobile) or sidebar (desktop).

**2. Race Detail (`/races/[raceUrl]`)**
Race info from PCS. Three tabs:
- **Info:** stage list (stage races) or route info (one-day), CTA buttons for "Write review" and "Add to calendar"
- **Memories:** ONLY reviews of the same race from previous years. Shows year, excerpt, rating. Empty state if no previous reviews.
- **Startlist:** rider list with team and nationality

**3. Review Editor (`/diary/new`, `/diary/[id]/edit`)**
Core UX:
- Tiptap editor with basic formatting (bold, italic, lists)
- @mention: typing `@` triggers autocomplete with race startlist riders. Selected rider becomes a highlighted tag
- Collapsible structured fields: 1-5 star rating, key moment, protagonist, dominant emotion
- After save: detected entities shown as chips below editor. User can confirm or dismiss
- Suggestions sidebar (desktop) / bottom sheet (mobile): shows relevant past reviews when a recognized entity appears in another review

**4. My Diary (`/diary`)**
Chronological timeline of reviews. Each card: race name, date, excerpt, rating, entity chips. Filters by year, rider, rating. Full-text search across review body.

**5. Rider/Entity View (`/riders/[riderUrl]`)**
Personal dossier on a rider: all reviews mentioning them, with contextual excerpts. Stats: mention count, average rating of races where mentioned, top emotion.

### Navigation

- **Mobile (< 768px):** Bottom navigation bar with 3 tabs: Calendar, Diary, Profile
- **Desktop (>= 768px):** Left sidebar with full navigation + main content area

### Offline & PWA

- Service worker caches visited pages and race data
- Offline drafts: reviews written without connection are saved in IndexedDB and synced when online
- Installability: "Add to Home Screen" banner on Android, guided instructions on iOS

### Sharing

1. Backend generates `share_token` → public URL `/share/{token}`
2. Public page shows: race name, year, author display name, text, rating, entity chips
3. Open Graph meta tags for rich previews on WhatsApp/Telegram/Twitter
4. Web Share API on mobile: native share sheet
5. User can revoke sharing at any time

### Transition to Capacitor (Phase 2)

Same Next.js codebase. Add:
- `@capacitor/push-notifications` — native push (removes iOS PWA limitations)
- `@capacitor/share` — native share sheet (richer than Web Share API)
- Platform configuration files for iOS and Android

Native calendar write access (`@capacitor/calendar`) is intentionally omitted — .ics subscription feeds already provide cross-platform calendar integration without requiring device permissions.

95% of the code remains identical.

---

## 6. Notifications

| Notification | Trigger | Delivery |
|-------------|---------|----------|
| Race upcoming | 1 day before a race in user's calendar feed | Push |
| Write your review! | End of race day (20:00 CET) for races in user's watchlist | Push |
| Memory reminder | A race the user reviewed last year is about to start | Push: "Milano-Sanremo is in 2 days! Last year you gave it 5 stars" |
| New entity detected | Layer 2/3 finds an entity not found by fuzzy match | In-app |

Phase 1 (PWA): Web Push API (works on Android, limited on iOS).
Phase 2 (Capacitor): Full native push on both platforms.

---

## 7. Additional Features

**Watchlist:** Simple race follow list. Receive reminders and post-race nudges to write a review. Table: `watchlist(user_id, race_url, race_name, race_date)`.

**Full-text search:** "That time someone crashed in the rain..." → search across all review body text. PostgreSQL GIN index already provisioned.

**Diary export:** Export full diary as PDF or Markdown. Server-side generation on demand.

**Race of the day:** Home screen suggestion: "Today in 2025, Milano-Sanremo was raced. You gave it 5 stars!" — passive engagement to re-read old reviews.

**Personal statistics:**
- Most mentioned riders ranking
- Most mentioned locations
- Average rating trend by year
- Dominant emotion trends
- "Your cycling year" — end-of-year auto summary

All statistics are SQL aggregations on `mention` + `diary_entry`. No complex computation.

---

## 8. Costs & Scaling

### Free Tier (initial)

| Service | Free Tier | Paid threshold |
|---------|-----------|---------------|
| Vercel (frontend) | 100GB bandwidth | >100GB or team ($20/mo) |
| Supabase (auth + DB) | 500MB DB, 50K auth users | Inactivity pause; Pro $25/mo |
| Railway/Render (backend) | 500-750 free hours/mo | Always-on: ~$7/mo |
| spaCy | Free (open source) | Only server RAM (~300MB) |
| LLM (optional Layer 3) | Not needed for MVP | ~$3-6/mo per 1000 reviews |

**Total initial cost: $0.** Realistic cost with active users: ~$30-35/month.

### Scaling Path

- 1 to 10,000 users: no code changes. Only service plan upgrades.
- SQLAlchemy + PostgreSQL: portable. `pg_dump` to migrate away from Supabase if needed.
- FastAPI async: add uvicorn workers for concurrency. No code changes.
- Next.js on Vercel: auto-scales (serverless).
- NLP pipeline: add layers without rewriting existing ones.

---

## 9. Implementation Phases

### Phase 1: MVP (weeks 1-6)
- Consolidate existing FastAPI codebase (deduplicate RaceModel, add routers)
- Set up Supabase (auth + PostgreSQL)
- SQLAlchemy models + Alembic migrations
- Diary CRUD endpoints
- Layer 1 entity recognition (fuzzy matching)
- Memories endpoint (same race, previous years)
- Next.js frontend: race calendar, race detail, diary list, editor with @mentions
- Basic PWA setup

### Phase 2: Smart Features (weeks 7-10)
- Layer 2 entity recognition (spaCy background jobs)
- Cross-review suggestions in editor
- Location dictionary + location recognition
- Calendar feed (.ics generation + subscription URLs)
- Sharing (public links + Open Graph)
- Watchlist

### Phase 3: Polish & Native (weeks 11-14)
- Statistics and insights
- Notifications (Web Push)
- Full-text search
- Diary export
- "Race of the day"
- Capacitor integration for app stores
- Native push notifications

### Phase 4: AI Features (weeks 15+)
- Layer 3 LLM enrichment (optional, premium)
- AI-generated "Your cycling year" summary
- Advanced sentiment analysis
- Premium tier implementation

---

## 10. Business Plan

### Guiding Principle

The free tier must be a complete, useful product that someone would happily use indefinitely. Premium should feel like a genuine upgrade, not a hostage situation. The free tier builds the diary habit, and the diary habit creates switching costs. A user with 2+ years of race reviews is not going anywhere.

### Free Forever vs Premium

**Free Forever (core):**

| Feature | Rationale |
|---------|-----------|
| Browse full race calendar | Acquisition funnel. No gates. |
| Unlimited diary entries (text + rating + structured fields) | Core value prop must be free to build the habit |
| Rider recognition via spaCy (local NLP) | Key differentiator at zero marginal cost |
| Memories system (past reviews of same race) | Emotional hook and long-term retention |
| 1 calendar feed (.ics) | Enough for personal use |
| Share individual reviews via public links | Free viral distribution — every shared link is marketing |
| Basic statistics (top riders, average rating) | Gives users reason to keep writing |
| Full-text search across own reviews | Expected utility in any note-taking tool |

**Premium only:**

| Feature | Rationale |
|---------|-----------|
| LLM-powered entity recognition (Claude API) | Real per-request cost. Catches nicknames, disambiguates, recognizes climbs |
| Contextual writing suggestions (past reviews surfaced while writing) | High-value "magic moment", LLM cost justified |
| Location/climb recognition in reviews | Requires LLM or specialized model |
| Sentiment/emotion tracking over time | Creates longitudinal visualizations |
| "Your Cycling Year" AI-generated annual summary | High perceived value, modest cost |
| Full diary export (PDF/Markdown) | Low cost, appeals to data-ownership users |
| Unlimited calendar feeds | Free: 1 feed (covers 90% of cases) |
| Push notifications for race reminders | Natural premium perk |
| Priority data refresh | Free: 6h refresh. Premium: 30min |

**Key decision:** spaCy-based rider recognition stays free. If the app recognizes "Pogacar" and "Vingegaard" automatically, users are hooked. The LLM upgrade is "the same thing, but noticeably better" — it catches nicknames ("Pogi"), disambiguates, and recognizes climbs. That delta is what people pay for.

### Pricing

| | Free | Pro | Pro Annual |
|---|---|---|---|
| **Price** | $0 | $4.99/month | $39.99/year ($3.33/month) |
| Diary entries | Unlimited | Unlimited | Unlimited |
| Entity recognition | spaCy (good) | Claude LLM (excellent) | Claude LLM (excellent) |
| Contextual suggestions | No | Yes | Yes |
| Climb/location recognition | No | Yes | Yes |
| Sentiment tracking | No | Yes | Yes |
| "Your Cycling Year" | No | Yes | Yes |
| Calendar feeds | 1 | Unlimited | Unlimited |
| Export (PDF/Markdown) | No | Yes | Yes |
| Push notifications | No | Yes | Yes |
| Statistics | Basic | Advanced (trends) | Advanced |

**Why $4.99/month:** Cycling enthusiasts spend $5,000-15,000 on bikes, $200/year on Strava, $50-120/year on TrainingPeaks. $4.99/month is within their comfort zone but modest enough for an impulse decision. Below Strava ($11.99/month), signaling "complementary tool, not replacement." Annual discount at 33% off drives long-term commitments.

### Revenue per subscriber after platform fees

| Channel | Monthly | Annual |
|---------|---------|--------|
| Web (Stripe, 2.9% + $0.30) | $4.54 | $38.53 |
| App Store Year 1 (30%) | $3.49 | $27.99 |
| App Store Year 2+ (15%) | $4.24 | $33.99 |
| Google Play (15% for <$1M) | $4.24 | $33.99 |

### Timing Strategy

**Months 0-3 (Pure Free):** Launch free-only. Goal: 100-500 users. Build the habit loop. Collect usage data.

**Months 3-6 (Soft Premium):** Introduce Pro with launch promo (first 3 months at $2.99/month). Gate only LLM features. Offer "Your Cycling Year" as standalone $2.99 purchase (conversion gateway). Gentle "Pro" badges — no aggressive upselling.

**Months 6-12 (Optimize):** A/B test trial lengths. Show Pro value contextually (e.g., when LLM catches a climb spaCy missed, show "Recognized by CycleTracker Pro"). Season-start promotions (February).

**Year 2+:** Evaluate social features, API access for bloggers, cycling club white-label.

### Revenue Projections

Assumptions: 3-5% free-to-paid conversion, $4.20/month blended ARPU, $0.15-0.40/month LLM cost per paying user.

| Scale | Paying users | Monthly revenue | Infra cost | Net monthly |
|-------|-------------|----------------|------------|-------------|
| 100 users | 3-5 | $12-21 | $0 (free tiers) | $12-21 |
| 1,000 users | 30-50 | $126-210 | $30-35 | $83-167 |
| 10,000 users | 300-600 | $1,260-2,520 | $150-200 | $1,010-2,220 |
| 50,000 users | 2,000-3,500 | $8,400-14,700 | $500-700 | $7,200-13,325 |

Break-even at approximately 8-10 paying users ($30-35/month infra covered).

### LLM Cost Sensitivity

| Reviews/month per user | Cost at $0.005/call | Cost at $0.003/call |
|-----------------------|--------------------|--------------------|
| 10 (casual) | $0.05 | $0.03 |
| 30 (regular) | $0.15 | $0.09 |
| 80 (power user) | $0.40 | $0.24 |

Even power users cost well under $1/month against $4.20 ARPU. Margins are healthy.

### Alternative Revenue Streams

**Low effort:**
- Affiliate links to cycling events/gear (shown to free users only, premium is ad-free): $0.50-2.00 per active user/year
- Race event partnerships (featured listings for sportive organizers): $200-500/month per partner

**Medium effort:**
- Sponsored "Race of the Week" cards in calendar view: $500-2,000/month at 10K+ users
- Anonymized aggregate trend data for race organizers (with user consent)

**Higher effort (Year 2+):**
- API access for cycling bloggers/journalists: $9.99/month
- White-label diary system for cycling clubs: $29-99/month per club

### Target Revenue Mix (Year 2, 5,000 users)

| Stream | Monthly | % |
|--------|---------|---|
| Subscriptions (200 Pro) | $840 | 70% |
| Sponsored listings | $150 | 13% |
| Affiliate commissions | $100 | 8% |
| "Your Cycling Year" one-time | $50 | 4% |
| API access | $50 | 4% |
| **Total** | **$1,190** | **100%** |
