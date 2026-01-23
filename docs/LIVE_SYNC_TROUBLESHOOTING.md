# Live Sync Troubleshooting Guide

## Overview
This guide helps you troubleshoot team matching issues during live game syncs.

## Key Features for Live Testing

### 1. Enhanced Logging
The live sync now provides detailed summary logs at the end of each sync:

```
================================================================================
📊 LIVE SYNC SUMMARY (V2)
================================================================================
✅ Matched & Updated: X games
❌ Rejected (safety): Y matches
⚠️  Unmatched: Z external matches
📈 External API provided: N matches
🎮 Our LIVE games: M games
🔄 Games updated: K games
```

### 2. Rejected Matches Tracking
When a match is rejected for safety reasons, you'll see:
- **Reason**: Why it was rejected (e.g., "Trying to set FINISHED status + Large date difference")
- **Details**: Match method used and date difference
- **External match info**: Team names, competition, external ID

### 3. Unmatched Matches Tracking
When an external match can't be found in our database:
- **External match details**: Team names, competition, external ID
- **Reason**: Why it wasn't matched (usually "No matching game found in database")

## Admin Live Sync Dashboard

Access: `/admin/live-sync` (admin only)

### What to Monitor During Live Testing:

1. **Recent Syncs** (last 3 hours by default)
   - Check `lastSyncAt` timestamps
   - Verify games are being updated regularly

2. **Status Issues**
   - Games marked `FINISHED` but missing final scores → **RED FLAG**
   - Games stuck in `LIVE` status for >3 hours → May need auto-finish

3. **External ID Tracking**
   - Games with `externalId` are more reliable (direct API match)
   - Games without `externalId` rely on team name matching

4. **Score Discrepancies**
   - Compare `liveHomeScore/liveAwayScore` vs `homeScore/awayScore`
   - If final scores exist but differ from live scores → investigate

## Common Issues & Solutions

### Issue 1: Game Not Updating
**Symptoms:**
- Game is LIVE in database but not receiving score updates
- External match exists but shows as "Unmatched" in logs

**Possible Causes:**
1. **Team name mismatch**
   - Check external API team name vs our database team name
   - Look for differences in: accents, FC/CF suffixes, abbreviations

2. **Competition mismatch**
   - External competition name doesn't match our competition name
   - Check competition name normalization

3. **Date/time mismatch**
   - External match date differs significantly from our game date
   - Check timezone handling

**Troubleshooting Steps:**
1. Check the sync summary logs for "Unmatched" entries
2. Compare team names in admin dashboard vs external API
3. Verify `externalId` is set (if available, matching is more reliable)
4. Check competition names match

### Issue 2: Wrong Game Matched
**Symptoms:**
- Scores updating for wrong game
- Different teams than expected

**Possible Causes:**
1. **Fuzzy matching too aggressive**
   - Similar team names matched incorrectly
   - Multiple games with similar teams on same day

**Troubleshooting Steps:**
1. Check sync logs for "Rejected" matches - these were caught by safety checks
2. If wrong match was applied, check:
   - Match confidence level (HIGH/MEDIUM/LOW)
   - Match method used
   - Date difference
   - Competition match score
3. Review the rejection reasons in logs

### Issue 3: Game Rejected (Safety)
**Symptoms:**
- External match exists but game not updated
- Logs show "REJECTING LOW CONFIDENCE MATCH"

**Why This Happens:**
The system rejects matches when:
- Trying to set FINISHED status with LOW confidence
- Date difference > 1 hour
- Competition name doesn't match well

**This is INTENTIONAL** - prevents wrong final scores from being applied.

**If You Need to Force Update:**
1. Manually verify the match is correct
2. Set `externalId` on the game manually (if available)
3. Re-run sync - externalId matching is HIGH confidence

## Matching Confidence Levels

### HIGH Confidence
- ✅ **V1-style LIVE match**: Both teams matched with score ≥ 0.9, game is LIVE
- ✅ **externalId + date verified**: External ID matches and date within 1 hour

**Action**: Always applied (with final safety checks)

### MEDIUM Confidence
- ⚠️ **Team + date + competition**: Good team match, date within 30min, competition matches
- ⚠️ **externalId (no date)**: External ID matches but no date to verify

**Action**: Applied for LIVE updates, but **rejected** if trying to set FINISHED

### LOW Confidence
- ⚠️ **Loose criteria**: Team match with date >30min or competition match <0.9

**Action**: **Always rejected** if trying to set FINISHED, may be applied for LIVE-only updates

## What to Check During Live Testing

### Before Games Start:
1. ✅ Verify games have `externalId` set (if available from import)
2. ✅ Check team names in database match external API names
3. ✅ Verify competition names are consistent

### During Live Sync:
1. ✅ Monitor sync summary logs
2. ✅ Check for rejected matches (safety working)
3. ✅ Verify unmatched matches (may indicate missing games)
4. ✅ Watch admin dashboard for score updates

### After Games:
1. ✅ Verify final scores are correct
2. ✅ Check games marked FINISHED have final scores
3. ✅ Review any rejected/unmatched matches in logs

## API Response Structure

The sync endpoint returns:
```json
{
  "success": true,
  "matchedGames": 5,
  "rejectedMatches": 2,
  "unmatchedMatches": 1,
  "rejectedDetails": [...],  // First 20 rejected matches
  "unmatchedDetails": [...], // First 20 unmatched matches
  "updatedGames": [...]
}
```

## Quick Debug Commands

### Check Recent Syncs:
```bash
# View server logs for sync summaries
# Look for "LIVE SYNC SUMMARY" sections
```

### Manual Sync Trigger:
```bash
# Trigger sync manually (if you have endpoint)
curl -X POST http://localhost:3000/api/update-live-scores-v2
```

### Check Game Status:
```sql
-- Check games that should be LIVE but aren't updating
SELECT id, "homeTeamId", "awayTeamId", status, "externalId", "lastSyncAt"
FROM "Game"
WHERE status = 'LIVE'
AND "lastSyncAt" < NOW() - INTERVAL '10 minutes';
```

## Reporting Issues

When reporting a matching issue, include:
1. **External match details**: Team names, competition, external ID, date
2. **Our game details**: Team names, competition, game ID, date
3. **Sync log excerpt**: Relevant section from sync summary
4. **Expected behavior**: What should have happened
5. **Actual behavior**: What actually happened

## Safety Features

The system is designed to **fail safe**:
- ✅ Rejects uncertain matches rather than applying wrong scores
- ✅ Requires HIGH confidence for FINISHED status updates
- ✅ Logs all rejections with detailed reasons
- ✅ Tracks unmatched matches for investigation

**Remember**: It's better to skip an update than apply a wrong final score!
