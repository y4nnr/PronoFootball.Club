#!/bin/bash

# Script to safely apply live score migration to production
# Usage: ./scripts/apply-live-score-migration.sh

set -e  # Exit on error

echo "🚀 Starting Live Score Migration Deployment"
echo "=========================================="
echo ""

# Step 1: Backup
echo "📦 Step 1: Creating database backup..."
echo "Running your existing backup script..."
echo ""

# Check if backup script exists
if [ ! -f "./scripts/backup-database.sh" ]; then
    echo "❌ Backup script not found at ./scripts/backup-database.sh"
    echo "Please create a backup manually before proceeding!"
    exit 1
fi

# Run the backup script
./scripts/backup-database.sh

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully!"
else
    echo "❌ Backup failed! Please check the error above."
    exit 1
fi

echo ""

# Step 2: Apply migration
echo "📝 Step 2: Applying migration..."
echo "Running: npx prisma migrate deploy"
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed! Check the error above."
    exit 1
fi

echo ""

# Step 3: Regenerate Prisma Client
echo "🔧 Step 3: Regenerating Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client regenerated!"
else
    echo "❌ Prisma Client generation failed!"
    exit 1
fi

echo ""
echo "🎉 Migration complete!"
echo ""
echo "⚠️  Don't forget to restart your application:"
echo "   - Docker: docker-compose restart app"
echo "   - PM2: pm2 restart pronofootball"
echo "   - Systemd: systemctl restart pronofootball"
echo ""

