# Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repository into a monorepo with `backend/` (FastAPI) and `frontend/` (Next.js) subdirectories, with two separate Vercel projects pointing to each.

**Architecture:** All Python source files move to `backend/` using `git mv` to preserve history. A new Next.js 14+ app is scaffolded in `frontend/`. Root-level files (`docs/`, `README.md`, `.gitignore`, `CLAUDE.md`) stay at root.

**Tech Stack:** `git mv`, Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Geist fonts

---

## File Structure After Migration

```
fastApiExample/                        ← repo root
├── backend/                           ← moved from root
│   ├── main.py
│   ├── run.py
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── alembic/
│   ├── auth/
│   ├── demo/
│   ├── models/
│   ├── routers/
│   ├── scrapers/
│   ├── services/
│   ├── tasks/
│   └── tests/
├── frontend/                          ← new Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.ts
├── docs/                              ← stays at root
├── .gitignore                         ← updated
├── CLAUDE.md                          ← stays at root
└── README.md                          ← stays at root
```

---

### Task 1: Move backend files into `backend/`

**Files:**
- Create: `backend/` (via git mv)
- All Python source directories and root-level Python files

- [ ] **Step 1: Create the `backend/` directory and move all Python source**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample

mkdir backend

git mv main.py backend/main.py
git mv run.py backend/run.py
git mv alembic.ini backend/alembic.ini
git mv requirements.txt backend/requirements.txt
git mv pytest.ini backend/pytest.ini
git mv alembic backend/alembic
git mv auth backend/auth
git mv demo backend/demo
git mv models backend/models
git mv routers backend/routers
git mv scrapers backend/scrapers
git mv services backend/services
git mv tasks backend/tasks
git mv tests backend/tests
```

- [ ] **Step 2: Verify the moves look correct**

```bash
git status --short
```

Expected: all moved files show as `R  old/path -> backend/old/path`

- [ ] **Step 3: Commit the move**

```bash
git commit -m "refactor: move backend source into backend/ subdirectory"
```

---

### Task 2: Update `.gitignore` for monorepo layout

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add frontend ignores and verify backend venv paths**

Append to `.gitignore`:

```
# Frontend
frontend/.next/
frontend/node_modules/
frontend/.env*.local

# Backend DB files (if run locally from backend/)
backend/*.db
```

Also ensure these existing entries still work (they use root-relative patterns which now cover backend/ automatically):
- `.env` — still matches `backend/.env`
- `__pycache__/` — still matches recursively

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for monorepo layout"
```

---

### Task 3: Verify backend still works from its new location

**Files:**
- Read: `backend/models/database.py` (check dotenv path)
- Read: `backend/alembic.ini` (check script_location)

- [ ] **Step 1: Check `database.py` dotenv load path**

Open `backend/models/database.py`. Line 7:
```python
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
```
After move: `__file__` = `.../backend/models/database.py`, `parent.parent` = `.../backend/`. This is correct — `.env` should live in `backend/`.

Create `backend/.env` (if not already present, copy from root `.env`):
```bash
cp .env backend/.env 2>/dev/null || echo "No root .env to copy — create backend/.env manually with DATABASE_URL"
```

- [ ] **Step 2: Check `alembic.ini` path**

`script_location = %(here)s/alembic` — `%(here)s` resolves to the directory containing `alembic.ini`, which is now `backend/`. Correct.

- [ ] **Step 3: Run the backend from `backend/` to confirm startup**

> ⚠️ **Important:** Alembic commands must always be run from `backend/`, not from the repo root. The `alembic.ini` uses `prepend_sys_path = .`, which adds the directory containing `alembic.ini` to `sys.path`. After the move, that directory is `backend/`, so Python can resolve `from models.database import Base`. Running `alembic` from the repo root will fail with `ModuleNotFoundError`.

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/backend
source ../.venv-wsl/bin/activate  # adjust if venv is elsewhere
python run.py
```

Expected: server starts at `http://127.0.0.1:8000` with no import errors. Stop with Ctrl+C.

- [ ] **Step 4: Run tests from `backend/`**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/backend
pytest tests/ -q
```

Expected: same pass/fail as before the migration.

---

### Task 4: Update Vercel backend project root directory

This is a **manual step** in the Vercel dashboard.

- [ ] **Step 1: Update root directory in Vercel**

1. Go to Vercel Dashboard → your backend project (`cycletracker-api` or similar)
2. **Settings** → **General** → **Root Directory**
3. Change from `.` (or empty) to `backend`
4. Save

- [ ] **Step 2: Trigger a new deploy**

> ⚠️ **Push only after updating the Vercel dashboard.** Tasks 1 and 2 already created commits that are ahead of `origin`. If you push before changing the root directory in Vercel, the auto-deploy will look for `main.py` at the repo root, not find it, and the backend will go down. Complete Step 1 first.

Push the migration commit to GitHub:
```bash
git push origin main
```

Vercel will redeploy automatically. Verify `/health` returns `{"status": "ok"}`.

---

### Task 5: Scaffold the Next.js frontend

**Files:**
- Create: `frontend/` (via create-next-app)

- [ ] **Step 1: Scaffold Next.js with correct options**

Run from repo root:
```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample

npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

When prompted for any remaining options, choose defaults. This creates `frontend/` with App Router, TypeScript, Tailwind.

- [ ] **Step 1b: Verify the `dev` script does not include `--turbopack`**

Some versions of `create-next-app` add `--turbopack` to the dev script regardless of the flag. Check:

```bash
grep '"dev"' frontend/package.json
```

If it shows `"next dev --turbopack"`, remove `--turbopack`:
```bash
# Edit frontend/package.json manually: change to "next dev"
```

- [ ] **Step 2: Install shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Zinc**
- CSS variables: **Yes**

- [ ] **Step 3: Install Geist fonts and Lucide**

```bash
npm install geist lucide-react
```

- [ ] **Step 4: Configure Geist in `frontend/app/layout.tsx`**

Replace the contents with:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "CycleTracker",
  description: "Your personal cycling race diary",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

Note: CSS variables (`--font-geist-sans`, `--font-geist-mono`) go on `<html>`, not `<body>`.

- [ ] **Step 4b: Configure Tailwind to use Geist CSS variables**

In `frontend/tailwind.config.ts`, **add** to the existing `theme.extend` block only — do not replace the whole file (the `content` array and `plugins` from shadcn must be preserved):

```ts
// Add inside the existing theme.extend:
fontFamily: {
  sans: ["var(--font-geist-sans)"],
  mono: ["var(--font-geist-mono)"],
},
```

The final file should look like (keeping existing `content`, `plugins`, etc.):

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      // ... any other extends shadcn added
    },
  },
  plugins: [require("tailwindcss-animate")],  // shadcn adds this
};
export default config;
```

Do not delete the `content` array or `plugins` — Tailwind won't generate classes without `content`, and shadcn components will break without the animate plugin.

- [ ] **Step 5: Set dark theme colors in `frontend/app/globals.css`**

> ⚠️ Do **not** replace the whole `:root` block. `shadcn init` generates ~20 HSL variables (`--card`, `--popover`, `--muted`, `--border`, etc.) that shadcn components depend on. Only override the specific variables you want to change.

Find the existing `--primary` and `--background` lines inside the `:root` block (and `.dark` block if present) and update **only those values**:

```css
/* Inside the existing :root block — only change these lines: */
--background: 240 10% 3.9%;       /* zinc-950 */
--foreground: 0 0% 98%;           /* zinc-50 */
--primary: 322 88% 51%;           /* #E91E8C magenta */
--primary-foreground: 0 0% 100%;
```

Leave all other generated variables (`--card`, `--popover`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, etc.) untouched.

> Note: shadcn/ui uses HSL values. `#E91E8C` ≈ `hsl(322, 88%, 51%)`.

- [ ] **Step 6: Create `frontend/.env.local`**

```bash
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app
EOF
```

Fill in the real values from Supabase dashboard and Vercel backend URL.

- [ ] **Step 7: Verify frontend starts**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample/frontend
npm run dev
```

Open `http://localhost:3000`. Expected: default Next.js page renders without errors.

- [ ] **Step 8: Commit frontend scaffold**

```bash
cd /mnt/c/Users/Sergio/Documenti/Progetti/fastApiExample
git add frontend/
git commit -m "feat: scaffold Next.js frontend in frontend/ subdirectory"
```

---

### Task 6: Create Vercel frontend project

This is a **manual step** in the Vercel dashboard.

- [ ] **Step 1: Create new Vercel project for frontend**

1. Go to Vercel Dashboard → **Add New Project**
2. Import the same GitHub repo (`fastApiExample`)
3. **Root Directory**: set to `frontend`
4. Framework: **Next.js** (auto-detected)
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (the backend Vercel URL)
6. Deploy

- [ ] **Step 2: Verify deployment**

Visit the frontend Vercel URL. Expected: Next.js default page renders.

---

### Task 7: Update CLAUDE.md with new project structure

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect monorepo layout**

Add a section at the top of `CLAUDE.md`:

```markdown
## Monorepo Structure

This is a monorepo with two subdirectories:
- `backend/` — FastAPI Python API (deployed as Vercel project `cycletracker-api`)
- `frontend/` — Next.js TypeScript app (deployed as Vercel project `cycletracker-frontend`)
- `docs/` — Design specs and implementation plans

**Run backend:** `cd backend && python run.py`
**Run frontend:** `cd frontend && npm run dev`
**Run backend tests:** `cd backend && pytest tests/ -q`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for monorepo structure"
```

---

## Done

After Task 6, the monorepo is live:
- Backend: `https://cycletracker-api.vercel.app` (root dir: `backend/`)
- Frontend: `https://cycletracker-frontend.vercel.app` (root dir: `frontend/`)
- Both deploy automatically on push to `main`

Next: execute `2026-03-19-plan2b-smart-features-backend.md`
