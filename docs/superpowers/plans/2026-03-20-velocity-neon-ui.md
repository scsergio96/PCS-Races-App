# Velocity Neon UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all frontend pages to match the "Velocity Neon / Kinetic Brutalism" design system defined in the Stitch mockups (`stitch_race_calendar_mobile.zip`).

**Architecture:** Pure visual overhaul — no route, API, or logic changes. Design tokens flow from `globals.css` CSS variables → shadcn components → page-level layouts. Inter font (black italic uppercase) added for kinetic headlines; Geist retained for body text.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, `next/font/google` (Inter), Lucide React icons.

**Reference screenshots:** `/tmp/stitch_ui/stitch_race_calendar_mobile/*/screen.png`
**Reference HTML:** `/tmp/stitch_ui/stitch_race_calendar_mobile/*/code.html`
**Design system:** `/tmp/stitch_ui/stitch_race_calendar_mobile/velocity_neon/DESIGN.md`

**Working directory:** `/mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend`

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/layout.tsx` | Modify | Add Inter font CSS variable |
| `app/globals.css` | Modify | Full Velocity Neon token set + `.kinetic-italic` + `.tech-label` utilities |
| `app/(app)/layout.tsx` | Modify | Fix hardcoded `bg-[#09090b]` → `bg-[#1a1a0a]` on app shell wrapper |
| `components/layout/bottom-nav.tsx` | Modify | 4-tab layout (HOME/DIARY/COMMUNITY/PROFILE), yellow active state, sharp corners |
| `components/layout/sidebar.tsx` | Modify | Yellow accent, Inter headline, sharp corners |
| `components/races/race-card.tsx` | Modify | New layout: large kinetic name, date badge, flag, UCI + gender chips |
| `components/races/race-filters.tsx` | Modify | Yellow solid Filter Races CTA button + select styling |
| `app/(app)/races/page.tsx` | Modify | Add header with race count, "WORLD TOUR {year}" label, filter CTA |
| `components/diary/diary-card.tsx` | Modify | Timeline card: left yellow border, kinetic title, yellow stars, public/private badge |
| `app/(app)/diary/page.tsx` | Modify | Timeline layout, year tabs with yellow active border, NEW ENTRY header button |
| `app/(app)/diary/[id]/page.tsx` | Modify | Replace zinc styling; kinetic race name header, yellow stars, Velocity Neon comment thread |
| `app/(app)/diary/[id]/edit/page.tsx` | Modify | Replace zinc header styling |
| `app/(app)/diary/[id]/share-button.tsx` | Modify | Replace magenta accent with yellow |
| `components/community/community-card.tsx` | Modify | Yellow accent, kinetic race name, sharp card borders |
| `components/community/comment-thread.tsx` | Modify | Replace magenta submit buttons with yellow |
| `app/(app)/community/page.tsx` | Modify | Kinetic header, sort chips (yellow fill active), community card grid |
| `app/(app)/profile/page.tsx` | Modify | Stats with yellow divider, watchlist with date badge, calendar feeds, red sign-out border |
| `app/(app)/profile/copy-button.tsx` | Modify | Yellow CTA button |
| `components/diary/star-rating.tsx` | Modify | Use `#ffff00` (neon yellow) for filled stars |
| `components/diary/review-editor.tsx` | Modify | Emotion chips (yellow border/bg selected), editor container sharp border, yellow CTA |
| `app/(app)/diary/new/page.tsx` | Modify | "SCRIVI RECENSIONE" kinetic header with race name badge |
| `app/(app)/races/[...slug]/page.tsx` | Modify | Hero image overlay, kinetic race title, yellow UCI badge, tab underline yellow |
| `app/(auth)/layout.tsx` | Modify | Replace magenta brand accent with yellow |
| `app/(auth)/login/page.tsx` | Modify | Replace magenta buttons and links with yellow |
| `app/(auth)/signup/page.tsx` | Modify | Replace magenta buttons and links with yellow |
| `app/share/[token]/page.tsx` | Modify | Replace magenta brand/CTA with yellow |
| `components/races/watchlist-toggle.tsx` | Modify | Replace magenta "following" state with yellow |
| `types/api.ts` | Modify | Add optional `authorName?: string` to `DiaryEntry` |

---

## Design Tokens Reference

```
Background:        #1a1a0a  (was #09090b)
Surface:           #202013
Surface-container: #2b2b1d
Outline-variant:   #484831
Primary:           #ffff00  (was #E91E8C)
On-primary:        #000000
On-surface:        #f8f8f5
On-surface-variant: #cac8aa
Tertiary (blue):   #3b82f6  (Men Elite badge)
Error (red):       #ef4444  (Women Elite / destructive)
Border radius:     2px (sharp — was 0.625rem)

Utility classes:
.kinetic-italic { font-family: Inter; font-weight: 900; font-style: italic;
                  text-transform: uppercase; letter-spacing: -0.05em; }
.tech-label     { font-size: 10px; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.15em; }
```

---

## Task 1: Design System Foundation

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1.1 — Add Inter font to layout.tsx**

Replace the current Geist-only font setup with Inter added as a CSS variable alongside Geist:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CycleTracker",
  description: "Your personal cycling race diary",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#1a1a0a] text-[#f8f8f5]">
        {children}
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
```

- [ ] **Step 1.2 — Replace globals.css with Velocity Neon tokens**

Replace the entire `:root`, `.dark`, and `@layer base` sections. Keep the `@import` lines at the top untouched. Replace everything from `:root {` onward with:

```css
/* Keep these imports at the top — do not remove */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --font-inter: var(--font-inter), "Inter", sans-serif;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.5);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) * 2);
  --radius-xl: calc(var(--radius) * 3);
}

/* Velocity Neon — single mode (always dark) */
:root {
  --background: #1a1a0a;
  --foreground: #f8f8f5;
  --card: #202013;
  --card-foreground: #f8f8f5;
  --popover: #202013;
  --popover-foreground: #f8f8f5;
  --primary: #ffff00;
  --primary-foreground: #000000;
  --secondary: #2b2b1d;
  --secondary-foreground: #f8f8f5;
  --muted: #2b2b1d;
  --muted-foreground: #cac8aa;
  --accent: #ffff00;
  --accent-foreground: #000000;
  --destructive: #ef4444;
  --destructive-foreground: #f8f8f5;
  --border: #484831;
  --input: #2b2b1d;
  --ring: #ffff00;
  --radius: 0.125rem;
  --sidebar: #202013;
  --sidebar-foreground: #f8f8f5;
  --sidebar-primary: #ffff00;
  --sidebar-primary-foreground: #000000;
  --sidebar-accent: #2b2b1d;
  --sidebar-accent-foreground: #f8f8f5;
  --sidebar-border: #484831;
  --sidebar-ring: #ffff00;
}

/* shadcn expects .dark to exist even in single-mode dark apps */
.dark {
  --background: #1a1a0a;
  --foreground: #f8f8f5;
  --card: #202013;
  --card-foreground: #f8f8f5;
  --popover: #202013;
  --popover-foreground: #f8f8f5;
  --primary: #ffff00;
  --primary-foreground: #000000;
  --secondary: #2b2b1d;
  --secondary-foreground: #f8f8f5;
  --muted: #2b2b1d;
  --muted-foreground: #cac8aa;
  --accent: #ffff00;
  --accent-foreground: #000000;
  --destructive: #ef4444;
  --destructive-foreground: #f8f8f5;
  --border: #484831;
  --input: #2b2b1d;
  --ring: #ffff00;
  --sidebar: #202013;
  --sidebar-foreground: #f8f8f5;
  --sidebar-primary: #ffff00;
  --sidebar-primary-foreground: #000000;
  --sidebar-accent: #2b2b1d;
  --sidebar-accent-foreground: #f8f8f5;
  --sidebar-border: #484831;
  --sidebar-ring: #ffff00;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

@layer utilities {
  .kinetic-italic {
    font-family: var(--font-inter), "Inter", sans-serif;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    letter-spacing: -0.05em;
  }
  .tech-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }
  .glass-nav {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background-color: rgba(26, 26, 10, 0.85);
  }
}
```

- [ ] **Step 1.3 — Verify dev server starts without errors**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend
npm run dev
```

Expected: Server starts on port 3000/3001 with no compile errors. Background should appear dark olive (#1a1a0a).

- [ ] **Step 1.4 — Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat(ui): velocity neon design tokens — yellow primary, sharp corners, inter font"
```

---

## Task 2: Navigation Components

**Files:**
- Modify: `components/layout/bottom-nav.tsx`
- Modify: `components/layout/sidebar.tsx`

**Key changes:**
- Bottom nav: 4 tabs — HOME(/races), DIARY(/diary), COMMUNITY(/community), PROFILE(/profile). Remove centered Write CTA tab.
- Active state: `#ffff00` text + icon (not magenta)
- Nav bar: `border-t-2 border-[#ffff00]` top border, `glass-nav` background
- Sidebar: same yellow accent, `CYCLE` + `TRACKER` kinetic headline, sharp corners

- [ ] **Step 2.1 — Rewrite bottom-nav.tsx**

```tsx
// components/layout/bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const tabs: Tab[] = [
  { href: "/races", label: "HOME", icon: Home },
  { href: "/diary", label: "DIARY", icon: BookOpen, matchPrefix: "/diary" },
  { href: "/community", label: "COMMUNITY", icon: Users },
  { href: "/profile", label: "PROFILE", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t-2 border-[#ffff00] flex md:hidden">
      {tabs.map(({ href, label, icon: Icon, matchPrefix }) => {
        const isActive =
          pathname === href ||
          (matchPrefix != null && pathname.startsWith(matchPrefix) && pathname !== "/races");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
              isActive
                ? "text-[#ffff00]"
                : "text-[#cac8aa] hover:text-[#f8f8f5]"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="tech-label text-[8px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2.2 — Rewrite sidebar.tsx**

```tsx
// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, User, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const navItems: NavItem[] = [
  { href: "/races", label: "HOME", icon: Home },
  { href: "/diary", label: "DIARY", icon: BookOpen, matchPrefix: "/diary" },
  { href: "/community", label: "COMMUNITY", icon: Users },
  { href: "/profile", label: "PROFILE", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#202013] border-r-2 border-[#ffff00] p-4 gap-1">
      <div className="px-2 py-4 mb-4 border-b border-[#484831]">
        <span className="kinetic-italic text-lg text-[#f8f8f5]">
          Cycle<span className="text-[#ffff00]">Tracker</span>
        </span>
      </div>

      {navItems.map(({ href, label, icon: Icon, matchPrefix }) => {
        const isActive =
          pathname === href ||
          (matchPrefix != null && pathname.startsWith(matchPrefix) && pathname !== "/races");
        return (
          <Link key={href} href={href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-[#ffff00]/10 text-[#ffff00] border-l-2 border-[#ffff00]"
                  : "text-[#cac8aa] hover:text-[#f8f8f5] hover:bg-[#2b2b1d]"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="tech-label">{label}</span>
            </span>
          </Link>
        );
      })}

      <div className="mt-4">
        <Link
          href="/diary/new"
          className="flex w-full items-center justify-center gap-2 bg-[#ffff00] text-black px-3 py-2 text-sm font-black uppercase tracking-tighter transition-colors hover:bg-[#cdcd00]"
        >
          <PlusCircle className="w-4 h-4" />
          Scrivi recensione
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2.3 — Check nav renders correctly at mobile and desktop widths**

Visually confirm: yellow top border on mobile nav, yellow active tab text, sidebar has yellow left-border on active item.

- [ ] **Step 2.4 — Commit**

```bash
git add components/layout/bottom-nav.tsx components/layout/sidebar.tsx
git commit -m "feat(ui): velocity neon navigation — 4-tab bottom nav, yellow active state"
```

---

## Task 3: Race Calendar Page

**Files:**
- Modify: `components/races/race-card.tsx`
- Modify: `components/races/race-filters.tsx`
- Modify: `app/(app)/races/page.tsx`

**Key visual changes (from `race_calendar_mobile/screen.png`):**
- Card: date in yellow, flag + kinetic race name (large), UCI class tag (outlined), gender chip (blue/pink filled), "VIEW DETAILS →" link
- Page header: "WORLD TOUR {year}" label (yellow, tech-label), count headline "N RACES FOUND" (kinetic-italic, large)
- Filter button: solid yellow CTA full-width "⚙ FILTER RACES"
- Zebra-stripe alternating `bg-primary/5` rows

- [ ] **Step 3.1 — Rewrite race-card.tsx**

```tsx
// components/races/race-card.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Race } from "@/types/api";

const NATION_FLAGS: Record<string, string> = {
  IT: "🇮🇹", FR: "🇫🇷", ES: "🇪🇸", BE: "🇧🇪", NL: "🇳🇱",
  DE: "🇩🇪", CH: "🇨🇭", GB: "🇬🇧", US: "🇺🇸", AU: "🇦🇺",
  AT: "🇦🇹", PT: "🇵🇹", DK: "🇩🇰", NO: "🇳🇴", SE: "🇸🇪",
  PL: "🇵🇱", SI: "🇸🇮", CO: "🇨🇴", CA: "🇨🇦", JP: "🇯🇵",
};

function formatDate(start: string, end: string | null): string {
  const pad = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const s = new Date(start);
  if (!end || start === end) return pad(s);
  const e = new Date(end);
  return `${pad(s)} → ${pad(e)}`;
}

interface RaceCardProps {
  race: Race;
  striped?: boolean;
}

export function RaceCard({ race, striped = false }: RaceCardProps) {
  const flag = NATION_FLAGS[race.nation ?? ""] ?? "🏁";
  const slug = race.raceUrl.replace(/^race\//, "");
  const isMen = race.gender === "ME";
  const isWomen = race.gender === "WE";

  return (
    <Link href={`/races/${slug}`}>
      <div
        className={cn(
          "p-4 hover:bg-[#ffff00]/10 transition-colors",
          striped ? "bg-[#ffff00]/5" : "bg-transparent"
        )}
      >
        {/* Date row */}
        <div className="flex justify-between items-start mb-2">
          <span className="flex items-center gap-1 text-[#ffff00] font-bold text-sm">
            {formatDate(race.startDate ?? "", race.endDate)}
          </span>
          <div className="flex gap-1">
            {race.isFuture && (
              <span className="bg-green-600 text-white tech-label px-2 py-0.5">
                Upcoming
              </span>
            )}
            {isMen && (
              <span className="bg-blue-600 text-white tech-label px-2 py-0.5">
                Men Elite
              </span>
            )}
            {isWomen && (
              <span className="bg-pink-600 text-white tech-label px-2 py-0.5">
                Women Elite
              </span>
            )}
          </div>
        </div>

        {/* Flag + Name */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{flag}</span>
          <h3 className="kinetic-italic text-xl leading-tight">{race.name}</h3>
        </div>

        {/* UCI class + CTA */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {race.uciClass && (
              <span className="border border-[#484831] text-[#cac8aa] tech-label px-2 py-0.5">
                UCI Class: {race.uciClass}
              </span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-[#ffff00] tech-label hover:underline">
            VIEW DETAILS →
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3.2 — Rewrite race-filters.tsx**

The filter row is now a single yellow "FILTER RACES" CTA that opens a drawer/sheet with the same selects. For now, keep selects visible inline but style them with Velocity Neon:

```tsx
// components/races/race-filters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function RaceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/races?${params.toString()}`);
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 bg-[#ffff00] text-black font-black py-3 tech-label text-sm hover:bg-[#cdcd00] transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        FILTER RACES
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 mt-2 p-3 bg-[#202013] border border-[#484831]">
          <Select
            defaultValue={searchParams.get("year") ?? String(currentYear)}
            onValueChange={(v) => setParam("year", v)}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-[#f8f8f5]">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            defaultValue={searchParams.get("level") ?? "all"}
            onValueChange={(v) => setParam("level", v)}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[100px]">
              <SelectValue placeholder="Livello" />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              <SelectItem value="all" className="text-[#f8f8f5]">Tutti i livelli</SelectItem>
              <SelectItem value="1" className="text-[#f8f8f5]">UCI 1</SelectItem>
              <SelectItem value="2" className="text-[#f8f8f5]">UCI 2</SelectItem>
              <SelectItem value="3" className="text-[#f8f8f5]">UCI 3</SelectItem>
              <SelectItem value="4" className="text-[#f8f8f5]">UCI 4</SelectItem>
            </SelectContent>
          </Select>

          <Select
            defaultValue={searchParams.get("gender") ?? "all"}
            onValueChange={(v) => setParam("gender", v)}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[90px]">
              <SelectValue placeholder="Genere" />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              <SelectItem value="all" className="text-[#f8f8f5]">Tutti</SelectItem>
              <SelectItem value="ME" className="text-[#f8f8f5]">Elite Uomini</SelectItem>
              <SelectItem value="WE" className="text-[#f8f8f5]">Elite Donne</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.3 — Rewrite races/page.tsx**

```tsx
// app/(app)/races/page.tsx
import { Suspense } from "react";
import { RaceCard } from "@/components/races/race-card";
import { RaceFilters } from "@/components/races/race-filters";
import { Skeleton } from "@/components/ui/skeleton";
import type { Race } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchRaces(
  searchParams: Record<string, string | string[] | undefined>
): Promise<Race[]> {
  const yearParam = searchParams.year;
  const year =
    typeof yearParam === "string" ? yearParam : String(new Date().getFullYear());
  const levelParam = searchParams.level;
  const level = typeof levelParam === "string" ? levelParam : undefined;
  const genderParam = searchParams.gender;
  const gender = typeof genderParam === "string" ? genderParam : undefined;

  const query = new URLSearchParams({
    year_from: year,
    year_to: year,
    max_pages_per_year: "3",
  });
  if (level && level !== "all") query.set("race_level", level);
  if (gender && gender !== "all") query.set("gender", gender);

  try {
    const res = await fetch(`${API_URL}/races?${query}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Race[]>;
  } catch {
    return [];
  }
}

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const year =
    typeof params.year === "string"
      ? params.year
      : String(new Date().getFullYear());
  const races = await fetchRaces(params);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="p-4 bg-[#202013]">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="tech-label text-[#ffff00] mb-1">World Tour {year}</p>
            <h2 className="kinetic-italic text-3xl text-[#f8f8f5]">
              {races.length} Races Found
            </h2>
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-11 w-full bg-[#2b2b1d]" />}>
          <RaceFilters />
        </Suspense>
      </div>

      {/* Race list */}
      {races.length === 0 ? (
        <div className="text-center py-16 text-[#cac8aa]">
          <p className="tech-label">Nessuna gara trovata.</p>
          <p className="text-xs mt-1 text-[#484831]">
            Prova a cambiare i filtri o controlla che il backend sia avviato.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#484831]">
          {races.map((race, i) => (
            <RaceCard key={race.raceUrl} race={race} striped={i % 2 === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.4 — Verify race calendar visually**

Navigate to `/races`. Confirm: dark olive background, kinetic "N RACES FOUND" headline, yellow "FILTER RACES" button, race cards with yellow dates, gender chips, "VIEW DETAILS →" links.

- [ ] **Step 3.5 — Commit**

```bash
git add components/races/race-card.tsx components/races/race-filters.tsx app/\(app\)/races/page.tsx
git commit -m "feat(ui): velocity neon race calendar — kinetic cards, yellow filter CTA"
```

---

## Task 4: Race Detail Page

**Files:**
- Modify: `app/(app)/races/[...slug]/page.tsx`

**Key visual changes (from `race_detail_mobile/screen.png`):**
- Hero banner: full-width image overlay with gradient, UCI badge (yellow solid), race name in huge kinetic-italic
- Tabs: yellow underline active, `tech-label` tab text
- Stage table: yellow stage numbers, sharp row borders
- Info grid: 2×2 cards in `bg-[#202013]`, classification card `bg-[#ffff00]/10 border-[#ffff00]/20`

- [ ] **Step 4.1 — Update race detail header and tabs styling**

The page is long. Only modify these sections in `app/(app)/races/[...slug]/page.tsx`:

1. The main container `<div className="max-w-2xl ...">` → change to `<div className="max-w-2xl mx-auto pb-8">`

2. Replace the header section (everything before `<Tabs>`) with:
```tsx
{/* Hero */}
<div className="relative w-full h-48 bg-[#202013] overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a0a] via-[#1a1a0a]/40 to-transparent z-10" />
  <div className="absolute bottom-4 left-4 right-4 z-20">
    <span className="inline-block bg-[#ffff00] text-black tech-label px-2 py-0.5 mb-2">
      {race.uciClass ?? "UCI"}
    </span>
    <h1 className="kinetic-italic text-3xl text-[#f8f8f5] leading-none">
      {race.name}
    </h1>
  </div>
</div>

{/* Meta grid */}
<div className="grid grid-cols-2 gap-2 p-4">
  <div className="bg-[#202013] border border-[#484831] p-3">
    <span className="tech-label text-[#cac8aa] block mb-1">Date</span>
    <span className="text-sm font-bold">
      {race.startDate} {race.endDate && race.endDate !== race.startDate ? `— ${race.endDate}` : ""}
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
```

3. Replace the `<TabsList>` classes:
```tsx
<TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
```

4. Replace each `<TabsTrigger>` class pattern:
```tsx
<TabsTrigger
  value="info"
  className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
>
  INFO
</TabsTrigger>
```
Apply this pattern to all four triggers (info, memories, community, watchlist), adjusting labels to: INFO, MEMORIE, COMMUNITY, WATCHLIST.

5. Write action button — replace the current Link for `/diary/new` with:
```tsx
<Link
  href={writeUrl}
  className="flex items-center gap-2 bg-[#ffff00] text-black tech-label px-3 py-1.5 hover:bg-[#cdcd00] transition-colors"
>
  + SCRIVI
</Link>
```

- [ ] **Step 4.2 — Commit**

```bash
git add "app/(app)/races/[...slug]/page.tsx"
git commit -m "feat(ui): velocity neon race detail — hero banner, yellow tabs, meta grid"
```

---

## Task 5: Diary Page

**Files:**
- Modify: `components/diary/diary-card.tsx`
- Modify: `components/diary/star-rating.tsx`
- Modify: `app/(app)/diary/page.tsx`

**Key visual changes (from `diary_list_mobile/screen.png`):**
- Year tabs: `tech-label` text, `border-b-2 border-[#ffff00]` active, no background change
- Cards: left `border-l-4 border-[#ffff00]` for public entries, `border-[#484831]` for private; background `bg-[#202013]`
- Card header: date (tech-label, blue for public), public/private badge
- Title: kinetic-italic
- Stars: yellow `#ffff00`
- Excerpt: italic, muted, 2 lines
- "NEW ENTRY" button: solid yellow, top-right of header
- Star rating: ensure `text-[#ffff00]` for filled (not text-yellow-400)

- [ ] **Step 5.1 — Update star-rating.tsx**

Change filled star color from `text-yellow-400` to `text-[#ffff00]`:

```tsx
// components/diary/star-rating.tsx
// Change line: filled ? "text-yellow-400" : "text-zinc-600",
// To:          filled ? "text-[#ffff00]" : "text-[#484831]",
// And:         !readonly && "cursor-pointer hover:text-yellow-300"
// To:          !readonly && "cursor-pointer hover:text-[#cdcd00]"
```

Full file:
```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "text-sm", md: "text-xl", lg: "text-4xl" };

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover ?? value ?? 0) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(null)}
            className={cn(
              sizes[size],
              "transition-colors",
              filled ? "text-[#ffff00]" : "text-[#484831]",
              !readonly && "cursor-pointer hover:text-[#cdcd00]"
            )}
          >
            &#9733;
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5.2 — Rewrite diary-card.tsx**

`DiaryEntry` has `createdAt: string` and `raceYear: number` but no `raceDate` field — use `createdAt` for the date display.

```tsx
// components/diary/diary-card.tsx
import Link from "next/link";
import { StarRating } from "@/components/diary/star-rating";
import type { DiaryEntry } from "@/types/api";

interface DiaryCardProps {
  entry: DiaryEntry;
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
}

export function DiaryCard({ entry }: DiaryCardProps) {
  const bodyText = entry.body.replace(/<[^>]+>/g, "");
  const date = entry.createdAt;  // DiaryEntry has createdAt, not raceDate

  return (
    <Link href={`/diary/${entry.id}`}>
      <div
        className={`bg-[#202013] p-4 border-l-4 hover:bg-[#2b2b1d] transition-colors ${
          entry.isPublic ? "border-[#ffff00]" : "border-[#484831]"
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <span className={`tech-label text-[9px] ${entry.isPublic ? "text-blue-400" : "text-[#cac8aa]"}`}>
            {formatEntryDate(date)}
          </span>
          <span
            className={`tech-label text-[9px] px-2 py-0.5 ${
              entry.isPublic
                ? "bg-blue-500/10 text-blue-400"
                : "bg-[#2b2b1d] text-[#cac8aa]"
            }`}
          >
            {entry.isPublic ? "PUBLIC" : "PRIVATE"}
          </span>
        </div>

        <h3 className="kinetic-italic text-lg text-[#f8f8f5] mb-2 leading-tight">
          {entry.raceName}
        </h3>

        {entry.rating !== null && (
          <div className="mb-2">
            <StarRating value={entry.rating} readonly size="sm" />
          </div>
        )}

        {bodyText && (
          <p className="text-[#cac8aa] text-sm line-clamp-2 italic">
            &ldquo;{bodyText}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 5.3 — Rewrite diary/page.tsx**

```tsx
// app/(app)/diary/page.tsx
import { createClient } from "@/lib/supabase/server";
import { DiaryCard } from "@/components/diary/diary-card";
import Link from "next/link";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchDiary(jwt: string, year?: number): Promise<DiaryEntry[]> {
  const query = year ? `?year=${year}` : "";
  try {
    const res = await fetch(`${API_URL}/diary${query}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const activeYear = Number(params.year ?? currentYear);

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const entries = await fetchDiary(session.access_token, activeYear);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Diary</h1>
        <Link
          href="/diary/new"
          className="bg-[#ffff00] text-black tech-label px-3 py-1.5 hover:bg-[#cdcd00] transition-colors"
        >
          NEW ENTRY
        </Link>
      </div>

      {/* Year tabs */}
      <nav className="flex bg-[#1a1a0a] border-b border-[#484831]">
        {YEARS.map((y) => (
          <Link
            key={y}
            href={`/diary?year=${y}`}
            className={`flex-1 text-center py-3 tech-label transition-colors ${
              y === activeYear
                ? "border-b-2 border-[#ffff00] text-[#ffff00]"
                : "text-[#cac8aa] opacity-60 hover:opacity-100"
            }`}
          >
            {y}
          </Link>
        ))}
      </nav>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-6 px-4">
          <div className="w-20 h-20 bg-[#202013] flex items-center justify-center border-2 border-dashed border-[#484831]">
            <span className="text-3xl">📓</span>
          </div>
          <div>
            <h2 className="kinetic-italic text-2xl text-[#f8f8f5]">
              Inizia il tuo diario
            </h2>
            <p className="text-[#cac8aa] mt-2 text-sm">
              Nessuna recensione per il {activeYear}.
            </p>
          </div>
          <Link
            href="/diary/new"
            className="bg-[#ffff00] text-black font-black px-8 py-3 tech-label hover:bg-[#cdcd00] transition-colors"
          >
            SCRIVI PRIMA RECENSIONE
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[#484831]">
          {entries.map((entry) => (
            <DiaryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5.4 — Verify diary page visually**

Navigate to `/diary`. Confirm: sticky kinetic header with NEW ENTRY button, year tabs with yellow active border, cards with left yellow/muted border.

- [ ] **Step 5.5 — Commit**

```bash
git add components/diary/diary-card.tsx components/diary/star-rating.tsx app/\(app\)/diary/page.tsx
git commit -m "feat(ui): velocity neon diary — timeline cards, kinetic title, yellow stars"
```

---

## Task 6: Community Feed

**Files:**
- Modify: `components/community/community-card.tsx`
- Modify: `app/(app)/community/page.tsx`

**Key visual changes (from `community_feed_public_reviews/screen.png`):**
- Header: kinetic "COMMUNITY FEED" with glass nav, yellow border-b-2
- Sort chips: yellow fill + black text for active, `bg-[#2b2b1d] border border-[#484831]` for inactive
- Cards: sharp borders `border border-[#484831]`, user name in kinetic-italic, race name in `text-[#ffff00]` kinetic-italic large, excerpt italic muted
- Like button: yellow when liked, heart icon

- [ ] **Step 6.1 — Add `authorName` to `DiaryEntry` type, then rewrite community-card.tsx**

First, add the optional field to `types/api.ts` so community reviews can display author names returned by the backend:

```ts
// types/api.ts — inside DiaryEntry interface, after commentCount:
  authorName?: string;   // populated by /community/feed endpoint
```

Then rewrite the card:

```tsx
// components/community/community-card.tsx
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { StarRating } from "@/components/diary/star-rating";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { DiaryEntry } from "@/types/api";

interface CommunityCardProps {
  review: DiaryEntry;
}

export function CommunityCard({ review }: CommunityCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const bodyText = review.body.replace(/<[^>]+>/g, "");

  const handleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1));

    try {
      const res = await apiFetch<{ liked: boolean; count: number }>(
        `/diary/${review.id}/like`,
        { method: "POST" }
      );
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => (nextLiked ? c - 1 : c + 1));
      toast.error("Errore nel like. Riprova.");
    }
  };

  return (
    <div className="bg-[#202013] border border-[#484831] p-4 space-y-3">
      {/* User row */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#2b2b1d] border border-[#ffff00] flex items-center justify-center text-sm font-black text-[#ffff00]">
          {review.authorName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="kinetic-italic text-sm text-[#f8f8f5]">
            {review.authorName ?? "Utente"}
          </p>
          <p className="tech-label text-[8px] text-[#cac8aa]">
            {review.raceYear}
          </p>
        </div>
        {review.rating !== null && (
          <div className="ml-auto">
            <StarRating value={review.rating} readonly size="sm" />
          </div>
        )}
      </div>

      {/* Race name */}
      <h3 className="kinetic-italic text-lg text-[#ffff00] leading-tight">
        {review.raceName}
      </h3>

      {/* Excerpt */}
      {bodyText && (
        <p className="text-[#cac8aa] text-sm line-clamp-3 italic">
          &ldquo;{bodyText}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? "text-[#ffff00]" : "text-[#cac8aa] hover:text-[#f8f8f5]"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#ffff00]" : ""}`} />
          <span className="tech-label">{likeCount}</span>
        </button>
        <span className="flex items-center gap-1.5 text-xs text-[#cac8aa]">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tech-label">{review.commentCount}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2 — Rewrite community/page.tsx**

```tsx
// app/(app)/community/page.tsx
import Link from "next/link";
import { CommunityCard } from "@/components/community/community-card";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SortOption = "recent" | "popular" | "hot";

async function fetchFeed(sort: SortOption): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(`${API_URL}/community/feed?sort=${sort}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: "RECENTI",
  popular: "POPOLARI",
  hot: "HOT",
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) ?? "recent";
  const reviews = await fetchFeed(sort);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Community Feed</h1>
      </div>

      {/* Sort chips */}
      <div className="flex gap-2 p-4 bg-[#1c1c0f] overflow-x-auto">
        {(["recent", "popular", "hot"] as const).map((s) => (
          <Link
            key={s}
            href={`/community?sort=${s}`}
            className={`flex h-8 shrink-0 items-center justify-center px-4 tech-label transition-colors ${
              sort === s
                ? "bg-[#ffff00] text-black"
                : "bg-[#2b2b1d] border border-[#484831] text-[#f8f8f5] hover:bg-[#363527]"
            }`}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Feed */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="tech-label text-[#cac8aa]">Nessuna recensione pubblica ancora.</p>
          <p className="text-xs mt-1 text-[#484831]">Sii il primo a condividere la tua!</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {reviews.map((review) => (
            <CommunityCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.3 — Verify community feed visually**

Navigate to `/community`. Confirm: kinetic header, yellow active sort chip, cards with sharp borders and kinetic yellow race names.

- [ ] **Step 6.4 — Commit**

```bash
git add components/community/community-card.tsx app/\(app\)/community/page.tsx
git commit -m "feat(ui): velocity neon community feed — sort chips, kinetic cards"
```

---

## Task 7: Profile Page

**Files:**
- Modify: `app/(app)/profile/page.tsx`

**Key visual changes (from `profile_watchlist_mobile/screen.png`):**
- User avatar: sharp border `border-2 border-[#ffff00]`, initials in yellow on dark
- Username: kinetic-italic uppercase
- "@handle" in yellow tech-label
- Stats: 2-col grid with yellow left-border divider, large numbers, tech-label labels
- Sections "WATCHLIST" and "CALENDAR FEEDS": kinetic-italic headings
- Watchlist item: date badge in `bg-[#202013]`, star icon in yellow, race name kinetic
- Calendar feeds: dark input, solid yellow COPY button
- Sign out: `border-2 border-[#ef4444] text-[#ef4444]` outline button, kinetic-italic label

- [ ] **Step 7.1 — Rewrite profile/page.tsx**

```tsx
// app/(app)/profile/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CopyButton } from "./copy-button";
import type { UserProfile, WatchlistItem, CalendarFilter } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProfile(jwt: string): Promise<UserProfile | null> {
  const res = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchWatchlist(jwt: string): Promise<WatchlistItem[]> {
  const res = await fetch(`${API_URL}/watchlist`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCalendarFeeds(jwt: string): Promise<CalendarFilter[]> {
  const res = await fetch(`${API_URL}/calendar/filters`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const jwt = session.access_token;
  const [profile, watchlist, calendarFeeds] = await Promise.all([
    fetchProfile(jwt),
    fetchWatchlist(jwt),
    fetchCalendarFeeds(jwt),
  ]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const handle =
    session.user.email?.split("@")[0]?.replace(/\W/g, "_").toLowerCase() ?? "user";

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Profilo</h1>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center py-8 gap-3">
        <div className="w-20 h-20 border-2 border-[#ffff00] bg-[#202013] flex items-center justify-center text-3xl font-black text-[#ffff00]">
          {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="text-center">
          <p className="kinetic-italic text-2xl text-[#f8f8f5]">
            {profile?.displayName ?? "Rider"}
          </p>
          <p className="tech-label text-[#ffff00]">@{handle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-0 border-y border-[#484831] mx-4 mb-6">
        <div className="p-4 text-center border-r border-[#ffff00]">
          <p className="text-3xl font-black font-mono text-[#f8f8f5]">
            {profile?.totalReviews ?? 0}
          </p>
          <p className="tech-label text-[#cac8aa] mt-0.5">REVIEWS</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-3xl font-black font-mono text-[#f8f8f5]">
            {profile?.racesFollowed ?? 0}
          </p>
          <p className="tech-label text-[#cac8aa] mt-0.5">FOLLOWED</p>
        </div>
      </div>

      {/* Watchlist */}
      <div className="px-4 mb-6">
        <h2 className="kinetic-italic text-xl text-[#f8f8f5] mb-3">Watchlist</h2>
        {watchlist.length === 0 ? (
          <p className="tech-label text-[#484831]">Nessuna gara seguita.</p>
        ) : (
          <div className="space-y-2">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="bg-[#202013] border border-[#484831] flex items-center justify-between p-3"
              >
                {item.raceDate && (
                  <div className="bg-[#2b2b1d] border border-[#484831] p-2 text-center min-w-[44px] mr-3">
                    <p className="tech-label text-[#ffff00] text-[10px] leading-tight">
                      {new Date(item.raceDate).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="font-black text-[#f8f8f5] text-lg leading-none">
                      {new Date(item.raceDate).getDate()}
                    </p>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="kinetic-italic text-sm text-[#f8f8f5] leading-tight truncate">
                    {item.raceName}
                  </p>
                  {/* WatchlistItem has raceUrl and raceDate — no distance field */}
                </div>
                <span className="text-[#ffff00] text-lg ml-2">★</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar feeds */}
      <div className="px-4 mb-8">
        <h2 className="kinetic-italic text-xl text-[#f8f8f5] mb-3">Calendar Feeds</h2>
        {calendarFeeds.length === 0 ? (
          <p className="tech-label text-[#484831]">Nessun feed configurato.</p>
        ) : (
          <div className="space-y-2">
            {calendarFeeds.map((feed) => {
              const icsUrl = `${apiBase}/calendar/feed/${feed.subscriptionToken}.ics`;
              return (
                <div
                  key={feed.id}
                  className="bg-[#202013] border border-[#484831] p-3"
                >
                  <p className="tech-label text-[#f8f8f5] mb-2">{feed.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[#484831] truncate flex-1 font-mono">
                      {icsUrl}
                    </p>
                    <CopyButton text={icsUrl} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-4">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full border-2 border-[#ef4444] text-[#ef4444] py-4 kinetic-italic text-lg hover:bg-[#ef4444] hover:text-black transition-colors flex items-center justify-center gap-2"
          >
            → ESCI DALL&apos;ACCOUNT
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2 — Update CopyButton styling to match Velocity Neon**

In `app/(app)/profile/copy-button.tsx`, change the button class from the current zinc styling to:
```tsx
className="bg-[#ffff00] text-black tech-label px-3 py-1.5 shrink-0 hover:bg-[#cdcd00] transition-colors"
```

- [ ] **Step 7.3 — Commit**

```bash
git add app/\(app\)/profile/page.tsx app/\(app\)/profile/copy-button.tsx
git commit -m "feat(ui): velocity neon profile — stats grid, watchlist, kinetic sign-out"
```

---

## Task 8: Review Editor

**Files:**
- Modify: `components/diary/review-editor.tsx`
- Modify: `app/(app)/diary/new/page.tsx`

**Key visual changes (from `review_editor_mobile/screen.png`):**
- Page header: "SCRIVI / RECENSIONE" kinetic two-line title, race name badge (right side, dark box with small text)
- Star rating: `size="lg"` with rating label below ("ECCELLENTE", "BUONO", etc.) in yellow kinetic-italic
- Tiptap editor: `bg-[#202013] border border-[#484831]` container, toolbar with sharp buttons
- Technical details section: `border-l-2 border-[#ffff00]` heading `tech-label`
- Inputs: `border-b border-[#484831]` underline style, no box
- Emotion pills: yellow border + bg when selected, outlined when not
- Privacy toggle row: dark container, yellow toggle when on
- Submit CTA: full-width solid yellow `kinetic-italic text-xl`, "SALVA RECENSIONE →"
- Footer strip: autosave status in `tech-label`

- [ ] **Step 8.1 — Update review-editor.tsx emotion fields and submit button**

This component is long. Make targeted changes:

1. Change all `text-[#E91E8C]` → `text-[#ffff00]` and `bg-[#E91E8C]` → `bg-[#ffff00]`

2. Replace the `<Button onClick={handleSave}>` (or equivalent) at the bottom with a `type="button"` element — the component uses an explicit `handleSave` callback, not form submission:
```tsx
<button
  type="button"
  onClick={handleSave}
  disabled={saving || !rating}
  className="w-full bg-[#ffff00] text-black py-4 kinetic-italic text-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#cdcd00] transition-colors flex items-center justify-center gap-2"
>
  {saving ? "SALVATAGGIO..." : "SALVA RECENSIONE →"}
</button>
```

3. Add emotion chips — replace the `dominantEmotion` `<Input>` field with:
```tsx
{/* Dominant emotion chips */}
<div>
  <Label className="tech-label text-[9px] text-[#cac8aa] block mb-2">
    EMOZIONE DOMINANTE
  </Label>
  <div className="flex flex-wrap gap-2">
    {["Adrenalina", "Tensione", "Sorpresa", "Fatica", "Gioia", "Tristezza"].map((emotion) => (
      <button
        key={emotion}
        type="button"
        onClick={() =>
          setDominantEmotion(dominantEmotion === emotion ? "" : emotion)
        }
        className={`px-3 py-1 tech-label text-[9px] border transition-colors ${
          dominantEmotion === emotion
            ? "border-[#ffff00] text-[#ffff00] bg-[#ffff00]/10"
            : "border-[#484831] text-[#cac8aa] hover:border-[#ffff00]/50"
        }`}
      >
        {emotion.toUpperCase()}
      </button>
    ))}
  </div>
</div>
```

4. Update input field styling from `bg-zinc-900 border-zinc-700` → `bg-[#202013] border-[#484831]` throughout.

5. Update the privacy toggle row container:
```tsx
<div className="flex items-center justify-between bg-[#202013] border border-[#484831] p-4">
  ...
</div>
```

6. Update the Tiptap mention class from `text-[#E91E8C]` → `text-[#ffff00]` in the `Mention.configure` call.

- [ ] **Step 8.2 — Update new/page.tsx header**

```tsx
// app/(app)/diary/new/page.tsx
import { ReviewEditor } from "@/components/diary/review-editor";

export default async function NewDiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const raceUrl = params.race_url;
  const raceName = params.race_name;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <p className="tech-label text-[#cac8aa] text-[9px]">REVIEW EDITOR</p>
          <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-tight">
            Scrivi
            <br />
            Recensione
          </h1>
        </div>
        {raceName && (
          <div className="bg-[#202013] border border-[#484831] px-3 py-2 text-right max-w-[120px]">
            <p className="tech-label text-[#cac8aa] text-[9px]">RACE</p>
            <p className="text-xs font-bold text-[#f8f8f5] leading-tight line-clamp-2">
              {raceName}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 pt-6">
        <ReviewEditor raceUrl={raceUrl} raceName={raceName} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8.3 — Verify editor visually**

Navigate to `/diary/new`. Confirm: kinetic header with race badge, large yellow stars, emotion chips, yellow submit button.

- [ ] **Step 8.4 — Commit**

```bash
git add components/diary/review-editor.tsx app/\(app\)/diary/new/page.tsx
git commit -m "feat(ui): velocity neon review editor — emotion chips, yellow CTA, sharp inputs"
```

---

## Task 9: App Shell, Auth Pages & Remaining Components

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(auth)/layout.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`
- Modify: `app/share/[token]/page.tsx`
- Modify: `components/races/watchlist-toggle.tsx`
- Modify: `components/community/comment-thread.tsx`
- Modify: `app/(app)/diary/[id]/share-button.tsx`

**Key changes:**
- App shell `<div className="flex min-h-screen bg-[#09090b]">` → `bg-[#1a1a0a]`
- Auth pages: magenta `#E91E8C` buttons → `bg-[#ffff00] text-black`; brand text → `text-[#ffff00]`
- Share page: brand logo and CTA magenta → yellow
- WatchlistToggle: active "in watchlist" state from magenta → yellow
- CommentThread: submit button `bg-[#E91E8C]` → `bg-[#ffff00] text-black`

- [ ] **Step 9.1 — Fix app shell background**

In `app/(app)/layout.tsx`, change the wrapper div class:
```tsx
// Before:
<div className="flex min-h-screen bg-[#09090b]">
// After:
<div className="flex min-h-screen bg-[#1a1a0a]">
```

- [ ] **Step 9.2 — Update auth layout branding**

In `app/(auth)/layout.tsx`, replace any `text-[#E91E8C]` or `text-[#c4186f]` brand accent with `text-[#ffff00]`. Update the background from any zinc/dark value to `bg-[#1a1a0a]`. Update the CycleTracker logo span to use `kinetic-italic` with `text-[#ffff00]` for the "Tracker" part.

- [ ] **Step 9.3 — Update login and signup pages**

In both `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx`:

1. Replace the primary submit `<Button>` styling:
```tsx
// Replace className containing #E91E8C / magenta with:
className="w-full bg-[#ffff00] text-black font-black py-2.5 hover:bg-[#cdcd00] transition-colors rounded-none"
```

2. Replace any link `text-[#E91E8C]` → `text-[#ffff00]`

3. Update input field styling: `border-zinc-700 bg-zinc-900` → `border-[#484831] bg-[#202013]`

4. Update form container background: `bg-zinc-900` → `bg-[#202013]`

- [ ] **Step 9.4 — Update share page**

In `app/share/[token]/page.tsx`, replace `#E91E8C` brand/CTA colors with `#ffff00` (text: `text-[#ffff00]`, buttons: `bg-[#ffff00] text-black`).

- [ ] **Step 9.5 — Update watchlist toggle**

In `components/races/watchlist-toggle.tsx`, find the "in watchlist" active state button. Replace any magenta color with yellow:
```tsx
// Active state (inWatchlist === true):
className="... text-[#ffff00] border-[#ffff00] ..."  // was: text-[#E91E8C] border-[#E91E8C]
```

- [ ] **Step 9.6 — Update comment thread**

In `components/community/comment-thread.tsx`, replace all submit/action button styling from magenta to yellow:
```tsx
// Replace: bg-[#E91E8C] hover:bg-[#c4186f]
// With:    bg-[#ffff00] hover:bg-[#cdcd00] text-black
```

- [ ] **Step 9.7 — Update diary share button**

In `app/(app)/diary/[id]/share-button.tsx`, replace magenta icon/button color with yellow.

- [ ] **Step 9.8 — Commit**

```bash
git add app/\(app\)/layout.tsx app/\(auth\)/ app/share/ components/races/watchlist-toggle.tsx components/community/comment-thread.tsx app/\(app\)/diary/\[id\]/share-button.tsx
git commit -m "feat(ui): velocity neon — auth pages, app shell, watchlist toggle, comment thread"
```

---

## Task 10: Diary Entry Detail & Edit Pages

**Files:**
- Modify: `app/(app)/diary/[id]/page.tsx`
- Modify: `app/(app)/diary/[id]/edit/page.tsx`

**Key changes:** Replace all `zinc-*` and `#18181b` card styling with Velocity Neon equivalents; apply kinetic header.

- [ ] **Step 10.1 — Update diary entry detail page**

In `app/(app)/diary/[id]/page.tsx`, apply these changes:

1. Replace outer container:
```tsx
// Before: <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
// After:
<div className="max-w-2xl mx-auto pb-8">
```

2. Replace the header section with a sticky kinetic header:
```tsx
<div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
  <div>
    <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-tight">{entry.raceName}</h1>
    <p className="tech-label text-[#cac8aa] text-[9px]">{entry.raceYear}</p>
  </div>
  <div className="flex gap-2">
    {isOwner && (
      <Link
        href={`/diary/${id}/edit`}
        className="flex items-center justify-center w-8 h-8 border border-[#484831] text-[#cac8aa] hover:text-[#f8f8f5] hover:border-[#ffff00] transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Link>
    )}
    <ShareButton entry={entry} />
  </div>
</div>
```

3. In the main content area (inside `<div className="px-4 pt-6 space-y-6">`):

   - Replace all `bg-zinc-900 rounded-xl` → `bg-[#202013]`
   - Replace `border border-zinc-800` → `border border-[#484831]`
   - Replace `text-zinc-50` → `text-[#f8f8f5]`
   - Replace `text-zinc-400`, `text-zinc-500` → `text-[#cac8aa]`
   - Replace `text-yellow-400` (stars) — already handled by updated `StarRating` component
   - Badge classes: replace `border-zinc-700 text-zinc-400` → `border-[#484831] text-[#cac8aa]`
   - Public badge: replace `bg-emerald-500/20 text-emerald-400` → `bg-blue-500/10 text-blue-400 tech-label`

4. Key moment / protagonist / emotion section — wrap each in `bg-[#202013] border border-[#484831] p-3`:
```tsx
<div className="bg-[#202013] border border-[#484831] p-3">
  <p className="tech-label text-[#cac8aa] text-[9px] mb-1">MOMENTO CHIAVE</p>
  <p className="text-sm text-[#f8f8f5]">{entry.keyMoment}</p>
</div>
```

- [ ] **Step 10.2 — Update diary edit page**

In `app/(app)/diary/[id]/edit/page.tsx`, update the page header:
```tsx
// Before: <h1 className="text-xl font-bold text-zinc-50 mb-6">Modifica recensione</h1>
// After:
<div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10 mb-6">
  <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Modifica Recensione</h1>
</div>
```

- [ ] **Step 10.3 — Commit**

```bash
git add "app/(app)/diary/[id]/page.tsx" "app/(app)/diary/[id]/edit/page.tsx"
git commit -m "feat(ui): velocity neon diary detail and edit pages"
```

---

## Task 11: Final Polish & Build Check

- [ ] **Step 11.1 — Verify no remaining magenta (#E91E8C) references**

```bash
grep -r "E91E8C\|c4186f" \
  /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend/app \
  /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend/components \
  --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: no output. If any hits remain, replace with `#ffff00` / `#cdcd00`.

- [ ] **Step 11.2 — Verify no remaining zinc/old-dark hardcoded colors**

```bash
grep -r "bg-zinc\|text-zinc\|border-zinc\|bg-\[#09090b\]\|bg-\[#18181b\]" \
  /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend/app \
  /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend/components \
  --include="*.tsx"
```

Mapping for any hits:
- `bg-zinc-950` / `bg-[#09090b]` → `bg-[#1a1a0a]`
- `bg-zinc-900` / `bg-[#18181b]` → `bg-[#202013]`
- `bg-zinc-800` / `bg-[#27272a]` → `bg-[#2b2b1d]`
- `border-zinc-800` → `border-[#484831]`
- `text-zinc-50` / `text-zinc-100` → `text-[#f8f8f5]`
- `text-zinc-400` / `text-zinc-500` → `text-[#cac8aa]`

- [ ] **Step 11.3 — Production build check**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend
npm run build 2>&1 | tail -30
```

Expected: build completes with `Route (app)` output and zero TypeScript errors.

- [ ] **Step 11.4 — Commit final polish**

```bash
git add -A
git commit -m "feat(ui): velocity neon — final color sweep, build verified"
```

---

## Summary

| Task | Changes | Commits |
|------|---------|---------|
| 1 — Design tokens | `globals.css`, `layout.tsx` | 1 |
| 2 — Navigation | `bottom-nav.tsx`, `sidebar.tsx` | 1 |
| 3 — Race calendar | `race-card.tsx`, `race-filters.tsx`, `races/page.tsx` | 1 |
| 4 — Race detail | `races/[...slug]/page.tsx` | 1 |
| 5 — Diary | `diary-card.tsx`, `star-rating.tsx`, `diary/page.tsx` | 1 |
| 6 — Community | `types/api.ts`, `community-card.tsx`, `community/page.tsx` | 1 |
| 7 — Profile | `profile/page.tsx`, `copy-button.tsx` | 1 |
| 8 — Review editor | `review-editor.tsx`, `diary/new/page.tsx` | 1 |
| 9 — App shell + auth + misc | `(app)/layout.tsx`, auth pages, share, watchlist-toggle, comment-thread | 1 |
| 10 — Diary detail/edit | `diary/[id]/page.tsx`, `diary/[id]/edit/page.tsx` | 1 |
| 11 — Final polish | Color sweep + build check | 1 |
