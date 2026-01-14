#!/bin/bash

# Récupérer la clé API
API_KEY=$(grep FOOTBALL_DATA_API_KEY .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$API_KEY" ]; then
    echo "❌ Erreur: Clé API non trouvée"
    exit 1
fi

echo "🔍 Recherche du match Liverpool en direct..."
echo ""

# Test 1: Matchs IN_PLAY
echo "📋 Test 1: Matchs avec status=IN_PLAY"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?status=IN_PLAY" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 2: Matchs LIVE
echo "📋 Test 2: Matchs avec status=LIVE"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?status=LIVE" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 3: Premier League IN_PLAY
echo "📋 Test 3: Premier League avec status=IN_PLAY"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/competitions/PL/matches?status=IN_PLAY" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 4: Tous les matchs d'aujourd'hui
TODAY=$(date +%Y-%m-%d)
echo "📋 Test 4: Tous les matchs d'aujourd'hui ($TODAY)"
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?date=$TODAY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
matches = data.get('matches', [])
liverpool = [m for m in matches if 'liverpool' in (m.get('homeTeam', {}).get('name', '') + ' ' + m.get('awayTeam', {}).get('name', '')).lower()]
if liverpool:
    m = liverpool[0]
    print(json.dumps({
        'found': True,
        'id': m.get('id'),
        'home': m.get('homeTeam', {}).get('name'),
        'away': m.get('awayTeam', {}).get('name'),
        'status': m.get('status'),
        'minute': m.get('minute'),
        'score': m.get('score', {}),
        'utcDate': m.get('utcDate'),
        'all_keys': list(m.keys())
    }, indent=2))
else:
    print(json.dumps({'found': False, 'total_matches': len(matches)}, indent=2))
"
echo ""

