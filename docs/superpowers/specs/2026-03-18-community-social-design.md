vai p# CycleTracker — Community & Social Features Design

## 1. Overview

This document extends the core CycleTracker design (`2026-03-17-cycletracker-design.md`) with a community layer: public review feeds, threaded comments, and like/report interactions.

**Core addition:** Users can make their diary entries public, read other users' public reviews on race pages and in a global feed, and participate in threaded discussions.

**Design principle:** The social layer is additive — it extends the existing `diary_entry.is_public` field (already in the data model) and adds new tables without modifying existing ones. All social features are free.

---

## 2. Feature Summary

| Feature | Description |
|---------|-------------|
| Public reviews on race page | "Community" tab in race detail showing all public reviews for that race |
| Global community feed | `/community` page with all public reviews, sortable by recent/popular/hot |
| Threaded comments | Unlimited-depth nested comments on public reviews (Reddit/HN style) |
| Likes | Toggle like on reviews and comments |
| Moderation | Automatic profanity filter on write + report button for manual review |
| Notifications | In-app + push when someone comments on your review or replies to your comment |

---

## 3. Data Model

### 3.1 New Tables

#### `review_comment`

Threaded comments on public `diary_entry` records. Uses adjacency list: `parent_id = NULL` means top-level comment on the review; `parent_id` set means reply to another comment. Arbitrary depth resolved via PostgreSQL recursive CTE.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| diary_entry_id | UUID, FK → diary_entry | The review this comment thread belongs to |
| parent_id | UUID, FK → review_comment, nullable | NULL = top-level; set = reply to another comment |
| user_id | UUID, FK → user_profile | Comment author |
| body | text | Comment text |
| is_removed | boolean, default false | Soft delete (moderation or user deletion) |
| like_count | int, default 0 | Denormalized for fast feed queries |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `review_like`

Polymorphic likes table covering both reviews and comments.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → user_profile | |
| target_type | enum | `review`, `comment` |
| target_id | UUID | ID of the liked review or comment |
| created_at | timestamp | |

Constraint: `UNIQUE (user_id, target_type, target_id)` — one like per user per object.

#### `community_report`

User-submitted content reports. Feeds manual moderation queue.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| reporter_id | UUID, FK → user_profile | |
| target_type | enum | `review`, `comment` |
| target_id | UUID | |
| reason | text, nullable | Optional reason provided by reporter |
| resolved | boolean, default false | |
| created_at | timestamp | |

### 3.2 Modifications to Existing Tables

#### `diary_entry` — two new columns

| Column | Type | Notes |
|--------|------|-------|
| like_count | int, default 0 | Denormalized, updated on every like/unlike |
| comment_count | int, default 0 | Denormalized, updated on every comment create/delete |

These are denormalized for query performance. Updated atomically using `UPDATE ... SET like_count = like_count + 1` on the write path.

### 3.3 New Indexes

```sql
-- Comment thread queries
CREATE INDEX idx_review_comment_diary_entry ON review_comment(diary_entry_id);
CREATE INDEX idx_review_comment_parent ON review_comment(parent_id);

-- Like queries
CREATE INDEX idx_review_like_target ON review_like(target_type, target_id);
CREATE UNIQUE INDEX idx_review_like_user_target ON review_like(user_id, target_type, target_id);

-- Global feed queries
CREATE INDEX idx_diary_entry_public_recent ON diary_entry(is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX idx_diary_entry_public_popular ON diary_entry(is_public, like_count DESC) WHERE is_public = true;
CREATE INDEX idx_diary_entry_public_race ON diary_entry(race_url, is_public) WHERE is_public = true;
```

### 3.4 Updated Entity Relationship Diagram

```
User 1──* DiaryEntry        (a user's diary)
User 1──* CalendarFilter    (a user's calendar subscriptions)
User 1──* Watchlist         (races the user wants to follow)
User 1──* ReviewComment     (comments the user has written)
User 1──* ReviewLike        (likes the user has given)
DiaryEntry 1──* Mention     (all recognized entities)
DiaryEntry 1──* ReviewComment  (comments on a public review)
ReviewComment 1──* ReviewComment  (nested replies via parent_id)
```

---

## 4. Backend Architecture

### 4.1 New API Endpoints

#### Community Feed

```
GET /community/feed
  ?sort=recent|popular|hot    (default: recent)
  ?page=1
  ?race_level=1               (optional filter)
  ?gender=ME|WE               (optional filter)
```

**Sort implementations:**
- `recent` → `ORDER BY created_at DESC`
- `popular` → `ORDER BY like_count DESC, comment_count DESC`
- `hot` → Wilson-inspired score with time decay: `(like_count + comment_count * 2) / POW(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 + 2, 1.5)` computed in SQL

```
GET /race/{raceUrl}/community
  ?sort=recent|popular        (default: recent)
```

Returns public `diary_entry` records for a specific race across all users.

#### Comments

```
GET  /diary/{id}/comments                    Full comment tree (recursive CTE)
POST /diary/{id}/comments                    Create top-level comment
POST /diary/{id}/comments/{commentId}/reply  Reply to a comment
PUT  /comments/{id}                          Edit comment (author only)
DELETE /comments/{id}                        Soft delete (author or admin only)
```

`GET /diary/{id}/comments` returns a flat list with `parent_id` populated. The client constructs the tree client-side — standard approach used by Reddit and HN. The recursive CTE fetches the entire thread in one query:

```sql
WITH RECURSIVE comment_tree AS (
    SELECT * FROM review_comment
    WHERE diary_entry_id = :entry_id AND parent_id IS NULL
    UNION ALL
    SELECT c.* FROM review_comment c
    JOIN comment_tree ct ON c.parent_id = ct.id
)
SELECT * FROM comment_tree ORDER BY created_at ASC;
```

The query returns **all** comments including `is_removed = true` ones. The frontend is responsible for rendering removed comments as a tombstone ("Commento rimosso") to preserve thread structure. Filtering out removed rows server-side would sever entire subtrees when a parent is deleted.

#### Likes

```
POST /diary/{id}/like       Toggle like on a review
POST /comments/{id}/like    Toggle like on a comment
```

Both return `{ "liked": bool, "count": int }`. Toggle via `INSERT ... ON CONFLICT DO DELETE`, followed by atomic counter update on the target.

#### Moderation / Reports

```
POST /diary/{id}/report      Report a review
POST /comments/{id}/report   Report a comment
```

### 4.2 Automatic Profanity Filtering

Applied synchronously on write (POST/PUT) for all public review bodies and all comment bodies. Uses `better-profanity` (Python, zero infrastructure cost).

```python
from better_profanity import profanity

def check_content(text: str) -> None:
    if profanity.contains_profanity(text):
        raise HTTPException(
            status_code=400,
            detail="Il testo contiene linguaggio non consentito."
        )
```

Applied in:
- `POST /diary` and `PUT /diary/{id}` when `is_public = true`
- `POST /diary/{id}/comments` and `POST /diary/{id}/comments/{commentId}/reply`
- `PUT /comments/{id}`

Private diary entries are **not** filtered — they are personal notes.

### 4.3 Notifications — New Triggers

The notification infrastructure (in-app notification feed, Web Push integration, `notification` table) is defined and built in Phase 3 of the base CycleTracker plan. Community comment notifications are also Phase 3 work and depend on that infrastructure being in place first.

Two notification event types to implement as part of Phase 3:

| Event | Recipient | Example message |
|-------|-----------|-----------------|
| Comment on your review | Review author | "Marco ha commentato la tua recensione del Tour de France 2025" |
| Reply to your comment | Comment author | "Sofia ha risposto al tuo commento" |

Delivery: in-app notification feed + Web Push (Phase 3). Native push via Capacitor (Phase 4, same as base plan).

### 4.4 New Dependency

```
better-profanity>=0.7.0
```

One addition to `requirements.txt`. No external services or infrastructure required.

### 4.5 Updated Project Structure

```
fastApiExample/
├── routers/
│   ├── community.py         # GET /community/feed, GET /race/{url}/community
│   ├── comments.py          # Comment CRUD + like + report
│   └── ... (existing)
├── models/
│   ├── community.py         # ReviewComment, ReviewLike, CommunityReport SQLAlchemy models
│   └── ... (existing)
├── services/
│   ├── moderation.py        # Profanity filter wrapper
│   └── ... (existing)
```

---

## 5. Frontend Architecture

### 5.1 Navigation Changes

**Mobile bottom nav** (3 → 4 tabs):
```
[ Calendario ]  [ Diario ]  [ Community ]  [ Profilo ]
```

**Desktop sidebar:** Add "Community" entry between "Diario" and "Calendario".

### 5.2 New and Modified Pages

#### Race Detail — Community tab

The race detail page adds a fourth tab:
```
[ Info ]  [ Memories ]  [ Community ]  [ Startlist ]
```

The **Community** tab shows public `diary_entry` records from all users for that race. Sorting chips: `Recenti` / `Popolari`. Each card shows: user avatar + display name, review excerpt, star rating, like count, comment count. Clicking a card navigates to the full public review page.

Empty state: "Nessuna recensione pubblica per questa gara. Sii il primo!"

#### Global Community Feed (`/community`)

New top-level page. Full-width scrollable list of public reviews.

- Sorting chips: `Recenti` · `Popolari` · `Hot`
- Optional filter chips: gender (ME/WE), race level
- Each card: race name + year, user avatar + name, excerpt, rating, like count, comment count
- Infinite scroll / "Carica altri" button

#### Review Page — Comments Section

Below the review content (both `/diary/[id]` for the author and `/share/[token]` for public access), a comment section is shown when the review is public:

```
Commenti (4)

┌─ Marco ────────────────────────────────┐
│ Concordo, la tappa dello Stelvio era  │
│ spettacolare. Pogacar sembrava...      │
│ ❤ 3  ·  Rispondi  ·  Segnala          │
│                                        │
│  └─ Sofia ───────────────────────────┐│
│  │ Ma Vingegaard però ha tenuto...   ││
│  │ ❤ 1  ·  Rispondi  ·  Segnala      ││
│  └───────────────────────────────────┘│
└────────────────────────────────────────┘

┌─ Luigi ────────────────────────────────┐
│ Disagio totale, mi aspettavo di più    │
│ dal Giro quest'anno.                   │
│ ❤ 0  ·  Rispondi  ·  Segnala          │
└────────────────────────────────────────┘

[ Scrivi un commento...              [→] ]
```

**Nesting display rule:** Comments are indented visually up to 3 levels deep. Beyond level 3, a "Mostra thread" link replaces further indentation — prevents unusable narrow columns on mobile.

**Interactions:**
- "Rispondi" → inline reply box appears below the comment
- "Segnala" → modal with optional reason field
- Like button → optimistic UI update (toggle immediately, sync in background)
- Author can delete their own comment (shows as "Commento rimosso" with is_removed=true, preserving thread structure)

### 5.3 Updated Page Structure

```
app/
├── community/
│   └── page.tsx              # Global community feed
├── races/
│   └── [raceUrl]/
│       └── page.tsx          # Race detail (now 4 tabs: Info/Memories/Community/Startlist)
├── diary/
│   └── [id]/
│       └── page.tsx          # Review detail (now includes comment thread if is_public)
├── share/
│   └── [shareToken]/page.tsx # Public review (includes comment thread)
└── ... (existing pages unchanged)
```

---

## 6. Business Model Impact

### Free vs Premium

All community features are **free forever**:

| Feature | Free | Premium |
|---------|------|---------|
| Read public reviews in Community tab | ✓ | ✓ |
| Read public reviews in global feed | ✓ | ✓ |
| Make your review public | ✓ | ✓ |
| Comment on public reviews | ✓ | ✓ |
| Like reviews and comments | ✓ | ✓ |
| Report content | ✓ | ✓ |
| Comment notifications | ✓ | ✓ |

**Rationale:** An open community is an acquisition channel. Every public review is user-generated content that can appear in search results, be shared on social media, and attract new users. Gating community participation would kill growth at the most critical early stage.

### Growth Mechanics

- Every public review is shareable via the existing `/share/{token}` URL with Open Graph meta tags
- The global feed provides a reason to open the app even when not writing a review
- Comment threads create return visits ("did someone reply to me?")
- The notification loop (push → open app → read reply → write another comment) drives engagement

---

## 7. Tech Stack Assessment

No architectural changes required. The existing stack handles all community features natively:

| Requirement | Solution | Why it's enough |
|------------|----------|----------------|
| Nested comment trees | PostgreSQL recursive CTE | Native feature, zero overhead |
| Feed ranking | SQL `ORDER BY` + partial indexes | Hot score computable entirely in SQL |
| Like toggle | `INSERT ON CONFLICT DO DELETE` + atomic counter | Single atomic query, no race conditions |
| Real-time comments | Not implemented | Niche app: refresh-on-focus is sufficient. WebSockets + Redis pub/sub would be over-engineering |
| Profanity filter | `better-profanity` Python lib | Zero infrastructure, <1ms per check |
| Notifications | Existing notification system | 2 new event types only |

**Only new dependency:** `better-profanity>=0.7.0`

---

## 8. Implementation Phasing

These features integrate into the existing implementation phases:

### Phase 2 (Smart Features) — additions
- `review_comment`, `review_like`, `community_report` tables + migrations
- Comment CRUD endpoints
- Like toggle endpoints
- Report endpoints
- Profanity filter middleware
- Race detail Community tab (frontend)

### Phase 3 (Polish) — additions
- Global community feed (`/community` page)
- Comment notifications (in-app + Web Push)
- Feed sorting and filtering

### Phase 4 — no impact
Community features are complete by Phase 3. LLM features remain unchanged.
