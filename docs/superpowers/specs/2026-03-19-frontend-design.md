# CycleTracker — Plan 3: Frontend Design

## 1. Overview

This document specifies the Next.js frontend for CycleTracker. It builds on the backend (Plan 1) and smart features (Plan 2), providing a mobile-first Progressive Web App experience.

**Platform:** Progressive Web App (Next.js 14+, App Router). PWA installability added as the final task — all features work as a web app first.

**Design direction:** Dark & premium. Inspired by Strava and Whoop — dark backgrounds, strong typography, a bold accent color. Targeted at cycling enthusiasts who take the sport seriously.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14+ App Router | SSR/SSG, routing, mobile-first |
| Language | TypeScript | Type safety end-to-end |
| UI components | shadcn/ui | Accessible, fully customizable, Radix primitives |
| Styling | Tailwind CSS | Utility-first, consistent dark theme |
| Typography | Geist (Sans + Mono) | Vercel-native, modern, free |
| Auth | Supabase JS SDK (`@supabase/ssr`) | Handles JWT refresh, session cookies |
| API client | `fetch` with typed wrappers | Thin, no extra dependency |
| Editor | Tiptap (ProseMirror) | Rich text + `@rider` mention extension |
| PWA | Serwist | Service worker, offline, installability (last task) |
| Icons | Lucide React | Consistent, tree-shakeable |

---

## 3. Design System

### Color palette

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `zinc-950` (#09090b) | Page background |
| `surface` | `zinc-900` (#18181b) | Cards, modals, bottom bar |
| `surface-raised` | `zinc-800` (#27272a) | Inputs, hover states |
| `accent` | `#E91E8C` (magenta/cerise) | CTAs, active tabs, highlights |
| `accent-muted` | `#E91E8C` at 15% opacity | Subtle accents, badges |
| `text-primary` | `zinc-50` | Main text |
| `text-secondary` | `zinc-400` | Labels, metadata |
| `success` | `emerald-500` | Positive states |
| `destructive` | `red-500` | Delete, errors |

The accent magenta references the iconic cycling jerseys (Giro d'Italia maglia rosa, sprint classifications).

### Typography

- **Display:** Geist Sans, bold/semibold — race names, page titles
- **Body:** Geist Sans, regular — review text, descriptions
- **Mono:** Geist Mono — ratings, numeric data

### Component conventions

Built on shadcn/ui with dark theme configured in `tailwind.config.ts`. Components use CSS variables for theming (`--background`, `--accent`, etc.) making global theme changes trivial.

---

## 4. Navigation

### Bottom tab bar (mobile) — 5 tabs

Fixed at the bottom. This layout supersedes the 4-tab definition in `2026-03-18-community-social-design.md`, adopting a dedicated Write action as the center tab — a standard mobile pattern (Instagram, Strava) that promotes the primary action.

| Tab | Icon | Route |
|-----|------|-------|
| Home | Calendar | `/races` |
| Diary | BookOpen | `/diary` |
| Write | PlusCircle (accent colored, larger) | `/diary/new` |
| Community | Users | `/community` |
| Profile | User | `/profile` |

The Write tab (center) is accent-colored and slightly larger — primary action affordance.

On desktop (md+), the bottom bar becomes a left sidebar. The Write action becomes a button in the sidebar.

### Auth guard

`(app)/layout.tsx` checks Supabase session on the server. Unauthenticated users are redirected to `/login`. Auth pages (`/login`, `/signup`) are outside the `(app)` group and have their own minimal layout.

---

## 5. Pages

### 5.1 Auth pages

**`/login`**
- Email + password form
- "Continue with Google" OAuth button
- Link to `/signup`
- Dark branded layout with CycleTracker logo + tagline

**`/signup`**
- Email + password + display name
- "Continue with Google" OAuth button
- Terms acceptance checkbox
- Link to `/login`

Both pages use Supabase JS SDK (`supabase.auth.signInWithPassword`, `signUp`, `signInWithOAuth`). On success, redirect to `/races`. Session cookie set server-side via `@supabase/ssr`.

### 5.2 Home — Race Calendar

**Route:** `/races`

Race calendar with filters. Primary entry point for discovering races to review.

**Layout:**
- Filter bar at top: year selector, race level (1–4), nation, gender
- Race list: card per race, showing name, date, nation flag, level badge
- Each card shows: "✓ Reviewed" badge if user has a diary entry for that race
- Upcoming races highlighted with a "Today" / "In X days" indicator
- Pull-to-refresh on mobile

**Data:** calls `GET /races` with filter params. Paginated (load more on scroll).

**Race card CTA:** tap → `/race/[...slug]`

### 5.3 Race Detail

**Route:** `/race/[...slug]` (catches both `race/tour-de-france/2024` and `race/tour-de-france/2024/stage-1`)

Four tabs (aligned with the community spec and core spec):

**Tab 1 — Info**
- Race metadata (dates, nation, category)
- For stage races: stage list with navigation between stages
- "Write review" button → `/diary/new?race_url=...`
- If user already has a review: "Edit your review" button

**Tab 2 — Memories**
- User's past reviews of this same race (calls `GET /memories/{race_base_slug}`)
- Empty state: "No memories yet — come back after your first review"
- Cards showing year, rating, body excerpt

**Tab 3 — Community**
- Public reviews from other users (calls `GET /race/{race_url}/community`)
- Each review: rating stars, body excerpt, like button, comment count
- Tap → expand inline or go to review detail

**Tab 4 — Startlist**
- Link to startlist on PCS (external link)
- If startlist is cached in backend: show rider list inline

### 5.4 Diary List

**Route:** `/diary`

User's own reviews.

**Layout:**
- Filter: year tabs across the top (2026, 2025, 2024, ...)
- Race cards: race name, date, star rating, body excerpt, public/private badge
- Stage race entries: grouped under the parent race, collapsible
- Empty state: "Start your cycling diary" with CTA

### 5.5 Diary Entry Detail

**Route:** `/diary/[id]`

Full view of a single diary entry.

**Sections:**
1. Race header (name, date, nation)
2. Rating (1–5 stars, large display)
3. Body text (rich text rendered)
4. Structured fields: key moment, protagonist, dominant emotion
5. Entity mentions (riders, locations, teams highlighted) — shown once entity recognition is live
6. Share button (generates/copies public link)
7. **Memories section** — "Your previous reviews of this race" — cards for each past year, collapsed by default
8. **Comment thread** — shown only when `is_public = true`; calls `GET /diary/{id}/comments`; threaded display with reply support

### 5.6 Write / Edit Review

**Route:** `/diary/new` and `/diary/[id]/edit`

**Form fields:**
- Race name (pre-filled from query param `race_url`, read-only if set)
- Stage toggle: "Is this a stage review?" → shows stage number selector
- Rating: 1–5 star selector
- Body: Tiptap rich text editor (bold, italic, `@mention` for riders)
- Key moment (optional text field)
- Protagonist (optional text field)
- Dominant emotion (optional: emoji picker + label, e.g. "entusiasmo 🔥")
- Public toggle: "Share with community" (maps to `is_public`)
- Save button (accent color)

Auto-save draft to **IndexedDB** every 30 seconds (consistent with the core spec offline draft pattern; supports the PWA offline sync in Plan 4).

### 5.7 Community Feed

**Route:** `/community`

Global feed of public reviews.

**Layout:**
- Sort tabs: Recent · Popular · Hot
- Review cards: user avatar, race name, rating, body excerpt, like count, comment count
- Tap → review detail with threaded comments

### 5.8 Profile

**Route:** `/profile`

**Sections:**
- Avatar + display name (editable inline)
- Stats: total reviews, races followed, public reviews
- Watchlist: list of followed races with upcoming indicator
- Calendar feeds: list of .ics subscriptions with copy-link button
- Settings: logout, account deletion

---

## 6. Key UX Patterns

### Optimistic UI

Like toggles and watchlist add/remove update the UI immediately before the API confirms. On error, revert with a toast notification.

### Loading states

Skeleton loaders (shadcn/ui `Skeleton`) on initial page load. Inline spinners on mutations. No full-page loading screens.

### Error handling

API errors shown as toast notifications (shadcn/ui `Sonner`). Form validation errors shown inline below fields.

### Mobile-first responsiveness

Base styles target 375px width (iPhone SE). `md:` breakpoint (768px) adapts layout for tablet/desktop: bottom bar → sidebar, single column → two column.

---

## 7. Authentication Architecture

```
Next.js (App Router)
    ├── Server Components → read session from cookie via @supabase/ssr
    ├── Client Components → useSupabase() hook for mutations
    └── Middleware (middleware.ts) → refresh session on every request

Supabase Auth
    ├── Email + password
    └── Google OAuth (Phase 1)
        └── Apple OAuth (Phase 2 / Capacitor)
```

All FastAPI API calls include `Authorization: Bearer <jwt>` header. The JWT is retrieved from the Supabase session on the client.

---

## 8. API Client

Thin typed wrapper over `fetch`:

```typescript
// lib/api.ts
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>
```

All endpoint calls go through this function, which:
- Prepends the `NEXT_PUBLIC_API_URL` base URL
- Injects the Supabase JWT from the current session
- Throws typed `ApiError` on non-2xx responses

---

## 9. Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL |

---

## 10. Implementation Order

1. Project setup: Next.js 14+, TypeScript, Tailwind, shadcn/ui dark theme, Geist fonts
2. Auth: login + signup pages, Supabase session middleware, auth guard layout
3. Home (`/races`): race calendar page with filters, race cards
4. Race detail (`/race/[...slug]`): 4 tabs — Info, Memories, Community, Startlist
5. Diary list (`/diary`): user's reviews grouped by year
6. Write/edit review (`/diary/new`, `/diary/[id]/edit`): form with Tiptap editor, stage toggle
7. Diary entry detail (`/diary/[id]`): full view + memories section + comment thread
8. Community feed (`/community`): public reviews with likes
9. Profile (`/profile`): stats, watchlist, calendar feeds
10. PWA: Serwist service worker, web app manifest, install prompt
