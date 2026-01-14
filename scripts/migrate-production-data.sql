-- ============================================================================
-- Production Data Migration Script
-- ============================================================================
-- This script performs all required data migrations after schema changes
-- Run this AFTER running: npx prisma migrate deploy
-- 
-- Usage:
--   psql -h your_host -U your_user -d your_database -f scripts/migrate-production-data.sql
--   OR
--   Connect to your database and run this script
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Assign Sport Type to Existing Teams
-- ============================================================================
-- All existing teams need to have sportType set to FOOTBALL
-- (You can manually adjust specific teams to RUGBY if needed after running this)

DO $$
DECLARE
    teams_updated INTEGER;
    teams_total INTEGER;
BEGIN
    -- Count total teams
    SELECT COUNT(*) INTO teams_total FROM "Team";
    
    -- Count teams that need updating
    SELECT COUNT(*) INTO teams_updated
    FROM "Team"
    WHERE "sportType" IS NULL;
    
    RAISE NOTICE 'Total teams: %, Teams without sportType: %', teams_total, teams_updated;
    
    IF teams_updated > 0 THEN
        -- Update all teams without sportType to FOOTBALL
        UPDATE "Team"
        SET "sportType" = 'FOOTBALL'
        WHERE "sportType" IS NULL;
        
        RAISE NOTICE '✅ Updated % teams with sportType = FOOTBALL', teams_updated;
    ELSE
        RAISE NOTICE '✅ All teams already have sportType set';
    END IF;
    
    -- Verify: Count teams still without sportType (should be 0)
    SELECT COUNT(*) INTO teams_updated
    FROM "Team"
    WHERE "sportType" IS NULL;
    
    IF teams_updated > 0 THEN
        RAISE WARNING '⚠️ Still found % teams without sportType after update!', teams_updated;
    ELSE
        RAISE NOTICE '✅ Verification passed: All teams have sportType';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify and Set Competition Sport Types
-- ============================================================================
-- Competitions should default to FOOTBALL, but we verify and set any NULL values

DO $$
DECLARE
    competitions_updated INTEGER;
    competitions_total INTEGER;
BEGIN
    -- Count total competitions
    SELECT COUNT(*) INTO competitions_total FROM "Competition";
    
    -- Count competitions that need updating
    SELECT COUNT(*) INTO competitions_updated
    FROM "Competition"
    WHERE "sportType" IS NULL;
    
    RAISE NOTICE 'Total competitions: %, Competitions without sportType: %', competitions_total, competitions_updated;
    
    IF competitions_updated > 0 THEN
        -- Update all competitions without sportType to FOOTBALL
        UPDATE "Competition"
        SET "sportType" = 'FOOTBALL'
        WHERE "sportType" IS NULL;
        
        RAISE NOTICE '✅ Updated % competitions with sportType = FOOTBALL', competitions_updated;
    ELSE
        RAISE NOTICE '✅ All competitions already have sportType set';
    END IF;
    
    -- Verify: Count competitions still without sportType (should be 0)
    SELECT COUNT(*) INTO competitions_updated
    FROM "Competition"
    WHERE "sportType" IS NULL;
    
    IF competitions_updated > 0 THEN
        RAISE WARNING '⚠️ Still found % competitions without sportType after update!', competitions_updated;
    ELSE
        RAISE NOTICE '✅ Verification passed: All competitions have sportType';
    END IF;
    
    -- Show summary by sportType
    RAISE NOTICE '📊 Competition summary by sportType:';
    FOR rec IN 
        SELECT "sportType", COUNT(*) as cnt
        FROM "Competition"
        GROUP BY "sportType"
        ORDER BY "sportType"
    LOOP
        RAISE NOTICE '   - %: % competitions', rec."sportType", rec.cnt;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Check for Duplicate Team Names (Data Integrity Check)
-- ============================================================================
-- After removing unique constraint on Team.name, we need to verify
-- that duplicates only exist when sportType differs

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Check for teams with same name AND same sportType (this should not happen)
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT name, "sportType", COUNT(*) as cnt
        FROM "Team"
        GROUP BY name, "sportType"
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'Found % duplicate team names with same sportType - this may cause issues!', duplicate_count;
        RAISE NOTICE 'Review these teams manually:';
        
        -- Show the duplicates
        FOR rec IN 
            SELECT name, "sportType", COUNT(*) as cnt
            FROM "Team"
            GROUP BY name, "sportType"
            HAVING COUNT(*) > 1
        LOOP
            RAISE NOTICE '  - % (sportType: %, count: %)', rec.name, rec."sportType", rec.cnt;
        END LOOP;
    ELSE
        RAISE NOTICE '✓ No duplicate team names with same sportType found';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Verification Queries (Information Only)
-- ============================================================================

-- Show summary of teams by sportType
SELECT 
    "sportType",
    COUNT(*) as team_count
FROM "Team"
GROUP BY "sportType"
ORDER BY "sportType";

-- Show summary of competitions by sportType
SELECT 
    "sportType",
    COUNT(*) as competition_count
FROM "Competition"
GROUP BY "sportType"
ORDER BY "sportType";

-- Show teams still without sportType (should be 0)
SELECT 
    COUNT(*) as teams_without_sportType
FROM "Team"
WHERE "sportType" IS NULL;

-- Show competitions still without sportType (should be 0)
SELECT 
    COUNT(*) as competitions_without_sportType
FROM "Competition"
WHERE "sportType" IS NULL;

-- ============================================================================
-- STEP 5: Optional - List Teams That Might Need Manual Review
-- ============================================================================
-- Teams that play in both football and rugby competitions might need special handling
-- This query helps identify them

SELECT 
    t.id,
    t.name,
    t."sportType",
    COUNT(DISTINCT c."sportType") as different_sports_count
FROM "Team" t
JOIN "Game" g ON (g."homeTeamId" = t.id OR g."awayTeamId" = t.id)
JOIN "Competition" c ON g."competitionId" = c.id
GROUP BY t.id, t.name, t."sportType"
HAVING COUNT(DISTINCT c."sportType") > 1
ORDER BY t.name;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================
-- If everything looks good, commit the changes
-- If you see any issues, run: ROLLBACK;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- After running this script:
-- 1. Review the verification queries output
-- 2. If you have rugby competitions, you may need to manually update those:
--    UPDATE "Competition" SET "sportType" = 'RUGBY' WHERE name LIKE '%Rugby%' OR name LIKE '%Top 14%';
-- 3. If you have teams that play in both sports, you may need to:
--    - Create separate team entries for each sport, OR
--    - Leave sportType as NULL (but this may cause filtering issues)
-- 4. Verify the application works correctly after migration
