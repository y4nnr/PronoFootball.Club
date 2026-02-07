#!/bin/bash

# Script to update live scores and trigger frontend refresh
# This script is called by PM2 scheduler every 10 seconds
# Usage: ./scripts/update_games.sh

set -u  # Only exit on undefined variables (don't use -e to avoid crashes on errors)

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-8}"  # 8 seconds timeout per request (scheduler runs every 10s)

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

# Function to make API call with timeout
api_call() {
    local endpoint=$1
    local description=$2
    
    log "📡 Calling POST ${BASE_URL}${endpoint}..."
    
    response=$(curl -s -m "${TIMEOUT}" -X POST "${BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}" 2>&1) || {
        log "❌ ${description} failed: curl error"
        return 1
    }
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2 || echo "000")
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    if [ "$http_status" = "200" ]; then
        updates=$(echo "$body" | jq -r '.updatedGames | length // 0' 2>/dev/null || echo "0")
        log "✅ ${description}: HTTP $http_status, $updates game(s) updated"
        return 0
    elif [ "$http_status" = "000" ]; then
        log "⚠️ ${description}: Timeout or connection error (may be normal if no live games)"
        return 0  # Don't fail on timeout - might be normal
    else
        log "⚠️ ${description}: HTTP $http_status (may be normal if no live games)"
        return 0  # Don't fail on non-200 - might be normal (e.g., 500 if no games)
    fi
}

# Main execution
main() {
    log "🔄 Starting live score update cycle..."
    
    # Track if any updates occurred
    football_updated=0
    rugby_updated=0
    
    # 1. Update Football scores
    if api_call "/api/update-live-scores" "Football"; then
        football_updated=1
    fi
    
    # 2. Update Rugby scores
    if api_call "/api/update-live-scores-rugby" "Rugby"; then
        rugby_updated=1
    fi
    
    # 3. Trigger frontend refresh (CRITICAL: Always call, even if no updates)
    # This ensures users see updates even if the previous calls had issues
    log "📡 Calling POST ${BASE_URL}/api/trigger-frontend-refresh..."
    refresh_response=$(curl -s -m "${TIMEOUT}" -X POST "${BASE_URL}/api/trigger-frontend-refresh" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}" 2>&1) || {
        log "⚠️ Frontend refresh: curl error (non-critical, continuing)"
        refresh_http_status="000"
    }
    
    if [ -n "${refresh_response:-}" ]; then
        refresh_http_status=$(echo "$refresh_response" | grep "HTTP_STATUS:" | cut -d: -f2 || echo "000")
        refresh_body=$(echo "$refresh_response" | sed '/HTTP_STATUS:/d')
        
        if [ "$refresh_http_status" = "200" ]; then
            refresh_clients=$(echo "$refresh_body" | jq -r '.connectedClients // 0' 2>/dev/null || echo "0")
            log "✅ Frontend refresh: HTTP $refresh_http_status, $refresh_clients client(s) notified"
        elif [ "$refresh_http_status" = "000" ]; then
            log "⚠️ Frontend refresh: Timeout (non-critical)"
        else
            log "⚠️ Frontend refresh: HTTP $refresh_http_status (non-critical)"
        fi
    fi
    
    log "✅ Update cycle complete"
    return 0
}

# Run main function
main "$@"

# Always exit with success (0) to prevent PM2 restarts
# Even if some endpoints fail, we don't want PM2 to restart the process
exit 0
