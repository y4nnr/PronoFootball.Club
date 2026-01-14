# Manual Actions Required for Production Deployment

## Summary
After fetching code from GitHub, you'll need to perform these manual actions in production.

---

## 1. Database Migration (CRITICAL - Do First)

### Step 1: Backup Database
```bash
# Create a full backup before migration
pg_dump -h your_host -U your_user -d your_database > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Run Prisma Migration
```bash
# Apply schema changes
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate
```

**What this does:**
- Adds `SportType` enum (FOOTBALL, RUGBY)
- Adds `sportType` field to `Competition` (defaults to FOOTBALL)
- Adds `externalSeason` field to `Competition` (nullable, for Rugby)
- Adds `sportType` and `country` fields to `Team`
- Removes unique constraint on `Team.name` (allows same name for different sports)
- Adds composite unique constraint `@@unique([name, sportType])` on `Team`
- Adds `elapsedMinute` field to `Game` (for chronometer)

---

## 2. Environment Variables (REQUIRED)

### Add to `.env` file:

```bash
# Existing (should already be set)
DATABASE_URL="postgresql://..."
FOOTBALL_DATA_API_KEY="your_key"  # For V1 (default)

# NEW - Required for V2 API (api-sports.io)
# Note: Variable name uses HYPHEN, not underscore
API-FOOTBALL="your_api_sports_key"

# NEW - Optional for Rugby API (can be same as API-FOOTBALL)
API-RUGBY="your_rugby_key"  # Optional, falls back to API-FOOTBALL if not set

# NEW - Feature flag (optional, defaults to V1 if not set)
USE_API_V2=true  # Set to true to use V2, false or omit for V1
```

**Important Notes:**
- `API-FOOTBALL` uses a **hyphen** in the variable name (not underscore)
- If `USE_API_V2=true`, you **must** set `API-FOOTBALL`
- Rugby API will use `API-RUGBY` if set, otherwise falls back to `API-FOOTBALL`
- If you don't set `USE_API_V2`, the system defaults to V1 (football-data.org)

---

## 3. Data Migration (REQUIRED - After Schema Migration)

### Automated Migration Script (RECOMMENDED)

We've created a SQL script that automates all data migration tasks:

**Option 1: Using the shell script (easiest)**
```bash
# Make sure DATABASE_URL is set in your environment
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run the migration script
chmod +x scripts/migrate-production-data.sh
./scripts/migrate-production-data.sh
```

**Option 2: Using psql directly**
```bash
psql $DATABASE_URL -f scripts/migrate-production-data.sql
```

**What the script does:**
- ✅ Sets `sportType = 'FOOTBALL'` for all teams without sportType
- ✅ Sets `sportType = 'FOOTBALL'` for all competitions without sportType
- ✅ Checks for duplicate team names (data integrity)
- ✅ Shows verification reports
- ✅ Identifies teams that might need manual review

### Manual Migration (Alternative)

If you prefer to run SQL queries manually:

**Step 1: Assign Sport Type to Existing Teams**
```sql
UPDATE "Team" 
SET "sportType" = 'FOOTBALL' 
WHERE "sportType" IS NULL;
```

**Step 2: Verify Competition Sport Types**
```sql
UPDATE "Competition" 
SET "sportType" = 'FOOTBALL' 
WHERE "sportType" IS NULL;
```

**Step 3: Check for Duplicate Team Names**
```sql
SELECT name, "sportType", COUNT(*) 
FROM "Team" 
GROUP BY name, "sportType" 
HAVING COUNT(*) > 1;
```

**Note:** After running the migration, if you have rugby competitions, you may need to manually update them:
```sql
UPDATE "Competition" 
SET "sportType" = 'RUGBY' 
WHERE name LIKE '%Rugby%' OR name LIKE '%Top 14%';
```

---

## 4. Install Dependencies

```bash
npm install
```

**Why:** New dependencies may have been added for the new API integrations.

---

## 5. Build Application

```bash
npm run build
```

**Why:** Ensure the application builds successfully with all new code.

---

## 6. Restart Application Server

```bash
# Restart your production server (method depends on your setup)
# Examples:
pm2 restart your_app_name
# or
systemctl restart your_app_service
# or
# Your custom restart command
```

**Why:** New environment variables and code changes require a restart.

---

## 7. Verify Deployment

### Check Server Logs

After restart, you should see:
```
🔧 API Configuration: Using V1 (football-data.org)
```
or
```
🔧 API Configuration: Using V2 (api-sports.io)
```

### Test Endpoints

1. **Homepage**: Verify logo displays correctly (should be larger)
2. **Stats Page**: Test sport filters (ALL, FOOTBALL, RUGBY)
3. **Competition Pages**: Test "Rejoindre la compétition" button
4. **Admin Panel**: Test participant management
5. **Dashboard**: Verify games from joined competitions appear

---

## 8. Optional: Enable V2 API

If you want to use the new V2 API (api-sports.io) with chronometer support:

1. Set `USE_API_V2=true` in `.env`
2. Ensure `API-FOOTBALL` is set
3. Restart server
4. Test live score updates

**Note:** V1 (football-data.org) remains the default if `USE_API_V2` is not set.

---

## 9. Monitor After Deployment

### Check for Errors

- Monitor application logs for Prisma/client errors
- Check for API rate limit errors
- Verify database queries are working correctly

### Verify Data Integrity

```sql
-- Check teams without sportType (should be 0)
SELECT COUNT(*) FROM "Team" WHERE "sportType" IS NULL;

-- Check competitions without sportType (should be 0)
SELECT COUNT(*) FROM "Competition" WHERE "sportType" IS NULL;
```

---

## Quick Checklist

- [ ] Backup database
- [ ] Run `npx prisma migrate deploy`
- [ ] Run `npx prisma generate`
- [ ] Add `API-FOOTBALL` to `.env` (if using V2)
- [ ] Add `API-RUGBY` to `.env` (optional, for rugby)
- [ ] Set `USE_API_V2=true` (optional, if using V2)
- [ ] Run SQL to set `sportType` on existing teams
- [ ] Verify competitions have correct `sportType`
- [ ] Run `npm install`
- [ ] Run `npm run build`
- [ ] Restart application server
- [ ] Verify server logs show correct API version
- [ ] Test key features (stats filters, competition join, etc.)

---

## Rollback Plan

If something goes wrong:

1. **Restore Database Backup**:
   ```bash
   psql -h your_host -U your_user -d your_database < backup_before_migration_*.sql
   ```

2. **Revert Code**:
   ```bash
   git checkout HEAD~1  # Or specific commit
   npm install
   npm run build
   ```

3. **Restart Server**

---

## Notes

- **Breaking Change**: The `Team.name` unique constraint was removed. This is intentional to allow same team names in different sports.
- **Default Behavior**: System defaults to V1 API (football-data.org) unless `USE_API_V2=true` is set.
- **Rugby API**: Always uses api-sports.io (independent of `USE_API_V2` flag), but requires `API-RUGBY` or `API-FOOTBALL` to be set.
