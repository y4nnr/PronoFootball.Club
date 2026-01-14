# API-Sports.io Rugby API v1 - Complete Reference

## Base Configuration
- **Base URL**: `https://v1.rugby.api-sports.io`
- **Authentication Header**: `x-apisports-key: YOUR_API_KEY`
- **API Key**: Same key as Football API (`API-RUGBY` or `API-FOOTBALL`)

## Critical Differences from Football API

### 1. Season Detection - CRITICAL
**Rugby API does NOT expose a "current season" field per league like Football does.**

**DO NOT:**
- ❌ Use `/seasons?league=...` (doesn't work for league-specific seasons)
- ❌ Try to determine season from league metadata
- ❌ Use static league metadata for current season

**DO:**
- ✅ Determine season dynamically from games data
- ✅ Use `/games?league={id}&last=1` to get most recent game
- ✅ Read season from `response[0].league.season`
- ✅ If no last game, try `/games?league={id}&next=1`
- ✅ Cache detected season in database (don't recompute every request)

### 2. Endpoints

#### Teams Endpoint
```
GET /teams?league={leagueId}&season={season}
```
- **Parameters**:
  - `league`: Competition/League ID (required)
  - `season`: Year as number, e.g., `2024` (required)
- **Response Structure**:
```json
{
  "response": [
    {
      "id": 95,
      "name": "Aviron Bayonnais",
      "country": {
        "name": "France"
      },
      "logo": "https://media.api-sports.io/rugby/teams/95.png"
    }
  ]
}
```
- Teams are returned **directly** in `response[]` array (not nested in `team` object)
- Each team has: `id`, `name`, `country.name`, `logo`

#### Games Endpoint (NOT Fixtures)
```
GET /games?league={leagueId}&season={season}
```
- **Parameters**:
  - `league`: Competition/League ID (required)
  - `season`: Year as number (required)
  - `last=N`: Get last N games (optional)
  - `next=N`: Get next N games (optional)
  - `date=YYYY-MM-DD`: Filter by date (optional)
- **Response Structure** (to be verified):
```json
{
  "response": [
    {
      "game": {
        "id": 12345,
        "date": "2024-01-15T15:00:00+00:00",
        "status": {
          "short": "FT",
          "elapsed": 80
        }
      },
      "teams": {
        "home": { "id": 95, "name": "Aviron Bayonnais" },
        "away": { "id": 96, "name": "Bordeaux Begles" }
      },
      "scores": {
        "home": 24,
        "away": 18
      },
      "league": {
        "id": 16,
        "name": "Top 14",
        "season": 2024
      }
    }
  ]
}
```
- **Season is in**: `response[0].league.season` (number, e.g., 2024)

#### Leagues Endpoint
```
GET /leagues?id={leagueId}
```
- Returns league information including seasons array
- **Note**: Season in league metadata may not reflect current season
- Use games endpoint to determine actual current season

## Implementation Workflow

### Step 1: Determine Current Season
```typescript
// Try last game first
const lastGame = await makeRequest(`/games?league=${leagueId}&last=1`);
if (lastGame.response && lastGame.response.length > 0) {
  const season = lastGame.response[0].league.season; // e.g., 2024
  return season;
}

// If no last game, try next game
const nextGame = await makeRequest(`/games?league=${leagueId}&next=1`);
if (nextGame.response && nextGame.response.length > 0) {
  const season = nextGame.response[0].league.season;
  return season;
}
```

### Step 2: Fetch Teams
```typescript
const teams = await makeRequest(`/teams?league=${leagueId}&season=${season}`);
// teams.response[] contains team objects directly
```

### Step 3: Fetch Games
```typescript
// All games
const allGames = await makeRequest(`/games?league=${leagueId}&season=${season}`);

// Future games only
const futureGames = await makeRequest(`/games?league=${leagueId}&season=${season}&next=100`);
```

## Current Issues to Fix

### Issue 1: getCurrentOrNextSeason()
- ❌ Currently tries to use league metadata
- ✅ Should use `/games?league={id}&last=1` or `next=1`
- ✅ Extract season from `response[0].league.season`

### Issue 2: getFixturesByCompetition()
- ❌ Currently uses `/fixtures` endpoint
- ✅ Should use `/games` endpoint
- ✅ Map response structure correctly

### Issue 3: Response Structure Mapping
- Need to verify exact structure of `/games` response
- May need to handle different structures than expected

### Issue 4: Season Normalization
- Season should be a number (2024), not a string range ("2024-2025")
- Normalize input to extract year number

## Error Handling

### If No Games Found
- Do NOT fail hard
- Allow competition creation with warning
- Season can be determined later when games are available

### If No Teams Found
- Try extracting teams from games if available
- Show clear error message about missing data
- Allow user to retry with different season

## Testing Endpoints

Use the test endpoint to verify API responses:
```
GET /api/test-rugby-teams?leagueId=16&season=2024
```

This will test:
1. Season detection from games
2. Teams fetching
3. Games/fixtures fetching
4. Response structure logging

## Key Takeaways

1. **Season is a partition key, not semantic** - treat as data partition
2. **Must determine season from games** - cannot use static metadata
3. **Use `/games` not `/fixtures`** - different endpoint for Rugby
4. **Teams are direct in response[]** - not nested structure
5. **Cache season when found** - don't recompute every time
6. **Be lenient with errors** - allow creation even if some data missing

## Next Steps

1. ✅ Verify exact `/games` response structure
2. ✅ Update `getCurrentOrNextSeason()` to use games endpoint
3. ✅ Update `getFixturesByCompetition()` to use `/games` endpoint
4. ✅ Fix response structure mapping
5. ✅ Add comprehensive error handling
6. ✅ Test with real API calls

## References

- Official Documentation: https://api-sports.io/documentation/rugby/v1
- Base URL: `https://v1.rugby.api-sports.io`
- Authentication: `x-apisports-key` header

