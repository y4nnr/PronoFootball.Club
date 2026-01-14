#!/bin/bash
API_KEY=$(grep FOOTBALL_DATA_API_KEY .env.local 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")
TODAY=$(date +%Y-%m-%d)

echo "🔍 Checking for Liverpool match today ($TODAY)..."
echo ""

# Check live matches
echo "⚽ Live matches:"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?status=LIVE" | python3 -m json.tool | grep -A 20 -i liverpool || echo "No Liverpool match found in LIVE matches"
echo ""

# Check today's matches
echo "📅 Today's matches:"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?date=$TODAY" | python3 -m json.tool | grep -A 20 -i liverpool || echo "No Liverpool match found in today's matches"

