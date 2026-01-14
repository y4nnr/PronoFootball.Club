#!/bin/bash

# Script pour tester l'API football-data.org pour trouver Chelsea
# Usage: ./test-chelsea-api.sh

# Récupérer la clé API depuis .env.local
API_KEY=$(grep FOOTBALL_DATA_API_KEY .env.local 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$API_KEY" ]; then
    echo "❌ Erreur: FOOTBALL_DATA_API_KEY non trouvée dans .env.local"
    exit 1
fi

echo "🔑 Clé API trouvée (${#API_KEY} caractères)"
echo ""

# Test 1: Liste des compétitions
echo "📋 Test 1: Liste des compétitions"
echo "Commande:"
echo "curl -H \"X-Auth-Token: \$API_KEY\" \"https://api.football-data.org/v4/competitions\""
echo ""
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/competitions" | python3 -m json.tool | head -30
echo ""
echo "---"
echo ""

# Test 2: Premier League directement
echo "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Test 2: Premier League (PL)"
echo "Commande:"
echo "curl -H \"X-Auth-Token: \$API_KEY\" \"https://api.football-data.org/v4/competitions/PL\""
echo ""
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/competitions/PL" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 3: Matchs de Premier League aujourd'hui
TODAY=$(date +%Y-%m-%d)
echo "📅 Test 3: Matchs Premier League aujourd'hui ($TODAY)"
echo "Commande:"
echo "curl -H \"X-Auth-Token: \$API_KEY\" \"https://api.football-data.org/v4/competitions/PL/matches?date=$TODAY\""
echo ""
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/competitions/PL/matches?date=$TODAY" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 4: Recherche Chelsea dans tous les matchs d'aujourd'hui
echo "🔍 Test 4: Recherche Chelsea dans tous les matchs d'aujourd'hui"
echo "Commande:"
echo "curl -H \"X-Auth-Token: \$API_KEY\" \"https://api.football-data.org/v4/matches?date=$TODAY\""
echo ""
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?date=$TODAY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
matches = data.get('matches', [])
chelsea = [m for m in matches if 'chelsea' in (m.get('homeTeam', {}).get('name', '') + ' ' + m.get('awayTeam', {}).get('name', '')).lower()]
print(json.dumps({
    'total_matches': len(matches),
    'chelsea_found': len(chelsea) > 0,
    'chelsea_match': chelsea[0] if chelsea else None,
    'all_matches': [{'home': m['homeTeam']['name'], 'away': m['awayTeam']['name'], 'comp': m.get('competition', {}).get('name'), 'status': m.get('status'), 'minute': m.get('minute')} for m in matches[:10]]
}, indent=2))
"
echo ""
echo "---"
echo ""

# Test 5: Matchs en direct
echo "⚽ Test 5: Matchs en direct"
echo "Commande:"
echo "curl -H \"X-Auth-Token: \$API_KEY\" \"https://api.football-data.org/v4/matches?status=LIVE\""
echo ""
curl -s -H "X-Auth-Token: $API_KEY" "https://api.football-data.org/v4/matches?status=LIVE" | python3 -m json.tool | head -50
echo ""

