#!/bin/bash

# Triggers /api/generate-news on a cron. Endpoint is idempotent
# (News is unique on competitionId, matchDayDate) so rerunning is safe.
# Called by PM2 every 5 minutes.

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-60}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

log "📰 Triggering news generation..."

response=$(curl -s -m "${TIMEOUT}" "${BASE_URL}/api/generate-news?generate=true" \
  -w "\nHTTP_STATUS:%{http_code}" 2>&1) || {
    log "❌ curl error contacting ${BASE_URL}/api/generate-news"
    exit 0
}

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2 || echo "000")
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

if [ "$http_status" = "200" ]; then
    items=$(echo "$body" | jq -r 'length // 0' 2>/dev/null || echo "?")
    log "✅ News generation: HTTP $http_status, $items news item(s) returned"
elif [ "$http_status" = "000" ]; then
    log "⚠️  News generation: timeout/connection error"
else
    log "⚠️  News generation: HTTP $http_status"
    log "   body: $(echo "$body" | head -c 200)"
fi

exit 0
