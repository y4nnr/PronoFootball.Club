#!/bin/bash

# PronoFootball Database Backup Script
# This script creates backups of the PostgreSQL database with timestamp

set -e

# Configuration
DB_NAME="pronofootball"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pronofootball_backup_${TIMESTAMP}.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🗄️  PronoFootball Database Backup Script${NC}"
echo "=================================================="

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if Docker container is running
if ! docker ps | grep -q postgres; then
    echo -e "${RED}❌ PostgreSQL Docker container is not running!${NC}"
    echo "Please start the database with: docker-compose up -d postgres"
    exit 1
fi

echo -e "${YELLOW}📊 Creating database backup...${NC}"

# Create the backup using docker exec
if docker exec pronofootball-db-1 pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "📁 Backup location: $BACKUP_FILE"
    
    # Get file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📏 Backup size: $BACKUP_SIZE"
    
    # Compress the backup
    echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    COMPRESSED_FILE="${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup compressed successfully!${NC}"
    echo "📁 Compressed backup: $COMPRESSED_FILE"
    echo "📏 Compressed size: $COMPRESSED_SIZE"
    
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# List recent backups
echo ""
echo -e "${YELLOW}📋 Recent backups:${NC}"
ls -lah "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No previous backups found"

# Cleanup old backups (keep last 10)
echo ""
echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last 10)...${NC}"
ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
echo -e "${GREEN}✅ Cleanup completed!${NC}"

echo ""
echo -e "${GREEN}🎉 Database backup process completed successfully!${NC}"
echo "==================================================" 