# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a monorepo with two subdirectories:
- `backend/` — FastAPI Python API (deployed as Vercel project `cycletracker-api`)
- `frontend/` — Next.js TypeScript app (deployed as Vercel project `cycletracker-frontend`)
- `docs/` — Design specs and implementation plans

**Run backend:** `cd backend && python run.py`
**Run frontend:** `cd frontend && npm run dev`
**Run backend tests:** `cd backend && pytest tests/ -q`

> ⚠️ Alembic must always be run from `backend/`, not from the repo root.

## Project Overview

This is a FastAPI application that scrapes cycling race data from ProCyclingStats (PCS). It provides a REST API to query races with various filters (year, month, gender, race level, nation).

## Development Commands

**Run the development server:**
```bash
python run.py
```
The server starts at `http://127.0.0.1:8000` with auto-reload enabled.

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Test the API:**
- Health check: `curl http://localhost:8000/health`
- List races: `curl "http://localhost:8000/races?year_from=2024&year_to=2024"`

## Architecture

### Entry Points
- `run.py` - Development server entry point (runs uvicorn with reload)
- `main.py` - FastAPI application definition and route handlers

### Project Structure
- `main.py` - FastAPI app with a single `/races` endpoint that accepts filtering query parameters
- `scrapers/races_scraper.py` - Core scraping logic using the `procyclingstats` library
- `models/race.py` - Pydantic `RaceModel` (note: there's a duplicate in `scrapers/races_scraper.py`)

### Key Dependencies
- `fastapi` + `uvicorn` - Web framework
- `procyclingstats` - Third-party scraper library for PCS
- `beautifulsoup4` - HTML parsing
- `playwright` + `playwright-stealth` - Browser automation (in requirements but unused in current code)
- `pydantic` - Data validation

### Scraping Architecture

The `RacesList` class extends `procyclingstats.Scraper` and parses HTML tables from PCS race list pages. It extracts:
- Race dates (start/end for stage races)
- Race name and URL
- Nation (from flag CSS classes)
- UCI classification
- Gender category
- Startlist URL

The `fetch_races()` function handles pagination across multiple years and pages, with rate limiting via `time.sleep()` delays between requests.

### API Parameters

The `/races` endpoint supports:
- `year_from`/`year_to` - Year range (1900 to current year + 1)
- `only_future` - Filter to future (true) or past (false) races
- `month` - Filter by month (1-12)
- `gender` - 'ME' (men elite) or 'WE' (women elite)
- `race_level` - Race level 1-4
- `nation` - ISO country code (e.g., 'IT', 'FR')
- `max_pages_per_year` - Pagination limit (1-10, default 3)

### Data Flow

1. Client requests `/races` with filters
2. `main.py` validates parameters and calls `fetch_races()`
3. `fetch_races()` builds PCS URLs with `_build_url()` using gender→category mapping
4. `RacesList` scraper fetches and parses HTML tables
5. `_build_race_model()` converts raw data to `RaceModel` with `is_future` flag
6. Results are returned as JSON list

### Notes

- There are two copies of `RaceModel`: one in `models/race.py` and another in `scrapers/races_scraper.py` (the scraper uses the local one)
- The scraper uses rate limiting: 0.5-1s between pages, 0.8-1.5s between years
- `only_future=False` filtering is done client-side since PCS doesn't support it natively
