# Review: Rugby Live Scores API Integration

## Executive Summary

After reviewing the code, I've identified **3 critical issues** that need to be addressed for rugby competitions (including 6 Nations) to work correctly with live score updates.

---

## 🔴 Critical Issue #1: Separate Endpoint Required

### Problem
The main live score endpoint `/api/update-live-scores` **only handles FOOTBALL games**. Rugby has a completely separate endpoint `/api/update-live-scores-rugby` that must be called independently.

### Current Behavior
- **`/api/update-live-scores`**: Routes to V2 handler which filters by `sportType: 'FOOTBALL'` only
- **`/api/update-live-scores-rugby`**: Separate endpoint that filters by `sportType: 'RUGBY'` only

### Impact
If your scheduler/cron job only calls `/api/update-live-scores`, **rugby games will NEVER be updated**, even if they're LIVE.

### Solution Required
**You must call BOTH endpoints** in your scheduler:
```bash
# Football (or V1 if USE_API_V2=false)
POST /api/update-live-scores

# Rugby (always separate)
POST /api/update-live-scores-rugby
```

**OR** modify the main endpoint to automatically call the rugby endpoint as well.

---

## 🟡 Medium Issue #2: Competition External ID Mapping (OPTIONAL Optimization)

### Problem
The rugby endpoint (`update-live-scores-rugby.ts`) has **hardcoded competition external IDs** for fetching finished matches by competition, but **6 Nations is NOT mapped**.

### Current Code (Line 173-179)
```typescript
// Try to determine competition external ID from name
let competitionExternalId: number | null = null;
if (competition.name.includes('Top 14')) {
  competitionExternalId = 16;
}
// Add more competitions as needed
```

### ⚠️ IMPORTANT: This is NOT Required for Basic Functionality!

The competition external ID is **only used for an OPTIONAL optimization** to fetch finished matches from a specific competition. The system works WITHOUT it because:

1. **`getLiveMatches()`** - Fetches ALL live matches (any competition) ✅
2. **`getMatchesByDateRange()`** - Fetches ALL matches from a date range (any competition) ✅
3. **`getMatchById(externalId)`** - Fetches a specific match by its ID (most reliable) ✅

### What Happens Without Competition ID
- ✅ **Live matches** are still fetched via `getLiveMatches()` (works for ALL competitions)
- ✅ **Finished matches** are still fetched via `getMatchesByDateRange()` (works for ALL competitions)
- ✅ **Specific matches** are fetched via `getMatchById()` if they have an `externalId`
- ⚠️ **Only optimization lost**: Can't fetch finished matches from a specific competition (but date range works fine)

### Impact
- ✅ **6 Nations LIVE matches** will work perfectly (via `getLiveMatches()`)
- ✅ **6 Nations finished matches** will work (via `getMatchesByDateRange()`)
- ⚠️ **Slightly less efficient**: May fetch more matches than needed, but still works

### Solution (Optional - Only for Optimization)
If you want to optimize API calls by fetching only matches from specific competitions:
1. Find the api-sports.io external ID for 6 Nations
2. Add it to the mapping:
```typescript
if (competition.name.includes('Top 14')) {
  competitionExternalId = 16;
} else if (competition.name.includes('6 Nations') || competition.name.includes('Six Nations')) {
  competitionExternalId = ???; // Optional optimization
}
```

**But this is NOT required for 6 Nations to work!**

---

## 🟡 Medium Issue #3: Dependency on `externalSeason`

### Problem
The competition-based fetching requires **both** `competitionExternalId` AND `competition.externalSeason` to be set.

### Current Code (Line 181)
```typescript
if (competitionExternalId && competition.externalSeason) {
  // Fetch fixtures
}
```

### Impact
Even if you add the 6 Nations external ID, it won't work unless:
- ✅ `competition.externalSeason` is set (e.g., "2024" for 2024/25 season)
- ✅ The season value matches what the API expects

### Solution Required
Ensure that when importing rugby competitions:
1. `externalSeason` is correctly set
2. The season format matches what api-sports.io expects

---

## ✅ What Works Correctly

### 1. Sport Type Filtering
- ✅ Rugby endpoint correctly filters by `sportType: 'RUGBY'`
- ✅ Football endpoint correctly filters by `sportType: 'FOOTBALL'`
- ✅ No cross-contamination between sports

### 2. Team Matching
- ✅ Uses `findBestTeamMatch()` for team name matching
- ✅ Falls back to team name matching if `externalId` not found
- ✅ Handles rugby-specific team names correctly

### 3. Score Updates
- ✅ Updates `liveHomeScore` and `liveAwayScore`
- ✅ Updates `elapsedMinute` for chronometer
- ✅ Handles rugby-specific statuses (HT, 1H, 2H, FT, AET, PEN)
- ✅ Calculates bet points using rugby scoring system

### 4. Direct Match Fetching
- ✅ If a game has `externalId`, it fetches directly by ID (most reliable)
- ✅ This works for ANY competition, regardless of mapping

---

## 📋 Action Items for Production

### Immediate (Before Deploy)

1. **Verify Scheduler Configuration**
   - Check if your cron/scheduler calls `/api/update-live-scores-rugby`
   - If not, add it to your scheduler

2. **Find 6 Nations External ID**
   - Check api-sports.io documentation or API response
   - Or test with: `GET https://v1.rugby.api-sports.io/leagues?search=6%20Nations`

3. **Add Competition ID Mapping**
   - Add 6 Nations ID to `update-live-scores-rugby.ts`
   - Add any other rugby competitions you plan to use

4. **Verify `externalSeason` is Set**
   - Check that imported rugby competitions have `externalSeason` set
   - Verify the format matches API expectations

### Testing Checklist

- [ ] Call `/api/update-live-scores-rugby` manually during a 6 Nations match
- [ ] Verify logs show the competition is found
- [ ] Verify live scores are fetched and updated
- [ ] Verify chronometer updates correctly
- [ ] Verify scores update in real-time
- [ ] Verify bet points are calculated when match finishes

---

## 🔍 How to Find Competition External IDs

### Method 1: API Documentation
Check api-sports.io documentation for league IDs.

### Method 2: API Call
```bash
curl -X GET "https://v1.rugby.api-sports.io/leagues?search=6%20Nations" \
  -H "x-apisports-key: YOUR_API_KEY"
```

### Method 3: Check Import Logs
When importing competitions, the external ID should be logged or stored.

---

## 💡 Recommended Solution

### Option A: Add Competition ID Mapping (Quick Fix)
Add all rugby competition IDs to the hardcoded mapping:
```typescript
if (competition.name.includes('Top 14')) {
  competitionExternalId = 16;
} else if (competition.name.includes('6 Nations') || competition.name.includes('Six Nations')) {
  competitionExternalId = ???; // Add actual ID
} else if (competition.name.includes('Pro D2')) {
  competitionExternalId = ???; // Add actual ID
}
```

### Option B: Store External ID in Database (Better Solution)
1. Add `externalId` field to `Competition` model
2. Store it when importing competitions
3. Use it directly instead of name matching

### Option C: Auto-Call Rugby Endpoint (Best UX)
Modify `/api/update-live-scores` to automatically call the rugby endpoint:
```typescript
// After handling football
if (API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey) {
  // Call rugby endpoint in parallel or sequentially
  await fetch('/api/update-live-scores-rugby', { method: 'POST' });
}
```

---

## 🎯 Summary

**For 6 Nations to work:**
1. ✅ Endpoint exists and filters correctly
2. ❌ **MUST** call `/api/update-live-scores-rugby` separately
3. ❌ **MUST** add 6 Nations external ID to mapping
4. ⚠️ **MUST** ensure `externalSeason` is set correctly

**Current Status**: 6 Nations will **NOT** work out of the box. You need to:
- Add the competition ID mapping
- Ensure the scheduler calls the rugby endpoint
- Verify `externalSeason` is set
