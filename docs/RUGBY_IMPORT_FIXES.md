# Rugby Competition Import - Fixes Applied

## Issues Identified and Fixed

### 1. **Null selectedSeason Crash** ✅ FIXED
**Problem**: In `import.ts` line 320-321, code accessed `selectedSeason.start` and `selectedSeason.end` but `selectedSeason` could be `null` for Rugby.

**Fix**: Added null check and default date calculation:
```typescript
let startDate: Date;
let endDate: Date;

if (selectedSeason && selectedSeason.start && selectedSeason.end) {
  startDate = new Date(selectedSeason.start);
  endDate = new Date(selectedSeason.end);
} else {
  // Default dates: current year September to next year June (Rugby season)
  const currentYear = new Date().getFullYear();
  const seasonYear = parseInt(seasonForApi) || currentYear;
  startDate = new Date(seasonYear, 8, 1); // September 1st
  endDate = new Date(seasonYear + 1, 5, 30); // June 30th of next year
}
```

### 2. **Endpoint Inconsistency** ✅ FIXED
**Problem**: `getLiveMatches()`, `getMatchesByDateRange()`, and `getMatchById()` only used `/fixtures` endpoint, but Rugby API may use `/games`.

**Fix**: Updated all methods to try `/games` first, then fallback to `/fixtures`:
```typescript
async getLiveMatches(): Promise<RugbyMatch[]> {
  try {
    // Try /games first, fallback to /fixtures
    let data: any = null;
    try {
      data = await this.makeRequest('/games?live=all');
    } catch (error) {
      console.warn('[RUGBY API] /games?live=all failed, trying /fixtures...');
      data = await this.makeRequest('/fixtures?live=all');
    }
    
    const games = data.response || [];
    return this.mapGamesToMatches(games);
  } catch (error) {
    console.error('Error fetching live rugby matches:', error);
    return [];
  }
}
```

### 3. **Response Structure Mapping** ✅ IMPROVED
**Problem**: `getFixturesByCompetition()` mapped response assuming one structure, but Rugby API can return different structures for `/games` vs `/fixtures`.

**Fix**: Added comprehensive mapping that handles both structures:
- `/fixtures` structure: `{ fixture: {...}, teams: {...}, goals: {...}, league: {...} }`
- `/games` structure: `{ game: {...}, teams: {...}, scores: {...}, league: {...} }`

Also added detailed logging to understand actual API response structure.

### 4. **New mapGamesToMatches Method** ✅ ADDED
**Problem**: No unified method to map both `/games` and `/fixtures` responses.

**Fix**: Created `mapGamesToMatches()` method that handles both response structures with fallback logic.

## Testing Recommendations

1. **Test with actual API calls**:
   ```bash
   curl -H "x-apisports-key: YOUR_KEY" \
     "https://v1.rugby.api-sports.io/games?league=16&season=2024"
   
   curl -H "x-apisports-key: YOUR_KEY" \
     "https://v1.rugby.api-sports.io/fixtures?league=16&season=2024"
   ```

2. **Check logs** for actual response structure when importing a competition

3. **Verify**:
   - Season detection works (from games)
   - Teams are fetched correctly
   - Fixtures/games are fetched and mapped correctly
   - Competition is created with proper dates

## Remaining Potential Issues

1. **API Response Structure**: The actual structure from Rugby API v1 may differ from assumptions. The logging added will help identify the exact structure.

2. **Season Parameter**: Rugby API may not accept season parameter in the same format. Current code normalizes to year number (e.g., "2024").

3. **Team Extraction**: If `getTeamsByCompetition()` fails, code tries to extract teams from fixtures. This should work but depends on fixture structure.

## Next Steps

1. Test import with a real Rugby competition
2. Review logs to see actual API response structures
3. Adjust mapping if structure differs from expectations
4. Verify teams and games are correctly imported

