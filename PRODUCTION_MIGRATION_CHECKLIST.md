# Production Migration Checklist

## Pre-Deployment

### 1. Database Migration
- [ ] **Backup production database** (critical!)
- [ ] Run Prisma migration: `npx prisma migrate deploy`
- [ ] Regenerate Prisma client: `npx prisma generate`
- [ ] **Data migration**: Assign `sportType` to existing teams
  ```sql
  -- Set FOOTBALL for existing teams (adjust as needed)
  UPDATE "Team" SET "sportType" = 'FOOTBALL' WHERE "sportType" IS NULL;
  ```
- [ ] **Data migration**: Set `sportType` for existing competitions
  ```sql
  -- Competitions default to FOOTBALL, but verify
  UPDATE "Competition" SET "sportType" = 'FOOTBALL' WHERE "sportType" IS NULL;
  ```

### 2. Environment Variables
- [ ] Verify `DATABASE_URL` is set correctly
- [ ] Verify API keys are configured:
  - `FOOTBALL_API_KEY` (api-sports.io)
  - `RUGBY_API_KEY` (api-sports.io)
- [ ] Check feature flags if using:
  - `USE_FOOTBALL_V2_API`
  - `USE_RUGBY_API`

### 3. Code Deployment
- [ ] Pull latest code from repository
- [ ] Install dependencies: `npm install`
- [ ] Build application: `npm run build`
- [ ] Restart application server

## Post-Deployment

### 4. Verification
- [ ] Test homepage loads with new logo
- [ ] Test login page redirects correctly
- [ ] Test about page displays correctly
- [ ] Verify sport filters work in stats page
- [ ] Test "Rejoindre la compétition" button functionality
- [ ] Test admin participant management (if admin)
- [ ] Verify dashboard shows games from user's competitions only
- [ ] Check that existing competitions still work

### 5. Monitoring
- [ ] Monitor error logs for Prisma/client issues
- [ ] Check API rate limits for new providers
- [ ] Verify live score updates are working
- [ ] Monitor database performance

## Rollback Plan

If issues occur:
1. Revert code to previous version
2. Restore database backup if schema changes caused issues
3. Restart application with previous build

## Notes

- **Breaking Change**: Team name uniqueness constraint was removed - ensure no duplicate team names exist before migration
- **New API Endpoints**: 
  - `/api/competitions/[id]/join` (POST)
  - `/api/admin/competitions/[competitionId]/participants` (GET)
  - `/api/admin/competitions/[competitionId]/participants/[userId]` (DELETE)
- **Translation Updates**: French and English translation files updated with "Toopil" branding

