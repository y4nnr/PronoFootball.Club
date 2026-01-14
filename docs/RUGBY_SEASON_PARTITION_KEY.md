# Rugby Season Handling - Partition Key Logic

## Overview

In the Rugby API (API-Sports.io v1), `season` is **NOT** the calendar year of games. It is a **4-digit partition key** equal to the **START year** of the season.

### Example
- Season `2024` = 2024/25 season
- Games start: September 2024
- Games end: June 2025

## Implementation

### 1. Season Discovery

**Method**: `RugbyAPI.getCurrentOrNextSeason(competitionId)`

**Logic**:
1. Call `GET /seasons` to get candidate season keys (e.g., [2024, 2023, 2022, ...])
2. Sort descending and iterate through each season:
   - `GET /games?league={id}&season={year}&last=1` → record `lastGameDate` if results > 0
   - `GET /games?league={id}&season={year}&next=1` → record `nextGameDate` if results > 0
   - If either exists, season is "valid"
3. Choose the best season:
   - **Current season**: Where "now" is between `lastGameDate` and `nextGameDate` (if both exist)
   - **Most recent valid season**: If no current season found

**Important**: Never call `/games?league={id}&last=1` **without** a season parameter - it can return empty/null.

### 2. Season Caching

When a Rugby competition is imported:
- The discovered season partition key is stored in `Competition.externalSeason`
- This cached value is reused for all subsequent API calls

**Database Schema**:
```prisma
model Competition {
  // ... other fields
  externalSeason String? // For Rugby: cached season partition key (e.g., "2024")
}
```

### 3. Teams Fetching

**Method**: `RugbyAPI.getTeamsByCompetition(competitionId, season)`

**Always calls**:
```
GET /teams?league={leagueId}&season={cachedSeason}
```

**Error Handling**:
- If `response.length === 0`, throws clear error:
  ```
  No teams found for league {leagueId}, season {season}. 
  Response length: 0. 
  API errors: {errors}
  ```

### 4. Games/Fixtures Fetching

**Method**: `RugbyAPI.getFixturesByCompetition(competitionId, season, onlyFuture?)`

**Always calls**:
- All games: `GET /games?league={leagueId}&season={cachedSeason}`
- Future games: `GET /games?league={leagueId}&season={cachedSeason}&next=100`

**Error Handling**:
- If `response.length === 0`, throws clear error:
  ```
  No games found for league {leagueId}, season {season}. 
  Response length: 0. 
  API errors: {errors}
  ```

## Key Points

1. ✅ **Season is REQUIRED** for all Rugby API calls (`/teams`, `/games`)
2. ✅ **Never call without season** - always use the partition key
3. ✅ **Cache season in DB** on competition creation
4. ✅ **Reuse cached season** for all subsequent calls
5. ✅ **Clear error messages** when API returns empty results

## Migration

After code changes, run:
```bash
npx prisma migrate dev --name add_external_season
```

This adds the `externalSeason` field to the `Competition` model.

## Usage Example

```typescript
// 1. Discover season
const season = await rugbyAPI.getCurrentOrNextSeason(16); // Top 14
// Returns: { year: "2024", start: "2024-09-07", end: "2025-06-28", current: true }

// 2. Import competition (stores season in DB)
await importCompetition({
  externalCompetitionId: 16,
  season: season.year, // "2024"
  // ... competition.externalSeason = "2024" is stored
});

// 3. Fetch teams (uses cached season)
const teams = await rugbyAPI.getTeamsByCompetition(16, "2024");
// Calls: GET /teams?league=16&season=2024

// 4. Fetch games (uses cached season)
const games = await rugbyAPI.getFixturesByCompetition(16, "2024", false);
// Calls: GET /games?league=16&season=2024
```

