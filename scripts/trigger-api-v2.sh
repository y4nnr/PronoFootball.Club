#!/bin/bash

# Script to manually trigger API V2 (api-sports.io)
# Usage: ./scripts/trigger-api-v2.sh

echo "🚀 Triggering API V2 (api-sports.io)..."
echo ""

# Check if server is running (optional)
# You can uncomment this if you want to check first
# if ! curl -s http://localhost:3000 > /dev/null; then
#   echo "❌ Server is not running on localhost:3000"
#   echo "   Please start the server first: npm run dev"
#   exit 1
# fi

# Trigger the API
echo "📡 Calling POST /api/update-live-scores..."
echo ""

response=$(curl -s -X POST http://localhost:3000/api/update-live-scores \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

# Extract HTTP status
http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

echo "📊 Response:"
echo "   HTTP Status: $http_status"
echo ""
echo "📄 Response Body:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_status" = "200" ]; then
  echo "✅ API V2 triggered successfully!"
else
  echo "❌ API V2 trigger failed (HTTP $http_status)"
  echo ""
  echo "💡 Make sure:"
  echo "   1. Server is running (npm run dev)"
  echo "   2. USE_API_V2=true in .env"
  echo "   3. API-FOOTBALL key is set in .env"
  echo "   4. V2 handler exists (pages/api/update-live-scores-v2.ts)"
fi

