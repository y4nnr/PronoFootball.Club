import { NextApiRequest, NextApiResponse } from 'next';
import { RugbyAPI } from '../../lib/api-rugby-v1';
import { API_CONFIG } from '../../lib/api-config';

/**
 * Test endpoint to debug Rugby competitions fetching
 * Usage: GET /api/test-rugby-competitions
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`[TEST RUGBY COMPETITIONS] Starting test...`);
    
    // Check API key
    const apiKey = API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'No API key configured' });
    }

    const rugbyAPI = new RugbyAPI(apiKey);
    
    const results: any = {
      tests: {}
    };
    
    // Test 1: Direct API call to /leagues
    console.log(`[TEST RUGBY COMPETITIONS] Test 1: Direct API call to /leagues...`);
    try {
      const directResponse = await fetch(
        'https://v1.rugby.api-sports.io/leagues',
        {
          headers: {
            'x-apisports-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const directData = await directResponse.json();
      results.tests.directLeaguesAPI = {
        success: directResponse.ok,
        status: directResponse.status,
        statusText: directResponse.statusText,
        responseLength: directData.response?.length || 0,
        hasResponse: !!directData.response,
        isArray: Array.isArray(directData.response),
        hasErrors: !!directData.errors,
        errors: directData.errors,
        sampleStructure: directData.response?.[0] ? {
          keys: Object.keys(directData.response[0]),
          full: JSON.stringify(directData.response[0], null, 2).substring(0, 1000)
        } : null,
        firstThreeItems: directData.response?.slice(0, 3).map((item: any) => ({
          keys: Object.keys(item),
          id: item.id,
          name: item.name,
          hasLeague: !!item.league,
          hasCountry: !!item.country
        }))
      };
    } catch (error) {
      results.tests.directLeaguesAPI = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    // Test 2: Using RugbyAPI.getCompetitions()
    console.log(`[TEST RUGBY COMPETITIONS] Test 2: Using RugbyAPI.getCompetitions()...`);
    try {
      const competitions = await rugbyAPI.getCompetitions();
      results.tests.getCompetitions = {
        success: true,
        count: competitions.length,
        competitions: competitions.slice(0, 5).map(c => ({
          id: c.id,
          name: c.name,
          country: c.country,
          type: c.type,
          seasonsCount: c.seasons.length
        }))
      };
    } catch (error) {
      results.tests.getCompetitions = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
    
    // Test 3: Try with country filter (France)
    console.log(`[TEST RUGBY COMPETITIONS] Test 3: Direct API call to /leagues?country=France...`);
    try {
      const directResponse = await fetch(
        'https://v1.rugby.api-sports.io/leagues?country=France',
        {
          headers: {
            'x-apisports-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const directData = await directResponse.json();
      results.tests.directLeaguesFrance = {
        success: directResponse.ok,
        status: directResponse.status,
        responseLength: directData.response?.length || 0,
        sampleStructure: directData.response?.[0] ? {
          keys: Object.keys(directData.response[0]),
          full: JSON.stringify(directData.response[0], null, 2).substring(0, 1000)
        } : null
      };
    } catch (error) {
      results.tests.directLeaguesFrance = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('[TEST RUGBY COMPETITIONS] Error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

