import { NextApiRequest, NextApiResponse } from 'next';
import { RugbyAPI } from '../../lib/api-rugby-v1';
import { API_CONFIG } from '../../lib/api-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId, season } = req.query;
  
  if (!leagueId || !season) {
    return res.status(400).json({ error: 'Missing leagueId or season' });
  }

  try {
    const competitionId = parseInt(leagueId as string);
    const seasonStr = season as string;

    console.log(`[TEST] Testing Rugby API with leagueId=${competitionId}, season=${seasonStr}`);
    
    // Check API key
    const apiKey = API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey;
    console.log(`[TEST] API Key check:`, {
      rugbyApiKey: API_CONFIG.rugbyApiKey ? `SET (${API_CONFIG.rugbyApiKey.substring(0, 10)}...)` : 'NOT SET',
      apiSportsApiKey: API_CONFIG.apiSportsApiKey ? `SET (${API_CONFIG.apiSportsApiKey.substring(0, 10)}...)` : 'NOT SET',
      finalApiKey: apiKey ? `SET (${apiKey.substring(0, 10)}...)` : 'NOT SET',
      apiKeyLength: apiKey?.length || 0
    });

    if (!apiKey) {
      return res.status(500).json({ error: 'No API key configured' });
    }

    const rugbyAPI = new RugbyAPI(apiKey);
    
    // Test 1: Get current/next season
    console.log(`[TEST] Test 1: Getting current/next season...`);
    let seasonResult = null;
    try {
      seasonResult = await rugbyAPI.getCurrentOrNextSeason(competitionId);
      console.log(`[TEST] Season result:`, seasonResult);
    } catch (error) {
      console.error(`[TEST] Error getting season:`, error);
    }
    
    // Test 2: Direct teams API call
    console.log(`[TEST] Test 2: Making direct teams API call...`);
    let teams: any[] = [];
    try {
      teams = await rugbyAPI.getTeamsByCompetition(competitionId, seasonStr);
      console.log(`[TEST] Teams result:`, {
        teamsCount: teams.length,
        teams: teams.slice(0, 5).map(t => ({ id: t.id, name: t.name }))
      });
    } catch (error) {
      console.error(`[TEST] Error getting teams:`, error);
    }
    
    // Test 3: Try to get games/fixtures
    console.log(`[TEST] Test 3: Getting games/fixtures...`);
    let fixtures: any[] = [];
    try {
      fixtures = await rugbyAPI.getFixturesByCompetition(competitionId, seasonStr, false);
      console.log(`[TEST] Fixtures result:`, {
        fixturesCount: fixtures.length,
        sample: fixtures.slice(0, 2)
      });
    } catch (error) {
      console.error(`[TEST] Error getting fixtures:`, error);
    }

    return res.status(200).json({
      success: true,
      leagueId: competitionId,
      season: seasonStr,
      seasonFromGames: seasonResult,
      teamsCount: teams.length,
      teams: teams,
      fixturesCount: fixtures.length,
      sampleFixtures: fixtures.slice(0, 2),
      apiKeyConfigured: !!apiKey,
      apiKeyLength: apiKey.length
    });
  } catch (error) {
    console.error(`[TEST] Error:`, error);
    return res.status(500).json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

