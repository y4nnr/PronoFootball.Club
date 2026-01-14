# Rugby Season Detection - Generic Solution

## Overview

The season detection for Rugby competitions is now **generic** and works for any competition regardless of when their season starts/ends.

## How It Works

### 1. Data Collection
- Fetches recent games (last 20) and upcoming games (next 20) from the API
- Groups games by season year (from `game.league.season`)

### 2. Date Analysis
- For each season, extracts all game dates
- Determines **actual start date** = earliest game date
- Determines **actual end date** = latest game date
- No assumptions about specific months or dates

### 3. Season Selection
- **Current Season**: Season where current date falls between start and end dates
- **Future Season**: Season where start date is in the future (closest one)
- **Past Season**: Most recent past season (if no current/future)

### 4. Benefits
- ✅ Works for any competition (Top 14, Pro D2, Super Rugby, etc.)
- ✅ Handles different season calendars (September-June, January-December, etc.)
- ✅ Uses real data from API, not assumptions
- ✅ Automatically adapts to competition-specific schedules

## Example

### Top 14 (September - June)
- Games from Sep 2024 to Jun 2025 → Season 2024
- If current date is Jan 2025 → Season 2024 is current
- Start date: Sep 7, 2024 (first game)
- End date: Jun 28, 2025 (last game)

### Super Rugby (February - June)
- Games from Feb 2025 to Jun 2025 → Season 2025
- If current date is Mar 2025 → Season 2025 is current
- Start date: Feb 15, 2025 (first game)
- End date: Jun 20, 2025 (last game)

## Fallback Behavior

If no games are found:
- Returns `null`
- Import logic will use the requested season from the user
- User can manually specify the season they want to import

## Code Location

- **Main Logic**: `lib/api-rugby-v1.ts` → `getCurrentOrNextSeason()`
- **Import Logic**: `pages/api/admin/competitions/import.ts` → Uses detected season or falls back to requested season

