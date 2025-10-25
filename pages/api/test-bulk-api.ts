import { NextApiRequest, NextApiResponse } from 'next';
import FootballDataAPI from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing Football-Data.org Bulk API capabilities...');

    const footballAPI = new FootballDataAPI();

    // Test 1: API Connection
    console.log('1️⃣ Testing API connection...');
    const isConnected = await footballAPI.testConnection();

    if (!isConnected) {
      return res.status(500).json({
        success: false,
        error: 'API connection failed'
      });
    }

    // Test 2: Get all relevant matches (SCHEDULED, LIVE, FINISHED) in one call
    console.log('2️⃣ Fetching all relevant matches in one call...');
    const allRelevantMatches = await footballAPI.getAllRelevantMatches();

    // Test 3: Get matches by multiple statuses
    console.log('3️⃣ Fetching matches by multiple statuses...');
    const multiStatusMatches = await footballAPI.getMatchesByStatuses(['SCHEDULED', 'LIVE']);

    // Test 4: Get matches for multiple competitions (if we had other competitions)
    console.log('4️⃣ Fetching matches for multiple competitions...');
    const multiCompMatches = await footballAPI.getMatchesForCompetitions(['CL']);

    // Test 5: Get recent matches (last 30 days)
    console.log('5️⃣ Fetching recent matches...');
    const today = new Date();
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentMatches = await footballAPI.getMatchesByDateRange(
      lastMonth.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    // Analyze the data
    const statusCounts = allRelevantMatches.reduce((acc, match) => {
      acc[match.status] = (acc[match.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const results = {
      apiConnection: isConnected,
      bulkApiCapabilities: {
        allRelevantMatches: {
          count: allRelevantMatches.length,
          statusBreakdown: statusCounts,
          sample: allRelevantMatches.slice(0, 5).map(match => ({
            id: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            status: match.status,
            score: match.score.fullTime,
            date: match.utcDate
          }))
        },
        multiStatusMatches: {
          count: multiStatusMatches.length,
          sample: multiStatusMatches.slice(0, 3).map(match => ({
            id: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            status: match.status,
            score: match.score.fullTime
          }))
        },
        multiCompMatches: {
          count: multiCompMatches.length,
          sample: multiCompMatches.slice(0, 3).map(match => ({
            id: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            status: match.status,
            competition: match.competition.name
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
      },
      efficiency: {
        totalApiCalls: 5,
        totalMatchesFetched: allRelevantMatches.length + multiStatusMatches.length + multiCompMatches.length + recentMatches.length,
        averageMatchesPerCall: Math.round((allRelevantMatches.length + multiStatusMatches.length + multiCompMatches.length + recentMatches.length) / 5)
      }
    };

    console.log('✅ Bulk API test completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Football-Data.org Bulk API test completed',
      results
    });

  } catch (error) {
    console.error('❌ Bulk API test failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Bulk API test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
