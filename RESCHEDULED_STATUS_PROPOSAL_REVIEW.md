# RESCHEDULED Status Proposal - Review

## 📋 Proposal Summary

**Add a new `RESCHEDULED` game status that:**
1. Admin can manually set
2. Prevents all automatic updates (no API can change it)
3. Admin updates date when known, then changes status back to `UPCOMING`
4. Normal flow resumes after status change

---

## ✅ **PROS - Why This Is a Great Approach**

### 1. **Clear State Management**
- ✅ Explicit state: "This game needs manual attention"
- ✅ Prevents confusion: No automatic systems interfere
- ✅ Clear workflow: RESCHEDULED → Update date → UPCOMING → Normal flow

### 2. **Solves the Root Problem**
- ✅ **Bug #1 (Date Range Search)**: Not needed - RESCHEDULED games are excluded
- ✅ **Bug #2 (Date Validation)**: Not needed - RESCHEDULED games are excluded
- ✅ Prevents all automatic systems from touching rescheduled games

### 3. **Simple Implementation**
- ✅ Single enum addition
- ✅ Exclude RESCHEDULED from automatic updates
- ✅ Admin UI already supports status changes

### 4. **Better Than Date-Based Fixes**
- ✅ No need for date range searches or validation changes
- ✅ More explicit and maintainable
- ✅ Clear intent: "This game is rescheduled, leave it alone"

---

## ⚠️ **CONSIDERATIONS - Things to Think About**

### 1. **Schema Change Required**
- ⚠️ Need to add `RESCHEDULED` to `GameStatus` enum in Prisma schema
- ⚠️ Database migration required
- ⚠️ All TypeScript types need updating
- **Impact**: Medium (standard migration process)

### 2. **Where to Exclude RESCHEDULED Games**

#### ✅ **Must Exclude From:**

**A. Automatic Status Updates:**
- `scripts/game-status-worker.js` (line 44, 90)
  - Currently: `WHERE "status" = 'UPCOMING'`
  - Change: `WHERE "status" = 'UPCOMING' AND "status" != 'RESCHEDULED'`
  - **Impact**: Prevents RESCHEDULED games from being marked LIVE

- `pages/api/admin/update-game-statuses.ts` (line 38)
  - Currently: `status: 'UPCOMING'`
  - Change: `status: { in: ['UPCOMING'] }` (already excludes RESCHEDULED)
  - **Impact**: Manual admin endpoint won't touch RESCHEDULED games

**B. Live Score Sync APIs:**
- `pages/api/update-live-scores-rugby.ts`
  - Currently: Queries `status: { in: ['LIVE', 'FINISHED'] }` (line 30, 76, 179)
  - Also queries games without status filter for matching
  - **Impact**: Should exclude RESCHEDULED from all queries
  - **Lines to check**: 30, 76, 179, 355, 446, 484, 571, 618, 719, 762, 816, 865, 1086

- `pages/api/update-live-scores-v2.ts`
  - Currently: Queries `status: { in: ['FINISHED', 'LIVE'] }` (line 20, 34)
  - Also queries games without status filter for matching
  - **Impact**: Should exclude RESCHEDULED from all queries
  - **Lines to check**: 20, 34, 89, 239, 331, 381, 581, 623, 667, 903, 921, 987, 1080, 1086

**C. User-Facing Queries:**
- `pages/api/user/dashboard-betting-games.ts` (line 142)
  - Currently: `status: 'UPCOMING'`
  - **Decision**: Should RESCHEDULED games appear in betting UI?
  - **Recommendation**: **NO** - Users shouldn't bet on rescheduled games until date is updated

- `pages/api/user/games-of-day.ts` (line 102-103)
  - Currently: `status: { in: ['UPCOMING', 'LIVE', 'FINISHED'] }`
  - **Decision**: Should RESCHEDULED games appear in "Matchs du jour"?
  - **Recommendation**: **NO** - Only show after date is updated and status is UPCOMING

- `pages/api/competitions/[id]/games.ts` (line 29)
  - Currently: `status: 'UPCOMING'`
  - **Decision**: Should RESCHEDULED games appear in competition games list?
  - **Recommendation**: **NO** - Only show after date is updated and status is UPCOMING

- `pages/api/games/index.ts` (line 20-22)
  - Currently: `status: { in: ['UPCOMING', 'LIVE', 'FINISHED'] }`
  - **Decision**: Should RESCHEDULED games appear in general games list?
  - **Recommendation**: **MAYBE** - Could show with special indicator, but probably NO

**D. Admin UI:**
- `pages/api/admin/live-sync-games.ts` (line 100)
  - Currently: `status === 'UPCOMING' || status === 'LIVE' || status === 'FINISHED' || status === 'CANCELLED'`
  - **Decision**: Should RESCHEDULED games appear in admin live sync?
  - **Recommendation**: **YES** - Admin should see RESCHEDULED games to manage them

- `pages/admin/live-sync.tsx`
  - **Decision**: Should RESCHEDULED games appear in admin UI?
  - **Recommendation**: **YES** - Admin needs to see and manage RESCHEDULED games

**E. News Generation:**
- `pages/api/generate-news.ts`
  - Currently: Checks `status !== 'FINISHED'` (line 682)
  - **Decision**: Should RESCHEDULED games block news generation?
  - **Recommendation**: **YES** - Don't generate news for rescheduled games until they're played

**F. Competition Activation:**
- `scripts/game-status-worker.js` (line 114)
  - Currently: `g.status IN ('LIVE', 'FINISHED')`
  - **Impact**: RESCHEDULED games won't activate competitions (correct behavior)

### 3. **UI/UX Considerations**

**A. Game Card Display:**
- `components/GameCard.tsx`
  - **Question**: How should RESCHEDULED games be displayed?
  - **Recommendation**: 
    - Show "Reporté" (Postponed) or "Reprogrammé" (Rescheduled) badge
    - Gray out the card
    - Show original date with strikethrough
    - Don't show betting interface

**B. Dashboard Widgets:**
- `pages/dashboard.tsx`
  - **Question**: Should RESCHEDULED games appear in "Matchs du jour"?
  - **Recommendation**: **NO** - Only show after date is updated

**C. Competition Page:**
- `pages/competitions/[id].tsx`
  - **Question**: Should RESCHEDULED games appear in game list?
  - **Recommendation**: **NO** - Only show after date is updated, OR show with special indicator

**D. Betting UI:**
- `pages/betting/[id].tsx`
  - **Question**: Can users bet on RESCHEDULED games?
  - **Recommendation**: **NO** - Block betting on RESCHEDULED games

### 4. **Edge Cases**

**A. Game Already LIVE When Rescheduled:**
- **Scenario**: Game is LIVE, but then rescheduled
- **Question**: Can admin set LIVE game to RESCHEDULED?
- **Recommendation**: **YES** - Admin should be able to reset LIVE → RESCHEDULED
- **Action**: Clear live scores, reset to RESCHEDULED

**B. Game Already FINISHED When Rescheduled:**
- **Scenario**: Game is FINISHED, but admin realizes it was rescheduled
- **Question**: Can admin set FINISHED game to RESCHEDULED?
- **Recommendation**: **MAYBE** - This is unusual, but admin should have control
- **Action**: Clear scores, reset to RESCHEDULED, recalculate bets (set to 0)

**C. externalId Handling:**
- **Question**: Should `externalId` be cleared when setting to RESCHEDULED?
- **Recommendation**: **YES** - Clear `externalId` when setting to RESCHEDULED
- **Reason**: External API might have wrong date, need fresh lookup after reschedule

**D. Bet Handling:**
- **Question**: What happens to existing bets on RESCHEDULED games?
- **Recommendation**: **KEEP** - Don't delete bets, but:
  - Don't allow new bets
  - Don't calculate points until game is played
  - When game is played, recalculate all bets

**E. Date Update Workflow:**
- **Question**: Should admin be able to update date while status is RESCHEDULED?
- **Recommendation**: **YES** - Admin should update date, then change status to UPCOMING
- **Workflow**: 
  1. Set status to RESCHEDULED
  2. Update date to new date
  3. Change status to UPCOMING
  4. Normal flow resumes

**F. Forgetting to Update:**
- **Question**: What if admin forgets to update date/status?
- **Recommendation**: 
  - Add admin notification/reminder
  - Show RESCHEDULED games prominently in admin UI
  - Add filter in admin UI to show only RESCHEDULED games

### 5. **Admin API Changes**

**A. Status Validation:**
- `pages/api/admin/games/[gameId].ts` (line 77-79)
  - Currently: `validStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED']`
  - **Change**: Add `'RESCHEDULED'` to validStatuses

**B. Status Transitions:**
- **Question**: Should there be restrictions on status transitions?
- **Recommendation**: **NO** - Admin should have full control
- **But**: Add logging when RESCHEDULED is set/cleared

**C. Auto-Clear Fields:**
- **Question**: Should setting to RESCHEDULED auto-clear certain fields?
- **Recommendation**: **YES** - When setting to RESCHEDULED:
  - Clear `externalId` (if exists)
  - Clear `externalStatus`
  - Clear `liveHomeScore`, `liveAwayScore`
  - Clear `elapsedMinute`
  - Keep `homeScore`, `awayScore` (if game was already finished)
  - Keep bets (don't delete)

### 6. **TypeScript Type Updates**

**Files to Update:**
- `prisma/schema.prisma` - Add `RESCHEDULED` to enum
- All TypeScript files that reference `GameStatus` enum
- All API endpoints that validate status
- All UI components that display status

---

## 📊 **IMPLEMENTATION CHECKLIST**

### Phase 1: Schema & Types
- [ ] Add `RESCHEDULED` to `GameStatus` enum in `prisma/schema.prisma`
- [ ] Run Prisma migration
- [ ] Update TypeScript types (auto-generated by Prisma)

### Phase 2: Core Logic - Exclude from Automatic Updates
- [ ] `scripts/game-status-worker.js` - Exclude RESCHEDULED from status updates
- [ ] `pages/api/admin/update-game-statuses.ts` - Exclude RESCHEDULED
- [ ] `pages/api/update-live-scores-rugby.ts` - Exclude RESCHEDULED from all queries
- [ ] `pages/api/update-live-scores-v2.ts` - Exclude RESCHEDULED from all queries

### Phase 3: User-Facing APIs - Hide from Users
- [ ] `pages/api/user/dashboard-betting-games.ts` - Exclude RESCHEDULED
- [ ] `pages/api/user/games-of-day.ts` - Exclude RESCHEDULED
- [ ] `pages/api/competitions/[id]/games.ts` - Exclude RESCHEDULED
- [ ] `pages/api/games/index.ts` - Exclude RESCHEDULED (or show with indicator)

### Phase 4: Admin APIs - Support RESCHEDULED
- [ ] `pages/api/admin/games/[gameId].ts` - Add RESCHEDULED to validStatuses
- [ ] `pages/api/admin/games/[gameId].ts` - Auto-clear fields when setting to RESCHEDULED
- [ ] `pages/api/admin/live-sync-games.ts` - Include RESCHEDULED in admin queries

### Phase 5: UI Components
- [ ] `components/GameCard.tsx` - Display RESCHEDULED status with badge
- [ ] `pages/betting/[id].tsx` - Block betting on RESCHEDULED games
- [ ] `pages/admin/live-sync.tsx` - Show RESCHEDULED games with filter
- [ ] `pages/competitions/[id].tsx` - Handle RESCHEDULED games display

### Phase 6: Edge Cases
- [ ] Handle LIVE → RESCHEDULED transition
- [ ] Handle FINISHED → RESCHEDULED transition
- [ ] Clear externalId when setting to RESCHEDULED
- [ ] Preserve bets when setting to RESCHEDULED

### Phase 7: Testing
- [ ] Test setting game to RESCHEDULED
- [ ] Test automatic systems don't touch RESCHEDULED games
- [ ] Test date update workflow
- [ ] Test status change back to UPCOMING
- [ ] Test UI displays correctly

---

## 🎯 **RECOMMENDATION**

### ✅ **APPROVE - This is a Better Approach**

**Why:**
1. ✅ Solves the root problem elegantly
2. ✅ More maintainable than date-based fixes
3. ✅ Clear intent and workflow
4. ✅ Prevents all automatic interference
5. ✅ Admin has full control

**Implementation Priority:**
1. **High**: Schema change + Core exclusions (Phase 1-2)
2. **Medium**: User-facing exclusions (Phase 3)
3. **Medium**: Admin support (Phase 4)
4. **Low**: UI polish (Phase 5-6)

**Estimated Effort:**
- **Phase 1-2**: 2-3 hours (core functionality)
- **Phase 3-4**: 2-3 hours (API updates)
- **Phase 5-6**: 3-4 hours (UI updates)
- **Phase 7**: 1-2 hours (testing)
- **Total**: ~8-12 hours

---

## 💡 **ALTERNATIVE CONSIDERATIONS**

### Option A: RESCHEDULED Status (Proposed) ✅
- **Pros**: Explicit, clear, prevents all automatic updates
- **Cons**: Requires schema change, more places to update
- **Effort**: Medium-High
- **Recommendation**: **GO WITH THIS**

### Option B: Flag Field (e.g., `isRescheduled: boolean`)
- **Pros**: No enum change, simpler
- **Cons**: Less explicit, need to check flag everywhere
- **Effort**: Medium
- **Recommendation**: Less clear than status

### Option C: Date-Based Fixes (Original)
- **Pros**: No schema change
- **Cons**: Doesn't solve root problem, complex date logic
- **Effort**: Low-Medium
- **Recommendation**: Less elegant

---

## ✅ **FINAL VERDICT**

**This is an excellent proposal!** It's cleaner, more maintainable, and solves the problem at its root. The implementation is straightforward, and the workflow is clear.

**Recommendation: Proceed with implementation**
