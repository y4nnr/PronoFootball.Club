# API Migration Guide - V1 to V2 Migration

## Overview

This application supports two API providers for live football scores:
- **V1**: football-data.org (current default)
- **V2**: api-sports.io (new, with chronometer support)

You can easily switch between them using a simple environment variable.

## Quick Start

### Using V1 (football-data.org) - Default

```bash
# In .env file
FOOTBALL_DATA_API_KEY=your_key_here
# Don't set USE_API_V2 or set it to false
```

### Using V2 (api-sports.io)

```bash
# In .env file
API-FOOTBALL=your_key_here
USE_API_V2=true
```

## Feature Flag System

The feature flag is controlled by the `USE_API_V2` environment variable:

- `USE_API_V2=true` → Uses V2 (api-sports.io)
- `USE_API_V2=false` or not set → Uses V1 (football-data.org)

The routing happens automatically in `pages/api/update-live-scores.ts`.

## V2 Improvements

### 1. Chronometer Support
- V2 includes `elapsedMinute` field (minute of the match)
- Stored in database and updated only when API runs (not real-time client-side)
- Displayed in `GameCard` component

### 2. Improved Team Matching
- Better team name matching algorithm
- Automatic learning of successful matches
- Support for multiple team aliases

### 3. Automatic Game Detection
- Automatically detects new games (playoffs, etc.)
- Creates missing games in database
- Supports postponed/rescheduled matches

## Database Schema

V2 requires an additional field in the `Game` model:

```prisma
model Game {
  // ... existing fields ...
  elapsedMinute Int? // Minute of the match (0-90+)
}
```

Run migration:
```bash
npx prisma migrate dev --name add_elapsed_minute
```

## API Endpoints

### Main Endpoint
- `POST /api/update-live-scores` - Automatically routes to V1 or V2 based on feature flag

### V2 Specific Endpoints (when USE_API_V2=true)
- `POST /api/update-live-scores-v2` - Direct V2 handler
- `POST /api/auto-detect-games-v2` - Automatic game detection

## Testing

### Test V1 (default)
```bash
# Ensure USE_API_V2 is not set or false
curl -X POST http://localhost:3000/api/update-live-scores
```

### Test V2
```bash
# Set USE_API_V2=true in .env
curl -X POST http://localhost:3000/api/update-live-scores
```

## Migration Checklist

- [ ] Add `API-FOOTBALL` to `.env`
- [ ] Set `USE_API_V2=true` in `.env`
- [ ] Run Prisma migration for `elapsedMinute` field
- [ ] Test V2 in development
- [ ] Monitor V2 in production
- [ ] Switch back to V1 if needed (set `USE_API_V2=false`)

## Rollback

If you need to rollback to V1:

```bash
# In .env
USE_API_V2=false
# Or simply remove the line
```

The system will automatically use V1 (football-data.org).

## Configuration Validation

The system validates configuration on startup. Check logs for:
- `🔧 API Configuration: Using V1/V2`
- Any configuration errors

## Notes

- The chronometer (`elapsedMinute`) is updated **only** when the API runs, not in real-time on the client
- Both V1 and V2 can run in parallel for testing
- Feature flag changes require server restart

