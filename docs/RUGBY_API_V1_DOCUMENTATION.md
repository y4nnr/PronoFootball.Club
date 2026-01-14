# API-Sports.io Rugby API v1 - Documentation Deep Dive

## Base URL
- **Rugby API v1**: `https://v1.rugby.api-sports.io`

## Authentication
- Header: `x-apisports-key: YOUR_API_KEY`
- Same API key as Football API

## Key Differences from Football API

### 1. Endpoints
- Rugby uses `/games` endpoint (not `/fixtures`)
- Some endpoints may have different structures

### 2. Season Detection
- **CRITICAL**: Rugby API does NOT expose a "current season" field per league
- Season must be determined dynamically from games data
- Use `/games?league={id}&last=1` to get most recent game
- Read season from `response[0].league.season`
- If no last game, try `/games?league={id}&next=1` for upcoming games

### 3. Teams Endpoint
- Endpoint: `/teams?league={leagueId}&season={season}`
- Structure: Teams are returned directly in `response[]` array
- Each team has: `{ id, name, country: { name }, logo }`

### 4. Games Endpoint
- Endpoint: `/games?league={leagueId}&season={season}`
- Parameters:
  - `last=N`: Get last N games
  - `next=N`: Get next N games
  - `date=YYYY-MM-DD`: Filter by date
- Structure: Games are returned in `response[]` array
- Each game contains league information including season

## Important Notes from ChatGPT Analysis

1. **Season is a data partition key, not semantic**
   - Treat season as a partition, not a meaningful date range
   - Must be extracted from actual game data

2. **No static league metadata for seasons**
   - Do NOT use `/seasons?league=...` (doesn't exist or doesn't work)
   - Do NOT rely on league metadata for current season

3. **Dynamic season detection workflow**:
   ```
   1. Call GET /games?league={id}&last=1
   2. Read season from response[0].league.season
   3. If no results, try /games?league={id}&next=1
   4. Cache detected season in database
   ```

4. **Validation**
   - Use games endpoint to validate competition existence
   - If no games found, show warning but allow creation

## Current Implementation Issues

Based on error messages, the following need to be fixed:

1. **getCurrentOrNextSeason**: Must use `/games` endpoint, not league metadata
2. **getFixturesByCompetition**: Must use `/games` endpoint, not `/fixtures`
3. **Response structure mapping**: Need to verify exact structure of games response
4. **Season extraction**: Must extract from `game.league.season` or similar

## Next Steps

1. Verify exact response structure from `/games` endpoint
2. Update all endpoint calls to use correct Rugby API endpoints
3. Fix season detection logic
4. Update response parsing to match actual API structure
5. Add comprehensive error handling and logging

