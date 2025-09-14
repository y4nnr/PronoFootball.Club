# Data Management & Backup Strategy

This document outlines the data management and backup strategies for the PronoFootball application.

## 📊 Database Overview

### Current Data
- **8 Real Users**: Authentic Euro 2016 participants with final rankings
- **51 Historical Games**: Complete Euro 2016 tournament results  
- **408 Realistic Bets**: Distributed across all matches with proper scoring
- **29 Teams**: 24 National + 5 Club teams with Wikipedia flag logos
- **Complete Statistics**: User performance tracking and leaderboards

### Database Schema
- **PostgreSQL**: Primary database with Prisma ORM
- **Docker Container**: `pronofootball-postgres-1`
- **Persistent Volume**: Data stored in Docker volume `pronofootball_postgres_data`

## 🔄 Backup Solutions

### 1. Local Database Backups

#### Automated Backup Script
```bash
# Create backup
./scripts/backup-database.sh

# Restore from backup
./scripts/restore-database.sh
```

#### Manual Backup Commands
```bash
# Create backup manually
docker exec pronofootball-postgres-1 pg_dump -U pronofootball -d pronofootball > backup.sql

# Restore manually
docker exec -i pronofootball-postgres-1 psql -U pronofootball -d pronofootball < backup.sql
```

### 2. GitHub Integration for Code

#### Repository Setup
- **Repository**: [https://github.com/y4nnr/pronofootball](https://github.com/y4nnr/pronofootball)
- **Branches**: `main` (production), `develop` (development)
- **Protection**: Main branch protected, requires PR reviews

#### What's Stored in GitHub
✅ **Included:**
- Source code and configuration files
- Database schema and migrations
- Docker configuration
- Documentation and scripts
- Environment example files

❌ **Excluded (.gitignore):**
- Environment files with secrets (`.env`)
- Database backup files (`*.sql`, `*.dump`)
- Node modules and build artifacts
- Temporary and log files

### 3. Database Backup Storage Options

#### Option A: GitHub Releases (Recommended for Small Datasets)
```bash
# Create a release with database backup
gh release create v1.0.0 ./backups/pronofootball_backup_latest.sql.gz \
  --title "PronoFootball v1.0.0 with Euro 2016 Data" \
  --notes "Complete application with historical Euro 2016 data"
```

#### Option B: Git LFS for Large Files
```bash
# Install Git LFS
git lfs install

# Track backup files
git lfs track "backups/*.sql.gz"
git add .gitattributes
git commit -m "Add Git LFS tracking for database backups"
```

#### Option C: External Storage Services
- **AWS S3**: For production deployments
- **Google Drive**: For personal backups
- **Dropbox**: Alternative cloud storage

## 📋 Backup Schedule

### Development Environment
- **Manual Backups**: Before major changes
- **Automated**: Weekly via cron job (optional)

### Production Environment
- **Daily**: Automated backups at 2 AM UTC
- **Weekly**: Full database export
- **Monthly**: Archive to long-term storage

## 🔧 Implementation Steps

### 1. Set Up Local Backups

```bash
# Make scripts executable
chmod +x scripts/backup-database.sh
chmod +x scripts/restore-database.sh

# Create initial backup
./scripts/backup-database.sh
```

### 2. GitHub Repository Setup

```bash
# Push to GitHub
git push -u origin main

# Create first release with data
gh release create v1.0.0 \
  --title "Initial Release - PronoFootball with Euro 2016 Data" \
  --notes "Complete football prediction platform with historical Euro 2016 data"
```

### 3. Automated Backup (Optional)

```bash
# Add to crontab for weekly backups
crontab -e

# Add this line for weekly backups on Sundays at 2 AM
0 2 * * 0 cd /path/to/pronofootball && ./scripts/backup-database.sh
```

## 🚨 Disaster Recovery

### Complete System Recovery
1. **Clone Repository**:
   ```bash
   git clone https://github.com/y4nnr/pronofootball.git
   cd pronofootball
   ```

2. **Set Up Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Database**:
   ```bash
   docker-compose up -d postgres
   ```

4. **Restore Data**:
   ```bash
   # Download backup from GitHub release or restore from local backup
   ./scripts/restore-database.sh
   ```

5. **Start Application**:
   ```bash
   npm install
   npm run dev
   ```

### Data Migration Between Environments
```bash
# Export from source
./scripts/backup-database.sh

# Transfer backup file to target environment
scp backups/pronofootball_backup_*.sql.gz user@target-server:/path/to/pronofootball/backups/

# Import on target
./scripts/restore-database.sh
```

## 📊 Data Integrity Verification

### Database Health Check
```sql
-- Check user count
SELECT COUNT(*) as user_count FROM "User";

-- Check games count  
SELECT COUNT(*) as games_count FROM "Game";

-- Check bets count
SELECT COUNT(*) as bets_count FROM "Bet";

-- Check data consistency
SELECT 
  u.name,
  COUNT(b.id) as bet_count,
  SUM(b.points) as total_points
FROM "User" u
LEFT JOIN "Bet" b ON u.id = b."userId"
GROUP BY u.id, u.name
ORDER BY total_points DESC;
```

### Backup Verification
```bash
# Test backup integrity
gunzip -t backups/pronofootball_backup_*.sql.gz

# Verify backup content
gunzip -c backups/pronofootball_backup_*.sql.gz | head -20
```

## 🔐 Security Considerations

### Backup Security
- **Encryption**: Consider encrypting sensitive backups
- **Access Control**: Limit access to backup files
- **Retention**: Implement backup retention policies

### Environment Variables
```bash
# Never commit these to Git
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...

# Use environment-specific files
.env.local          # Local development
.env.production     # Production deployment
.env.staging        # Staging environment
```

## 📈 Monitoring & Alerts

### Backup Monitoring
- **Success/Failure Notifications**: Email or Slack alerts
- **Storage Usage**: Monitor backup directory size
- **Retention Compliance**: Ensure old backups are cleaned up

### Database Monitoring
- **Connection Health**: Monitor database connectivity
- **Performance Metrics**: Query performance and response times
- **Data Growth**: Track database size over time

## 🔄 Version Control Strategy

### Branching Strategy
```
main                 # Production-ready code
├── develop         # Integration branch
├── feature/stats   # Feature development
└── hotfix/bug-fix  # Critical fixes
```

### Release Process
1. **Development**: Work on `develop` branch
2. **Feature Branches**: Create from `develop`
3. **Pull Requests**: Merge to `develop` via PR
4. **Release**: Merge `develop` to `main`
5. **Tagging**: Create release tags with data snapshots

## 📞 Support & Recovery

### Emergency Contacts
- **Database Issues**: Check Docker container status
- **Application Issues**: Review application logs
- **Data Loss**: Use latest backup from `./backups/`

### Recovery Time Objectives
- **RTO (Recovery Time)**: < 30 minutes for local environment
- **RPO (Recovery Point)**: < 24 hours data loss maximum
- **Backup Verification**: Weekly integrity checks

---

**Remember**: Always test your backup and restore procedures in a non-production environment first! 