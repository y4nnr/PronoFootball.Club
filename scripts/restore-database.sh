#!/bin/bash

# PronoFootball Database Restore Script
# This script restores the PostgreSQL database from a backup file

set -e

# Configuration
DB_NAME="pronofootball"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="./backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 PronoFootball Database Restore Script${NC}"
echo "=================================================="

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}❌ Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

# List available backups
echo -e "${BLUE}📋 Available backups:${NC}"
BACKUPS=($(ls -t "$BACKUP_DIR"/*.gz 2>/dev/null || true))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}❌ No backup files found in $BACKUP_DIR${NC}"
    exit 1
fi

# Display backups with numbers
for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    BACKUP_DATE=$(basename "$BACKUP_FILE" | sed 's/pronofootball_backup_\([0-9]*_[0-9]*\).sql.gz/\1/' | sed 's/_/ /')
    echo "  $((i+1)). $(basename "$BACKUP_FILE") ($BACKUP_SIZE) - $BACKUP_DATE"
done

# Ask user to select backup
echo ""
read -p "Enter the number of the backup to restore (1-${#BACKUPS[@]}): " SELECTION

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt ${#BACKUPS[@]} ]; then
    echo -e "${RED}❌ Invalid selection!${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((SELECTION-1))]}"
echo -e "${YELLOW}📁 Selected backup: $(basename "$SELECTED_BACKUP")${NC}"

# Confirm restoration
echo ""
echo -e "${RED}⚠️  WARNING: This will completely replace the current database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}❌ Restoration cancelled.${NC}"
    exit 0
fi

# Check if Docker container is running
if ! docker ps | grep -q postgres; then
    echo -e "${RED}❌ PostgreSQL Docker container is not running!${NC}"
    echo "Please start the database with: docker-compose up -d postgres"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔄 Starting database restoration...${NC}"

# Create temporary directory for decompression
TEMP_DIR=$(mktemp -d)
TEMP_SQL_FILE="$TEMP_DIR/restore.sql"

# Decompress backup
echo -e "${YELLOW}📦 Decompressing backup...${NC}"
gunzip -c "$SELECTED_BACKUP" > "$TEMP_SQL_FILE"

# Drop existing database and recreate
echo -e "${YELLOW}🗑️  Dropping existing database...${NC}"
docker exec pronofootball-db-1 psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo -e "${YELLOW}🆕 Creating new database...${NC}"
docker exec pronofootball-db-1 psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

# Restore database
echo -e "${YELLOW}📥 Restoring database from backup...${NC}"
if docker exec -i pronofootball-db-1 psql -U "$DB_USER" -d "$DB_NAME" < "$TEMP_SQL_FILE"; then
    echo -e "${GREEN}✅ Database restored successfully!${NC}"
else
    echo -e "${RED}❌ Database restoration failed!${NC}"
    # Cleanup
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Cleanup temporary files
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}🎉 Database restoration completed successfully!${NC}"
echo "==================================================" 