import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { FootballDataAPI } from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🧪 Testing Football-Data.org API integration...');

    const footballAPI = new FootballDataAPI();

    // Test 1: API Connection
    console.log('1️⃣ Testing API connection...');
    const isConnected = await footballAPI.testConnection();

    // Test 2: Get Champions League matches
    console.log('2️⃣ Fetching Champions League matches...');
    const championsLeagueMatches = await footballAPI.getChampionsLeagueMatches();

    // Test 3: Get live matches
    console.log('3️⃣ Fetching live matches...');
    const liveMatches = await footballAPI.getLiveMatches();

    // Test 4: Get recent matches (last 7 days)
    console.log('4️⃣ Fetching recent matches...');
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentMatches = await footballAPI.getMatchesByDateRange(
      lastWeek.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    const results = {
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
      },
      recentMatches: {
        count: recentMatches.length,
        sample: recentMatches.slice(0, 5).map(match => ({
          id: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          status: match.status,
          score: match.score.fullTime,
          date: match.utcDate
        }))
      }
    };

    console.log('✅ API test completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Football-Data.org API test completed',
      results
    });

  } catch (error) {
    console.error('❌ API test failed:', error);
    return res.status(500).json({ 
      error: 'API test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
