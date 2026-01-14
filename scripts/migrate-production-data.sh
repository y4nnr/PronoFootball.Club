#!/bin/bash

# ============================================================================
# Production Data Migration Script (Shell Wrapper)
# ============================================================================
# This script helps you run the SQL migration script safely
# 
# Usage:
#   chmod +x scripts/migrate-production-data.sh
#   ./scripts/migrate-production-data.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================================"
echo "Production Data Migration Script"
echo "============================================================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set it before running this script:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will modify your production database!${NC}"
echo ""
echo "This script will:"
echo "  1. Set sportType = 'FOOTBALL' for all teams without sportType"
echo "  2. Set sportType = 'FOOTBALL' for all competitions without sportType"
echo "  3. Check for data integrity issues"
echo "  4. Show verification reports"
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Running migration script..."
echo ""

# Extract connection details from DATABASE_URL for psql
# Format: postgresql://user:password@host:port/database
DB_URL=$DATABASE_URL

# Run the SQL script
if psql "$DB_URL" -f scripts/migrate-production-data.sql; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review the verification output above"
    echo "  2. If you have rugby competitions, update them manually:"
    echo "     UPDATE \"Competition\" SET \"sportType\" = 'RUGBY' WHERE name LIKE '%Rugby%';"
    echo "  3. Restart your application server"
    echo "  4. Test the application"
else
    echo ""
    echo -e "${RED}❌ Migration failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi
