#!/bin/bash

# PronoFootball Deployment Script
# This script handles code deployment and database backup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 PronoFootball Deployment Script${NC}"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in PronoFootball project directory${NC}"
    exit 1
fi

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}📝 Uncommitted changes detected${NC}"
    echo "Files to commit:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n): " COMMIT_CHANGES
    
    if [ "$COMMIT_CHANGES" = "y" ] || [ "$COMMIT_CHANGES" = "Y" ]; then
        read -p "Enter commit message: " COMMIT_MESSAGE
        git add .
        git commit -m "$COMMIT_MESSAGE"
        echo -e "${GREEN}✅ Changes committed${NC}"
    else
        echo -e "${YELLOW}⚠️  Proceeding without committing changes${NC}"
    fi
fi

# Create database backup before deployment
echo -e "${BLUE}📊 Creating database backup before deployment...${NC}"
if ./scripts/backup-database.sh; then
    echo -e "${GREEN}✅ Database backup created successfully${NC}"
else
    echo -e "${RED}❌ Database backup failed${NC}"
    read -p "Continue deployment without backup? (y/n): " CONTINUE_WITHOUT_BACKUP
    if [ "$CONTINUE_WITHOUT_BACKUP" != "y" ] && [ "$CONTINUE_WITHOUT_BACKUP" != "Y" ]; then
        echo -e "${YELLOW}❌ Deployment cancelled${NC}"
        exit 1
    fi
fi

# Push to GitHub
echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
if git push origin main; then
    echo -e "${GREEN}✅ Code pushed to GitHub successfully${NC}"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
fi

# Optional: Create GitHub release
read -p "Create a GitHub release? (y/n): " CREATE_RELEASE
if [ "$CREATE_RELEASE" = "y" ] || [ "$CREATE_RELEASE" = "Y" ]; then
    read -p "Enter version tag (e.g., v1.0.1): " VERSION_TAG
    read -p "Enter release title: " RELEASE_TITLE
    read -p "Enter release notes: " RELEASE_NOTES
    
    # Get latest backup file
    LATEST_BACKUP=$(ls -t backups/*.gz 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        echo -e "${BLUE}📦 Creating GitHub release with database backup...${NC}"
        gh release create "$VERSION_TAG" "$LATEST_BACKUP" \
            --title "$RELEASE_TITLE" \
            --notes "$RELEASE_NOTES"
        echo -e "${GREEN}✅ GitHub release created with database backup${NC}"
    else
        echo -e "${BLUE}📦 Creating GitHub release...${NC}"
        gh release create "$VERSION_TAG" \
            --title "$RELEASE_TITLE" \
            --notes "$RELEASE_NOTES"
        echo -e "${GREEN}✅ GitHub release created${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "==================================================" 