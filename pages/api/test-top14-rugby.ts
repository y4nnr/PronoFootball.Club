import { NextApiRequest, NextApiResponse } from 'next';
import { RugbyAPI } from '../../lib/api-rugby-v1';
import { API_CONFIG } from '../../lib/api-config';

/**
 * Test endpoint to debug Top 14 Rugby import
 * Usage: GET /api/test-top14-rugby?leagueId=16&season=2024
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId, season } = req.query;
  
  if (!leagueId) {
    return res.status(400).json({ error: 'Missing leagueId' });
  }

  try {
    const competitionId = parseInt(leagueId as string);
    const seasonStr = (season as string) || '2024';

    console.log(`[TEST TOP14] Testing with leagueId=${competitionId}, season=${seasonStr}`);
    
    // Check API key
    const apiKey = API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'No API key configured' });
    }

    const rugbyAPI = new RugbyAPI(apiKey);
    
    const results: any = {
      competitionId,
      season: seasonStr,
      tests: {}
    };
    
    // Test 1: Get current/next season
    console.log(`[TEST TOP14] Test 1: Getting current/next season...`);
    try {
      const seasonResult = await rugbyAPI.getCurrentOrNextSeason(competitionId);
      results.tests.seasonDetection = {
        success: true,
        result: seasonResult
      };
    } catch (error) {
      results.tests.seasonDetection = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    // Test 2: Get teams
    console.log(`[TEST TOP14] Test 2: Getting teams...`);
    try {
      const teams = await rugbyAPI.getTeamsByCompetition(competitionId, seasonStr);
      results.tests.teams = {
        success: true,
        count: teams.length,
        teams: teams.slice(0, 5).map(t => ({ id: t.id, name: t.name }))
      };
    } catch (error) {
      results.tests.teams = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
    
    // Test 3: Get fixtures/games (all)
    console.log(`[TEST TOP14] Test 3: Getting all fixtures/games...`);
    try {
      const fixtures = await rugbyAPI.getFixturesByCompetition(competitionId, seasonStr, false);
      results.tests.fixtures = {
        success: true,
        count: fixtures.length,
        sample: fixtures.slice(0, 2).map(f => ({
          id: f.fixture.id,
          date: f.fixture.date,
          status: f.fixture.status.short,
          home: f.teams.home.name,
          away: f.teams.away.name
        }))
      };
    } catch (error) {
      results.tests.fixtures = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
    
    // Test 4: Get fixtures/games (future only)
    console.log(`[TEST TOP14] Test 4: Getting future fixtures/games...`);
    try {
      const futureFixtures = await rugbyAPI.getFixturesByCompetition(competitionId, seasonStr, true);
      results.tests.futureFixtures = {
        success: true,
        count: futureFixtures.length,
        sample: futureFixtures.slice(0, 2).map(f => ({
          id: f.fixture.id,
          date: f.fixture.date,
          status: f.fixture.status.short,
          home: f.teams.home.name,
          away: f.teams.away.name
        }))
      };
    } catch (error) {
      results.tests.futureFixtures = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
    
    // Test 5: Direct API call to /games endpoint
    console.log(`[TEST TOP14] Test 5: Direct API call to /games...`);
    try {
      const directGamesResponse = await fetch(
        `https://v1.rugby.api-sports.io/games?league=${competitionId}&season=${seasonStr}`,
        {
          headers: {
            'x-apisports-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const directGamesData = await directGamesResponse.json();
      results.tests.directGamesAPI = {
        success: directGamesResponse.ok,
        status: directGamesResponse.status,
        responseLength: directGamesData.response?.length || 0,
        sampleStructure: directGamesData.response?.[0] ? {
          keys: Object.keys(directGamesData.response[0]),
          full: JSON.stringify(directGamesData.response[0], null, 2).substring(0, 500)
        } : null,
        errors: directGamesData.errors
      };
    } catch (error) {
      results.tests.directGamesAPI = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    // Test 6: Direct API call to /teams endpoint
    console.log(`[TEST TOP14] Test 6: Direct API call to /teams...`);
    try {
      const directTeamsResponse = await fetch(
        `https://v1.rugby.api-sports.io/teams?league=${competitionId}&season=${seasonStr}`,
        {
          headers: {
            'x-apisports-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const directTeamsData = await directTeamsResponse.json();
      results.tests.directTeamsAPI = {
        success: directTeamsResponse.ok,
        status: directTeamsResponse.status,
        responseLength: directTeamsData.response?.length || 0,
        sampleStructure: directTeamsData.response?.[0] ? {
          keys: Object.keys(directTeamsData.response[0]),
          full: JSON.stringify(directTeamsData.response[0], null, 2).substring(0, 500)
        } : null,
        errors: directTeamsData.errors
      };
    } catch (error) {
      results.tests.directTeamsAPI = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('[TEST TOP14] Error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

