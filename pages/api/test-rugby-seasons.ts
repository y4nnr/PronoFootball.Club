import { NextApiRequest, NextApiResponse } from 'next';
import { RugbyAPI } from '../../lib/api-rugby-v1';
import { API_CONFIG } from '../../lib/api-config';

/**
 * Test endpoint to check if /seasons endpoint exists for Rugby
 * Usage: GET /api/test-rugby-seasons
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'No API key configured' });
    }

    const rugbyAPI = new RugbyAPI(apiKey);
    
    const results: any = {
      tests: {}
    };
    
    // Test 1: Direct API call to /seasons
    console.log(`[TEST] Test 1: Direct API call to /seasons...`);
    try {
      const directResponse = await fetch(
        'https://v1.rugby.api-sports.io/seasons',
        {
          headers: {
            'x-apisports-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const directData = await directResponse.json();
      results.tests.directSeasonsAPI = {
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
          full: JSON.stringify(directData.response[0], null, 2).substring(0, 500)
        } : null,
        firstTenItems: directData.response?.slice(0, 10)
      };
    } catch (error) {
      results.tests.directSeasonsAPI = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    // Test 2: Using RugbyAPI.getAvailableSeasons()
    console.log(`[TEST] Test 2: Using RugbyAPI.getAvailableSeasons()...`);
    try {
      const seasons = await rugbyAPI.getAvailableSeasons();
      results.tests.getAvailableSeasons = {
        success: true,
        count: seasons.length,
        seasons: seasons.slice(0, 10)
      };
    } catch (error) {
      results.tests.getAvailableSeasons = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
    
    // Test 3: Test getCurrentOrNextSeason for Top 14 (league 16)
    console.log(`[TEST] Test 3: Testing getCurrentOrNextSeason for league 16...`);
    try {
      const season = await rugbyAPI.getCurrentOrNextSeason(16);
      results.tests.getCurrentOrNextSeason = {
        success: true,
        result: season
      };
    } catch (error) {
      results.tests.getCurrentOrNextSeason = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('[TEST] Error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

