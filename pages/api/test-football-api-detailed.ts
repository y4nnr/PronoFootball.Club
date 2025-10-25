import { NextApiRequest, NextApiResponse } from 'next';
import { FootballDataAPI } from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY not found');
    }

    const footballAPI = new FootballDataAPI(apiKey);

    // Test different endpoints
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    console.log(`🔍 Testing Football-Data.org API for date: ${dateStr}`);

    // Test 1: All matches for today
    const allMatches = await footballAPI.getMatchesByDateRange(dateStr, dateStr);
    
    // Test 2: Try to get live matches specifically
    let liveMatches = [];
    try {
      // Try the live matches endpoint if it exists
      const response = await fetch(`https://api.football-data.org/v4/matches?status=LIVE`, {
        headers: {
          'X-Auth-Token': apiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        liveMatches = data.matches || [];
        console.log(`📊 Found ${liveMatches.length} LIVE matches from status=LIVE endpoint`);
      } else {
        console.log(`⚠️ LIVE endpoint not available: ${response.status}`);
      }
    } catch (error) {
      console.log(`⚠️ Error with LIVE endpoint: ${error}`);
    }

    // Test 3: Check if we can get more detailed match info
    const detailedMatches = allMatches.map(match => ({
      id: match.id,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      halfTimeHome: match.score.halfTime.home,
      halfTimeAway: match.score.halfTime.away,
      status: match.status,
      utcDate: match.utcDate,
      competition: match.competition.name,
      lastUpdated: match.lastUpdated || 'N/A',
      minute: match.minute || 'N/A'
    }));

    return res.status(200).json({
      success: true,
      date: dateStr,
      allMatchesCount: allMatches.length,
      liveMatchesCount: liveMatches.length,
      allMatches: detailedMatches,
      liveMatches: liveMatches,
      apiInfo: {
        baseUrl: 'https://api.football-data.org/v4',
        endpoints: [
          `/matches?date=${dateStr}`,
          '/matches?status=LIVE'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error testing Football-Data.org API:', error);
    return res.status(500).json({ 
      error: 'Failed to test API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
