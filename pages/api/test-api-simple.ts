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
    console.log('🧪 Testing Football-Data.org API (simple test)...');

    const footballAPI = new FootballDataAPI();

    // Test API connection
    console.log('1️⃣ Testing API connection...');
    const isConnected = await footballAPI.testConnection();

    if (!isConnected) {
      return res.status(500).json({
        success: false,
        error: 'API connection failed',
        message: 'Please check your API key in .env file'
      });
    }

    // Get Champions League matches
    console.log('2️⃣ Fetching Champions League matches...');
    const championsLeagueMatches = await footballAPI.getChampionsLeagueMatches();

    // Get live matches
    console.log('3️⃣ Fetching live matches...');
    const liveMatches = await footballAPI.getLiveMatches();

    return res.status(200).json({
      success: true,
      message: 'Football-Data.org API test successful!',
      results: {
        apiConnection: isConnected,
        championsLeagueMatches: {
          count: championsLeagueMatches.length,
          sample: championsLeagueMatches.slice(0, 3).map(match => ({
            id: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            status: match.status,
            score: match.score.fullTime,
            date: match.utcDate
          }))
        },
        liveMatches: {
          count: liveMatches.length,
          matches: liveMatches.map(match => ({
            id: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            status: match.status,
            score: match.score.fullTime,
            date: match.utcDate
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ API test failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'API test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
