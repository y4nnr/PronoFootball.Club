# Release Notes - Version 3.0.0

## 🎉 Major Release: Multi-Sport Support & Enhanced Features

### 🏈 Multi-Sport Support (Football + Rugby)

- **Complete Rugby Integration**: Full support for rugby competitions alongside football
- **Sport-Specific Statistics**: Independent filtering for football and rugby stats
- **Rugby Scoring System**: Custom scoring rules for rugby (3 points for exact/close scores, 1 point for correct result)
- **Multi-Sport Team Support**: Teams can exist in both sports (e.g., "Lyon" in Football and Rugby)
- **Sport Type Filtering**: Filter competitions, teams, and statistics by sport type

### 🔌 New API Provider Integration

- **API-Sports.io V2 Integration**: New football API provider with improved features
- **Rugby API Integration**: Dedicated rugby API endpoint for live scores and match data
- **Chronometer Support**: Real-time match minute display for both football and rugby
- **Enhanced Team Matching**: Improved team name matching algorithm
- **Feature Flag**: `USE_API_V2` environment variable to switch between API providers

### 📊 Statistics & Leaderboard Enhancements

- **Sport-Specific Statistics**: Filter personal and global stats by sport type
- **Fixed Statistics Calculation**: Removed hardcoded competition filters, now works for all competitions
- **Date-Based Filtering**: Statistics calculated from competitions starting August 2025 onwards
- **Improved Accuracy**: Better calculation of exact scores, correct outcomes, and streaks

### 🎨 UI/UX Improvements

- **Branding Update**: Rebranded from "PronoFootball.club" to "Toopil"
- **Logo Improvements**: Enhanced logo size and positioning across all pages
- **Game Card Enhancements**: 
  - Better date/time readability with badge styling
  - Improved contrast and modern design
  - Chronometer display for live matches
- **Player Points Progression Widget**: Fixed segment display issues, improved visualization
- **Responsive Design**: Better mobile and desktop experiences

### 🗄️ Database Schema Updates

- **New SportType Enum**: FOOTBALL and RUGBY types
- **Competition Model**: Added `sportType` and `externalSeason` fields
- **Team Model**: Added `sportType` and `country` fields, updated uniqueness constraints
- **Game Model**: Added `elapsedMinute` field for chronometer support
- **CompetitionUser Model**: Enhanced participation tracking

### 🔧 Admin Features

- **Competition Management**: Sport type assignment and filtering
- **Team Management**: Sport-specific team filtering and management
- **Participant Management**: Admin can view and remove competition participants
- **Join Competition Feature**: Users can join competitions directly from competition pages

### 🐛 Bug Fixes

- **Fixed Statistics Filtering**: Removed hardcoded "Champions League 25/26" filter
- **Fixed Dashboard Games**: Corrected filtering for upcoming games by user participation
- **Fixed Widget Progression**: Corrected segment width calculation in points progression widget
- **Fixed Translation**: Added missing French translation for "noActiveGamesFound"

### 📝 Documentation

- **Migration Scripts**: SQL scripts for data migration
- **Production Guides**: Comprehensive deployment and migration documentation
- **Code Reviews**: Deep dive analysis of all changes

### 🔄 Breaking Changes

- **Team Name Uniqueness**: Removed unique constraint on team names (now composite with sportType)
- **Statistics Calculation**: Now filters by date (2025-08-01) instead of competition name
- **API Endpoints**: New rugby-specific endpoints required

### 📋 Migration Required

Before deploying to production:
1. Run Prisma migrations: `npx prisma migrate deploy`
2. Execute data migration script: `./scripts/migrate-production-data.sh`
3. Update environment variables (API keys, feature flags)
4. Configure scheduler for rugby endpoint

---

**Total Changes**: 41+ files modified, 2,600+ insertions, 700+ deletions
